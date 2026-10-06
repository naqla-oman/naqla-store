import { MedusaService } from "@medusajs/framework/utils"
import { clientDefaults, deepMerge, setClientOverrides } from "../../lib/client"
import { queueRevalidate } from "../../lib/revalidate"
import { SCHEMA, SettingsError, crossCheck, getPath, setPath } from "../../lib/store-settings-schema"
import { StoreSettings, StoreSettingsChange } from "./models/store-settings"

type Actor = { id?: string | null; email?: string | null }
export type Change = { key: string; from: unknown; to: unknown }

class StoreSettingsModuleService extends MedusaService({ StoreSettings, StoreSettingsChange }) {
  async getRow() {
    const [row] = await this.listStoreSettings({}, { take: 1, order: { created_at: "ASC" } })
    return row ?? (await this.createStoreSettings({ overrides: {}, secrets: {} }))
  }

  /** حفظ تعديلات اللوحة: تحقق كل مفتاح (قائمة بيضاء) ← دمج ← قيود بين الحقول ← حفظ وسجل وإبطال */
  async saveOverrides(patch: Record<string, unknown>, actor: Actor = {}, pg?: any) {
    const row: any = await this.getRow()
    const overrides = structuredClone(row.overrides ?? {})
    const defaults = clientDefaults()
    const before = deepMerge(defaults, row.overrides ?? {})
    const changes: Change[] = []
    for (const [key, raw] of Object.entries(patch ?? {})) {
      const spec = SCHEMA[key]
      if (!spec) throw new SettingsError(`المفتاح «${key}» غير قابل للتعديل من اللوحة`)
      const value = spec.check(raw)
      // «غير موجود» و null سواء (حقل فارغ لمفتاح غير موجود في store.json لا يُحفظ)
      const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
      const prev = getPath(before, key)
      if (same(prev, value)) continue
      // القيمة المساوية للافتراضي تُحذف من overrides (يبقى store.json هو المصدر)
      if (same(getPath(defaults, key), value)) unset(overrides, key)
      else setPath(overrides, key, value)
      changes.push({ key, from: prev ?? null, to: value })
    }
    if (!changes.length) return { changes }
    crossCheck(deepMerge(defaults, overrides))
    await this.replaceJson(pg, row.id, "overrides", overrides)
    await this.createStoreSettingsChanges({ actor_id: actor.id ?? null, actor_email: actor.email ?? null, changes: { items: changes } as any })
    setClientOverrides(overrides)
    queueRevalidate(["store-settings"])
    return { changes }
  }

  /**
   * تحديث حقل JSON بالاستبدال لا الدمج: Medusa/MikroORM يدمج كائنات JSON عند التحديث،
   * فحذف مفتاح (العودة للافتراضي) لا يُحفظ — تحديث مباشر يستبدل الحقل كاملاً (العمود غير قابل لـ null).
   */
  async replaceJson(pg: any, id: string, field: "overrides" | "secrets", value: Record<string, unknown>) {
    if (!pg) throw new SettingsError("اتصال القاعدة مطلوب للحفظ")
    await pg.raw(`update store_settings set ${field} = ?::jsonb, updated_at = now() where id = ?`, [JSON.stringify(value), id])
  }

  async history(limit = 20) {
    return this.listStoreSettingsChanges({}, { take: limit, order: { created_at: "DESC" } })
  }
}

function unset(o: Record<string, any>, path: string) {
  const ks = path.split(".")
  const parents: [Record<string, any>, string][] = []
  let x: any = o
  for (const k of ks.slice(0, -1)) { if (!x?.[k] || typeof x[k] !== "object") return; parents.push([x, k]); x = x[k] }
  delete x[ks[ks.length - 1]]
  for (const [p, k] of parents.reverse()) if (p[k] && !Object.keys(p[k]).length) delete p[k]
}

export default StoreSettingsModuleService
