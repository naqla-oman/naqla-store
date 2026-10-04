import { model } from "@medusajs/framework/utils"

/**
 * قيد في سجل نقاط الولاء.
 * - earn: نقاط طلب (pending حتى التوصيل → available، أو canceled عند الإلغاء)
 * - redeem: استبدال (نقاط سالبة، available فوراً) مع كود الخصم الناتج
 */
export const LoyaltyEntry = model
  .define("loyalty_entry", {
    id: model.id({ prefix: "loy" }).primaryKey(),
    customer_id: model.text().index(),
    order_id: model.text().nullable(),
    order_display_id: model.number().nullable(),
    kind: model.enum(["earn", "redeem"]),
    status: model.enum(["pending", "available", "canceled"]),
    points: model.number(),
    code: model.text().nullable(),
    note: model.text().nullable(),
  })
  .indexes([{ on: ["order_id", "kind"], unique: true, where: "order_id IS NOT NULL" }])
