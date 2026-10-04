import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { CodPaymentProvider } from "./cod"
import { WhatsappPaymentProvider } from "./whatsapp"

/** المعرّفات في Medusa: pp_cod_offline و pp_whatsapp_offline */
export default ModuleProvider(Modules.PAYMENT, {
  services: [CodPaymentProvider, WhatsappPaymentProvider],
})
