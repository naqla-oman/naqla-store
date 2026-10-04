import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import PhoneAuthService from "./service"

/** مزوّد المصادقة au_phone-auth — للزبونات فقط (authMethodsPerActor) */
export default ModuleProvider(Modules.AUTH, { services: [PhoneAuthService] })
