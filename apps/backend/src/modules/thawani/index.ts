import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import ThawaniPaymentProvider from "./service"

/** المعرّف في Medusa: pp_thawani_thawani — يُفعَّل عبر THAWANI_ENABLED=true */
export default ModuleProvider(Modules.PAYMENT, { services: [ThawaniPaymentProvider] })
