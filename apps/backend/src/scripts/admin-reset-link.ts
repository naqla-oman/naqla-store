import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { generateResetPasswordTokenWorkflow } from "@medusajs/medusa/core-flows"

/**
 * لوحة نقلة: رمز تعيين كلمة مرور لمسؤول المتجر (ADMIN_EMAIL) — يُرسل للعميل رابطاً، لا كلمة مرور.
 * npx medusa exec ./src/scripts/admin-reset-link.ts  ← يطبع RESET_TOKEN=…
 */
export default async function run({ container }: ExecArgs) {
  const email = process.env.ADMIN_EMAIL
  if (!email) throw new Error("ADMIN_EMAIL مطلوب")
  const cfg = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as any
  const { result } = await generateResetPasswordTokenWorkflow(container).run({
    input: { entityId: email, actorType: "user", provider: "emailpass", secret: cfg.projectConfig.http.jwtSecret },
  })
  console.log(`RESET_TOKEN=${result}`)
}
