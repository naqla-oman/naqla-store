/**
 * Naqla Store Platform — البذرة الأولى للمتجر (سلطنة عُمان)
 *
 * تُقرأ كل بيانات المتجر من data/<STORE_DATA>.json (افتراضياً layan.json)
 * بحيث يكون إنشاء متجر لعميل جديد = ملف JSON جديد فقط.
 *
 * يُنشئ: المتجر (OMR)، قناة البيع، مفتاح النشر، منطقة عُمان، ضريبة القيمة المضافة 5٪،
 * موقع المخزون (المشغل)، خيارات التوصيل (عادي/سريع/استلام)، الأقسام، المجموعات،
 * وسوم المناسبات، خيارات المقاس واللون، المنتجات بمتغيراتها وأسعارها ومخزونها.
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
import { readFileSync } from "node:fs";
import { join } from "node:path";

type StoreData = {
  store: {
    name: string;
    name_en: string;
    currency: string;
    vat_rate: number;
    country: string;
    location: { name: string; city: string; address: string };
    shipping: { code: string; name: string; desc: string; amount: number; free_over?: number }[];
  };
  categories: { handle: string; name: string }[];
  collections: { handle: string; title: string }[];
  tags: { value: string; label: string }[];
  options: { size: string; color: string };
  colors: string[];
  products: {
    handle: string; title: string; category: string; collection?: string | null;
    description: string; price: number; compare_at?: number | null; images: string[];
    sizes: string[]; colors: string[]; stock: Record<string, number>; tags: string[];
    rating: number; reviews: number; sold_week: number; complements: string[];
  }[];
};

export default async function initial_data_seed({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(ModuleRegistrationName.FULFILLMENT);
  const storeModuleService = container.resolve(Modules.STORE);

  const dataFile = process.env.STORE_DATA || "layan";
  const data: StoreData = JSON.parse(
    readFileSync(join(process.cwd(), "data", `${dataFile}.json`), "utf-8")
  );
  const { store: S } = data;
  const cur = S.currency;
  const country = S.country;

  logger.info(`Seeding store "${S.name}" from data/${dataFile}.json ...`);

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
      prices: [
        { currency_code: cur, amount: sh.amount },
        { region_id: region.id, amount: sh.amount },
        // توصيل مجاني فوق حدّ معين
        ...(sh.free_over
          ? [{ region_id: region.id, amount: 0, rules: [{ attribute: "item_total", operator: "gte" as const, value: sh.free_over }] }]
          : []),
      ],
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

  // ---------- الخيارات ----------
  const allSizes = [...new Set(data.products.flatMap((p) => p.sizes))];
  const { result: options } = await createProductOptionsWorkflow(container).run({
    input: {
      product_options: [
        { title: data.options.size, values: allSizes },
        { title: data.options.color, values: data.colors },
      ],
    },
  });
  const sizeOpt = options.find((o) => o.title === data.options.size)!;
  const colorOpt = options.find((o) => o.title === data.options.color)!;

  // ---------- المنتجات ----------
  const stockBySku = new Map<string, number>();
  const skuOf = (handle: string, size: string, ci: number) =>
    `${handle.replace(/-/g, "").toUpperCase().slice(0, 10)}-${size.replace(/\s/g, "")}-${ci}`;
  const { result: products } = await createProductsWorkflow(container).run({
    input: {
      products: data.products.map((p) => ({
        title: p.title,
        handle: p.handle,
        description: p.description,
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: shippingProfile.id,
        category_ids: [categories.find((c) => c.handle === p.category)!.id],
        collection_id: p.collection ? collections.find((c) => c.handle === p.collection)?.id : undefined,
        tag_ids: p.tags.map((t) => tags.find((x) => x.value === t)!.id),
        images: p.images.map((url) => ({ url })),
        thumbnail: p.images[0],
        options: [{ id: sizeOpt.id }, { id: colorOpt.id }],
        sales_channels: [{ id: salesChannel.id }],
        metadata: {
          compare_at_price: p.compare_at ?? null,
          rating: p.rating,
          reviews: p.reviews,
          sold_week: p.sold_week,
          complements: p.complements,
        },
        variants: p.sizes.flatMap((size) =>
          p.colors.map((color, ci) => ({
            title: `${size} / ${color}`,
            sku: (() => { const sku = skuOf(p.handle, size, ci); stockBySku.set(sku, p.stock?.[size] ?? 10); return sku; })(),
            options: { [data.options.size]: size, [data.options.color]: color },
            manage_inventory: true,
            prices: [{ amount: p.price, currency_code: cur }],
            metadata: { compare_at_price: p.compare_at ?? null },
          }))
        ),
      })),
    },
  });

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
