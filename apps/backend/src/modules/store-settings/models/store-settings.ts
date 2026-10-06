import { model } from "@medusajs/framework/utils"

/**
 * إعدادات المتجر التي يعدّلها العميل من لوحته (صف واحد). overrides تستبدل store.json؛
 * secrets مشفّرة (AES-256-GCM) ولا تغادر الخادم.
 */
export const StoreSettings = model.define("store_settings", {
  id: model.id({ prefix: "sst" }).primaryKey(),
  overrides: model.json().default({}),
  secrets: model.json().default({}),
})

/** سجل التغييرات: من غيّر ماذا ومتى (القيم السرية تُسجَّل «تغيّر» فقط) */
export const StoreSettingsChange = model.define("store_settings_change", {
  id: model.id({ prefix: "ssc" }).primaryKey(),
  actor_id: model.text().nullable(),
  actor_email: model.text().nullable(),
  changes: model.json().default({}),
})
