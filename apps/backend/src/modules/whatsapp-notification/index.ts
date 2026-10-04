import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import WhatsappNotificationService from "./service"

export default ModuleProvider(Modules.NOTIFICATION, { services: [WhatsappNotificationService] })
