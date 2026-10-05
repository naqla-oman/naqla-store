import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import SafeLocalFileService from "./service"

export default ModuleProvider(Modules.FILE, { services: [SafeLocalFileService] })
