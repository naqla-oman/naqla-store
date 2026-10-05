import { Module } from "@medusajs/framework/utils"
import TrackingModuleService from "./service"
import redisCheck from "./loaders/redis-check"

export const TRACKING_MODULE = "tracking"

// H7: فحص Redis عند الإقلاع (loader الوحدة يعمل قبل جاهزية الخادم)
export default Module(TRACKING_MODULE, { service: TrackingModuleService, loaders: [redisCheck] })
