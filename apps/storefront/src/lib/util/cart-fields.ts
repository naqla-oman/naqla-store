/** حقول السلة المطلوبة لصفحات السلة والدفع */
export const CART_FIELDS =
  "*items,*items.variant,+items.variant.inventory_quantity,+items.variant.manage_inventory,+items.variant.allow_backorder,*items.product,+items.metadata,*promotions,*promotions.application_method,+item_total,+item_subtotal,+subtotal,+total,+discount_total,+shipping_total,+tax_total,*shipping_methods,*shipping_methods.shipping_option.type,*shipping_address,*region,+metadata"
