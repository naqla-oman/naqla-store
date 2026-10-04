import { model } from "@medusajs/framework/utils"

/**
 * إعدادات أدوات التتبع للمتجر (صف واحد). تُحفظ في الخادم لا في .env، وتُدار من صفحة «أدوات التتبع».
 * المعرّفات العامة (Pixel/Measurement ID) تُرسل للواجهة؛ الرموز السرية لا تغادر الخادم.
 */
export const TrackingSettings = model.define("tracking_settings", {
  id: model.id({ prefix: "trk" }).primaryKey(),
  ga4_measurement_id: model.text().nullable(),
  ga4_api_secret: model.text().nullable(),
  meta_pixel_id: model.text().nullable(),
  meta_access_token: model.text().nullable(),
  meta_test_event_code: model.text().nullable(),
  snap_pixel_id: model.text().nullable(),
  snap_access_token: model.text().nullable(),
  snap_test_mode: model.boolean().default(false),
  tiktok_pixel_id: model.text().nullable(),
  tiktok_access_token: model.text().nullable(),
  tiktok_test_event_code: model.text().nullable(),
  clarity_project_id: model.text().nullable(),
})
