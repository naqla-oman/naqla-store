import { Module } from "@medusajs/framework/utils"
import StoreSettingsModuleService from "./service"
import loadOverrides from "./loaders/load-overrides"

export const STORE_SETTINGS_MODULE = "storeSettings"

export default Module(STORE_SETTINGS_MODULE, { service: StoreSettingsModuleService, loaders: [loadOverrides] })
