import { Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { linkCustomerGroupsToCustomerWorkflow } from "@medusajs/medusa/core-flows"
import { LOYALTY_MODULE } from "../modules/loyalty"
import type LoyaltyModuleService from "../modules/loyalty/service"

type Input = { customer_id: string }

/**
 * يحدد مجموعات المستويات المستحقة من النقاط المؤكَّدة (بعد التوصيل) ويقارنها بالحالية.
 * مجموعات المستويات معرَّفة بـ metadata.loyalty_tier. الماسية تبقى في الذهبية أيضاً
 * (كل مستوى يشمل امتيازات ما دونه)، والنزول تحت الحد بعد إلغاء طلب يُخرجها من المجموعة.
 */
const resolveTierGroupsStep = createStep("resolve-tier-groups", async ({ customer_id }: Input, { container }) => {
  const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
  const customers = container.resolve(Modules.CUSTOMER)

  const { confirmed } = await loyalty.summary(customer_id)
  const tiers = loyalty.options.tiers
  const groups = (await customers.listCustomerGroups({}, { take: 100 })).filter((g) => (g.metadata as any)?.loyalty_tier)
  const me = await customers.retrieveCustomer(customer_id, { relations: ["groups"] })
  const mine = new Set((me.groups ?? []).map((g) => g.id))

  const add: string[] = []
  const remove: string[] = []
  for (const g of groups) {
    const tier = tiers.find((t) => t.key === (g.metadata as any).loyalty_tier)
    if (!tier) continue
    const deserved = confirmed >= tier.min
    if (deserved && !mine.has(g.id)) add.push(g.id)
    if (!deserved && mine.has(g.id)) remove.push(g.id)
  }
  return new StepResponse({ id: customer_id, add, remove })
})

export const syncLoyaltyTierWorkflow = createWorkflow("sync-loyalty-tier", (input: Input) => {
  const links = resolveTierGroupsStep(input)
  linkCustomerGroupsToCustomerWorkflow.runAsStep({ input: links })
  return new WorkflowResponse(links)
})
