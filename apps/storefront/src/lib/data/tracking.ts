"use server"

import { sdk } from "@lib/config"

export type TrackingConfig = {
  ga4_measurement_id: string | null
  meta_pixel_id: string | null
  snap_pixel_id: string | null
  tiktok_pixel_id: string | null
  clarity_project_id: string | null
}

/** المعرّفات العامة من «أدوات التتبع» في اللوحة (تُحدَّث كل 5 دقائق) */
export async function getTrackingConfig(): Promise<TrackingConfig | null> {
  return sdk.client
    .fetch<{ config: TrackingConfig }>("/store/tracking-config", { next: { revalidate: 300, tags: ["tracking-config"] } })
    .then((r) => r.config)
    .catch(() => null)
}
