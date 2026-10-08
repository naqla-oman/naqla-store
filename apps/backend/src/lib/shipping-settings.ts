import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import { client } from "./client"
import { shippingPrices } from "./shipping-prices"
import { SettingsError } from "./store-settings-schema"

/**
 * تبويب «التوصيل»: Medusa هو المصدر الوحيد — الأسعار وحد المجاني في أسعار خيارات الشحن وقواعدها،
 * والمحافظات المفعّلة في مناطق الخدمة الجغرافية (المنطقة الرئيسية للعادي والاستلام، ومنطقة السريع).
 */
type OptionRow = { id: string; code: string; zone_id: string; amount: number | null; free_over: number | null }

async function rows(container: MedusaContainer) {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const opts = (await pg.raw(`
    select so.id, sot.code, so.service_zone_id as zone_id,
      (select min(p.amount)::numeric from shipping_option_price_set sops join price p on p.price_set_id = sops.price_set_id and p.deleted_at is null
        where sops.shipping_option_id = so.id and p.amount > 0 and not exists (select 1 from price_rule pr where pr.price_id = p.id and pr.deleted_at is null)) as amount,
      (select min(pr.value::numeric) from shipping_option_price_set sops join price p on p.price_set_id = sops.price_set_id and p.deleted_at is null and p.amount = 0
        join price_rule pr on pr.price_id = p.id and pr.deleted_at is null and pr.attribute = 'item_total' where sops.shipping_option_id = so.id) as free_over
      from shipping_option so join shipping_option_type sot on sot.id = so.shipping_option_type_id
     where so.deleted_at is null and sot.code in ('standard', 'express', 'pickup')`)).rows as any[]
  const geo = (await pg.raw(`select service_zone_id, type, country_code, province_code from geo_zone where deleted_at is null`)).rows as any[]
  const provincesOf = (zone: string): string[] | null => {
    const z = geo.filter((x) => x.service_zone_id === zone)
    return z.some((x) => x.type === "country") ? null : z.map((x) => x.province_code)
  }
  const byCode = Object.fromEntries(opts.map((o) => [o.code, { id: o.id, code: o.code, zone_id: o.zone_id, amount: o.amount == null ? null : Number(o.amount), free_over: o.free_over == null ? null : Number(o.free_over) } as OptionRow]))
  return { byCode, provincesOf }
}

/** القيم الحالية للوحة والواجهة: null للمحافظات = كل المحافظات */
export async function readShipping(container: MedusaContainer) {
  const { byCode, provincesOf } = await rows(container)
  const c = client() as any
  return {
    standard: byCode.standard ? { amount: byCode.standard.amount, free_over: byCode.standard.free_over } : null,
    express: byCode.express ? { amount: byCode.express.amount, provinces: provincesOf(byCode.express.zone_id) } : null,
    pickup: !!byCode.pickup,
    governorates: byCode.standard ? provincesOf(byCode.standard.zone_id) : null,
    cutoffHour: c.cutoffHour ?? null,
    deliveryOffDays: c.deliveryOffDays ?? [],
  }
}

export type ShippingInput = {
  standard?: { amount: number; free_over: number | null }
  express?: { amount: number; provinces: string[] }
  governorates?: string[] // المفعّلة؛ كلها ← المنطقة على مستوى الدولة
}

const money = (v: unknown, label: string) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 1000) throw new SettingsError("amount_range", { field: label })
  if (Math.abs(Math.round(n * 1000) - n * 1000) > 1e-6) throw new SettingsError("amount_decimals", { field: label })
  return n
}

/** يكتب في Medusa مباشرة ويعيد قائمة التغييرات للسجل */
export async function writeShipping(container: MedusaContainer, input: ShippingInput) {
  const c = client() as any
  const allCodes: string[] = (c.checkout?.governorates ?? []).map((x: any) => x.code)
  const known = (list: unknown, label: string) => {
    if (!Array.isArray(list) || !list.every((x) => allCodes.includes(String(x)))) throw new SettingsError("governorate_unknown_in", { field: label })
    return [...new Set(list.map(String))]
  }
  const before = await readShipping(container)
  const { byCode } = await rows(container)
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const region = (await container.resolve(Modules.REGION).listRegions({}, { take: 1 }))[0]
  const changes: { key: string; from: unknown; to: unknown }[] = []

  const setZone = async (zoneId: string, provinces: string[] | null) => {
    await fulfillment.updateServiceZones(zoneId, {
      geo_zones: provinces === null
        ? [{ type: "country", country_code: c.country }]
        : provinces.map((p) => ({ type: "province", country_code: c.country, province_code: p })),
    } as any)
  }

  if (input.standard && byCode.standard) {
    const amount = money(input.standard.amount, "shipping.standard.amount")
    const free_over = input.standard.free_over == null || (input.standard.free_over as any) === "" ? null : money(input.standard.free_over, "shipping.standard.free_over")
    if (free_over !== null && free_over <= amount) throw new SettingsError("free_over_gt_amount")
    if (amount !== before.standard?.amount || free_over !== before.standard?.free_over) {
      await updateShippingOptionsWorkflow(container).run({ input: [{ id: byCode.standard.id, prices: shippingPrices({ amount, free_over: free_over ?? undefined }, c.currency, region.id) } as any] })
      if (amount !== before.standard?.amount) changes.push({ key: "shipping.standard.amount", from: before.standard?.amount, to: amount })
      if (free_over !== before.standard?.free_over) changes.push({ key: "shipping.standard.free_over", from: before.standard?.free_over, to: free_over })
    }
  }
  if (input.express && byCode.express) {
    const amount = money(input.express.amount, "shipping.express.amount")
    const provinces = known(input.express.provinces, "shipping.express.provinces")
    if (!provinces.length) throw new SettingsError("express_province_required")
    if (amount !== before.express?.amount) {
      await updateShippingOptionsWorkflow(container).run({ input: [{ id: byCode.express.id, prices: shippingPrices({ amount }, c.currency, region.id) } as any] })
      changes.push({ key: "shipping.express.amount", from: before.express?.amount, to: amount })
    }
    if (JSON.stringify([...provinces].sort()) !== JSON.stringify([...(before.express?.provinces ?? [])].sort())) {
      await setZone(byCode.express.zone_id, provinces)
      changes.push({ key: "shipping.express.provinces", from: before.express?.provinces, to: provinces })
    }
  }
  if (input.governorates && byCode.standard) {
    let list = known(input.governorates, "shipping.governorates")
    if (!list.length) throw new SettingsError("governorate_required")
    // محافظة موقع الاستلام تبقى مفعّلة (عنوان طلبات الاستلام)
    const loc = c.location?.province
    if (loc && !list.includes(loc)) list = [...list, loc]
    const next = list.length === allCodes.length ? null : list
    if (JSON.stringify(next && [...next].sort()) !== JSON.stringify(before.governorates && [...before.governorates].sort())) {
      await setZone(byCode.standard.zone_id, next)
      changes.push({ key: "shipping.governorates", from: before.governorates ?? "الكل", to: next ?? "الكل" })
    }
  }
  return changes
}
