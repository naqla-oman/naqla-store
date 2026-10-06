import type { LoaderOptions } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { setClientOverrides } from "../../../lib/client"

/** عند الإقلاع: تحميل إعدادات اللوحة في client() قبل أي طلب (الجدول قد لا يوجد قبل أول migrate) */
export default async function loadOverrides({ container }: LoaderOptions) {
  try {
    const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
    const { rows } = await pg.raw(`select overrides from store_settings where deleted_at is null order by created_at limit 1`)
    setClientOverrides(rows[0]?.overrides ?? {})
  } catch {
    setClientOverrides({})
  }
}
