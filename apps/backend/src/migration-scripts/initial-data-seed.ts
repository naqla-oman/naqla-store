/**
 * Naqla Store Platform — البذرة الأولى للمتجر (سلطنة عُمان)
 *
 * تُقرأ كل بيانات المتجر من clients/<STORE>/store.json (STORE إلزامي)
 * بحيث يكون إنشاء متجر لعميل جديد = مجلد عميل جديد فقط، بلا تعديل كود.
 *
 * يُنشئ: المتجر (OMR)، قناة البيع، مفتاح النشر، منطقة عُمان، ضريبة القيمة المضافة 5٪،
 * موقع المخزون (المشغل)، خيارات التوصيل (عادي/سريع/استلام)، الأقسام، المجموعات،
 * الوسوم، خيارات المنتج المعرّفة لنشاط العميل (store.options)، المنتجات بمتغيراتها وأسعارها ومخزونها.
 */
import { MedusaContainer } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductOptionsWorkflow,
  createProductTagsWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
  updatePricePreferencesWorkflow,
} from "@medusajs/medusa/core-flows";
import { client, feature } from "../lib/client";
import { weightFor } from "../lib/weights";
import { shippingPrices } from "../lib/shipping-prices";

export default async function initial_data_seed({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(ModuleRegistrationName.FULFILLMENT);
  const storeModuleService = container.resolve(Modules.STORE);

  const data = client();
  // التوصيل السريع والاستلام يتبعان مفاتيح التشغيل في store.json
  const shipping = data.shipping.filter(
    (sh) => !(sh.code === "express" && !feature("expressDelivery")) && !(sh.code === "pickup" && !feature("pickup"))
  );
  const S = { name: data.name, name_en: data.nameEn, currency: data.currency, vat_rate: data.vatRate, country: data.country, location: data.location, shipping };
  const cur = S.currency;
  const country = S.country;

  logger.info(`Seeding store "${S.name}" from clients/${data.slug}/store.json ...`);

  // ---------- قناة البيع + مفتاح النشر ----------
  const { result: [salesChannel] } = await createSalesChannelsWorkflow(container).run({
    input: { salesChannelsData: [{ name: "المتجر الإلكتروني", description: "قناة البيع الرئيسية" }] },
  });
  const { result: [publishableApiKey] } = await createApiKeysWorkflow(container).run({
    input: { api_keys: [{ title: "Storefront key", type: "publishable", created_by: "" }] },
  });
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: publishableApiKey.id, add: [salesChannel.id] },
  });

  // ---------- المتجر ----------
  const [existingStore] = await storeModuleService.listStores();
  if (existingStore) {
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: existingStore.id },
        update: {
          name: S.name,
          supported_currencies: [{ currency_code: cur, is_default: true }],
          default_sales_channel_id: salesChannel.id,
        },
      },
    });
  } else {
    await createStoresWorkflow(container).run({
      input: {
        stores: [{
          name: S.name,
          supported_currencies: [{ currency_code: cur, is_default: true }],
          default_sales_channel_id: salesChannel.id,
        }],
      },
    });
  }

  // الأسعار المعروضة شاملة الضريبة (كما هو معتاد في عُمان)
  await updatePricePreferencesWorkflow(container).run({
    input: { selector: { attribute: "currency_code", value: cur }, update: { is_tax_inclusive: true } },
  });

  // ---------- المنطقة + الضريبة ----------
  const { result: [region] } = await createRegionsWorkflow(container).run({
    input: {
      regions: [{
        name: "سلطنة عُمان",
        currency_code: cur,
        countries: [country],
        payment_providers: ["pp_system_default"],
        automatic_taxes: true,
      }],
    },
  });
  await createTaxRegionsWorkflow(container).run({
    input: [{
      country_code: country,
      provider_id: "tp_system",
      default_tax_rate: { name: "ضريبة القيمة المضافة", code: "VAT", rate: S.vat_rate },
    }],
  });

  // ---------- موقع المخزون (المشغل) ----------
  const { result: [stockLocation] } = await createStockLocationsWorkflow(container).run({
    input: {
      locations: [{
        name: S.location.name,
        address: { city: S.location.city, country_code: country.toUpperCase(), address_1: S.location.address },
      }],
    },
  });
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  });
  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [salesChannel.id] },
  });

  // ---------- التوصيل ----------
  const { data: [shippingProfile] } = await query.graph({ entity: "shipping_profile", fields: ["id"] });
  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: `${S.location.name} — التوصيل`,
    type: "shipping",
    service_zones: [{ name: "سلطنة عُمان", geo_zones: [{ country_code: country, type: "country" }] }],
  });
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  });
  const baseRules = [
    { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
    { attribute: "is_return", value: "false", operator: "eq" as const },
  ];
  await createShippingOptionsWorkflow(container).run({
    input: S.shipping.map((sh) => ({
      name: sh.name,
      price_type: "flat" as const,
      provider_id: "manual_manual",
      service_zone_id: fulfillmentSet.service_zones[0].id,
      shipping_profile_id: shippingProfile.id,
      type: { label: sh.name, description: sh.desc, code: sh.code },
      // توصيل مجاني فوق حدّ معين (مصدر واحد مع seed-02)
      prices: shippingPrices(sh, cur, region.id),
      rules: baseRules,
    })),
  });

  // ---------- الأقسام / المجموعات / الوسوم ----------
  const { result: categories } = await createProductCategoriesWorkflow(container).run({
    input: { product_categories: data.categories.map((c) => ({ name: c.name, handle: c.handle, is_active: true })) },
  });
  const { result: collections } = await createCollectionsWorkflow(container).run({
    input: { collections: data.collections.map((c) => ({ title: c.title, handle: c.handle })) },
  });
  const { result: tags } = await createProductTagsWorkflow(container).run({
    input: { product_tags: data.tags.map((t) => ({ value: t.value, metadata: { label: t.label } })) },
  });

  // ---------- الخيارات (من store.options: مقاس/لون للأزياء، حجم للعطور، وزن/نكهة للحلويات…) ----------
  const optionDefs = data.options.filter((o) => data.products.some((p) => p.options?.[o.key]?.length));
  // كتالوج بلا خيارات (منتجات العناية بمتغيّر واحد): لا خيارات مشتركة
  const { result: options } = optionDefs.length
    ? await createProductOptionsWorkflow(container).run({
        input: {
          product_options: optionDefs.map((o) => ({
            title: o.title,
            values: [...new Set(data.products.flatMap((p) => p.options?.[o.key] ?? []))],
          })),
        },
      })
    : { result: [] as { id: string; title: string }[] };
  const optionId = (key: string) => options.find((o) => o.title === optionDefs.find((d) => d.key === key)!.title)!.id;

  // ---------- المنتجات ----------
  const stockBySku = new Map<string, number>();
  // كل تركيبات قيم خيارات المنتج (بترتيب store.options)
  const combos = (p: (typeof data.products)[number]) => {
    const keys = optionDefs.map((o) => o.key).filter((k) => p.options?.[k]?.length);
    return keys.reduce<Record<string, string>[]>(
      (acc, k) => acc.flatMap((c) => p.options[k].map((v) => ({ ...c, [k]: v }))),
      [{}]
    ).map((c) => ({ keys, values: c }));
  };
  // رمز المخزون: بادئة المنتج + قيمة الخيار الأول + رقم المتغيّر (فريد داخل المنتج)
  // لاتيني فقط (قيم الخيارات العربية لا تدخل الرمز): بادئة المنتج + قيمة لاتينية إن وُجدت + رقم المتغيّر
  const skuOf = (handle: string, head: string, vi: number) => {
    const latin = head.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
    return `${handle.replace(/-/g, "").toUpperCase().slice(0, 10)}-${latin || "V"}-${vi}`;
  };
  // كتالوج مستورد بالمئات: خرائط بدل البحث الخطي، والإنشاء على دفعات (معاملة واحدة لـ 1441 منتجاً تستنزف الذاكرة)
  const categoryId = new Map(categories.map((c) => [c.handle, c.id]));
  const collectionId = new Map(collections.map((c) => [c.handle, c.id]));
  const tagId = new Map(tags.map((t) => [t.value, t.id]));
  const toCreate = data.products.map((p) => {
    const list = combos(p);
    const first = list[0]?.keys[0];
    return {
      title: p.title,
      handle: p.handle,
      description: p.description,
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      category_ids: [categoryId.get(p.category)!],
      collection_id: p.collection ? collectionId.get(p.collection) : undefined,
      tag_ids: (p.tags ?? []).map((t) => tagId.get(t)!),
      images: p.images.map((url) => ({ url })),
      thumbnail: p.images[0],
      options: list[0]?.keys.map((k) => ({ id: optionId(k) })) ?? [],
      sales_channels: [{ id: salesChannel.id }],
      metadata: {
        compare_at_price: p.compare_at ?? null,
        rating: p.rating ?? null,
        reviews: p.reviews ?? null,
        sold_week: p.sold_week ?? null,
        complements: p.complements ?? [],
        // السطر اللاتيني تحت اسم المنتج (اختياري)
        title_en: p.title_en ?? null,
        // ترتيب عرض قيم الخيارات كما في store.json (Medusa لا يحفظ ترتيب المتغيّرات للواجهة)
        option_order: Object.fromEntries(optionDefs.filter((d) => p.options?.[d.key]?.length).map((d) => [d.title, p.options[d.key]])),
      },
      variants: list.map(({ keys, values }, vi) => {
        const head = first ? values[first] : "default";
        const titleOf = (k: string) => optionDefs.find((d) => d.key === k)!.title;
        const sku = p.sku && list.length === 1 ? p.sku : skuOf(p.handle, head, vi);
        stockBySku.set(sku, p.stock?.[head] ?? p.stock?.default ?? 10);
        return {
          title: keys.map((k) => values[k]).join(" / ") || p.title,
          sku,
          options: Object.fromEntries(keys.map((k) => [titleOf(k), values[k]])),
          manage_inventory: true,
          // M21: وزن الشحن بالجرام (المنتج ← القسم ← الافتراضي)
          weight: weightFor(p),
          prices: [{ amount: p.prices?.[head] ?? p.price, currency_code: cur }],
          metadata: { compare_at_price: p.compare_at ?? null },
        };
      }),
    };
  });
  const products: { id: string }[] = [];
  for (let i = 0; i < toCreate.length; i += 200) {
    const { result } = await createProductsWorkflow(container).run({ input: { products: toCreate.slice(i, i + 200) } });
    products.push(...result);
    if (toCreate.length > 200) logger.info(`Products ${products.length}/${toCreate.length}`);
  }

  // ---------- المخزون ----------
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
  });
  const levels = inventoryItems.map((item) => ({
    location_id: stockLocation.id,
    stocked_quantity: stockBySku.get(String(item.sku)) ?? 10,
    inventory_item_id: item.id,
  }));
  await createInventoryLevelsWorkflow(container).run({ input: { inventory_levels: levels } });

  logger.info(`Seeded ${products.length} products for "${S.name}".`);
  logger.info(`Publishable key: ${publishableApiKey.token}`);
}
