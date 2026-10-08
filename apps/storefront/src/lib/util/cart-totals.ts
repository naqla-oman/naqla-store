import { HttpTypes } from "@medusajs/types"

/**
 * ما يدفعه الزبون قبل التوصيل: أسعار الأسطر (شاملة الضريبة كما تُعرض في كل مكان) ناقص خصم المنتجات.
 * مصدر واحد لصفحة السلة وسلة الرأس — cart.subtotal في Medusa قبل الضريبة فكان يخالف سعر السطر (36.900 ← 35.143).
 */
export const cartItemsTotal = (cart: HttpTypes.StoreCart) =>
  (cart.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0)

export const cartItemsDiscount = (cart: HttpTypes.StoreCart) =>
  Math.max(0, (cart.discount_total ?? 0) - ((cart as any).shipping_discount_total ?? 0))

export const cartPayable = (cart: HttpTypes.StoreCart) => cartItemsTotal(cart) - cartItemsDiscount(cart)
