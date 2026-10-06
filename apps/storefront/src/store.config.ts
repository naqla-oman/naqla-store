/**
 * إعدادات المتجر — تُقرأ من clients/<STORE>/store.json (الاسم المستعار @client في next.config).
 * لا توجد هنا أي بيانات عميل: هذا الملف يحوّل store.json إلى الشكل الذي تستخدمه الواجهة،
 * ويطبّق مفاتيح التشغيل (features) في مكان واحد — ما يُطفأ يختفي من الواجهة كلياً.
 */
import raw from "@client/store.json"

type Option = { key: string; title: string; type: "buttons" | "color"; swatches?: Record<string, [string, string]> }
type Tier = { key: string; name: string; min: number; perk?: string }
type Link = { label: string; href: string; accent?: boolean }
type Features = {
  tailoring: boolean
  sizeGuide: boolean
  lengthField: boolean
  gift: boolean
  expressDelivery: boolean
  pickup: boolean
  loyalty: boolean
  loyaltyTiers: boolean
  cod: boolean
  thawani: boolean
  whatsappOrder: boolean
  bnpl: boolean
  reviews: boolean
}

type ClientStore = {
  slug: string
  /** المخاطبة: f مؤنث، m مذكر، neutral محايد */
  voice?: "f" | "m" | "neutral"
  name: string
  nameEn: string
  shortName: string
  tagline: string
  description: string
  locale: string
  dir: "rtl" | "ltr"
  country: string
  currency: string
  currencyLabel: string
  freeShippingOver: number
  cutoffHour: number
  /** M15: ضريبة القيمة المضافة المضمَّنة في الأسعار (٪) */
  taxRate?: number
  /** M13: أيام بلا توصيل سريع (0=الأحد … 5=الجمعة) */
  deliveryOffDays?: number[]
  orderPrefix: string
  /** مدة الإرجاع بالأيام (تدخل في hasMerchantReturnPolicy للسيو) */
  returnDays?: number
  shipping: { code: string; name: string; amount: number; free_over?: number; provinces?: string[] }[]
  location: { name: string; city: string; address: string; province?: string; wilayat?: string }
  fonts: { display: string; body: string; latin?: string }
  /** الشعار: wordmark = الكلمة كاملة في الملف (تُعرض وحدها)، وإلا علامة مربعة + الاسم نصاً */
  brand?: { logo?: string; logoDark?: string; logoOnDark?: string; wordmark?: boolean }
  defaultTheme?: "light" | "dark"
  icons?: { icon192?: string; icon512?: string; maskable?: string; apple?: string; svg?: string }
  /** زخرفة فاصلة اختيارية بين أقسام الرئيسية وأسفل الفوتر */
  decor?: { type: "wave"; color: string } | null
  colors: { theme: string; background: string }
  contact: { whatsapp: string; phone: string; email: string; address: string; hours: string }
  social: Record<string, string>
  nav: Link[]
  searchPlaceholder?: string
  ticker: string[]
  welcomeCode?: { code: string; text: string } | null
  home: {
    hero: { kicker: string; title: string[]; text: string; image: string; primary: Link; secondary?: Link }
    tiles: { image: string; title: string; text: string; href: string }[]
    trust: { icon: string; title: string; text: string }[]
    collectionsOrder: string[]
  }
  features: Partial<Features>
  options: Option[]
  loyalty: { pointsPerUnit: number; redeemPoints: number; redeemValue: number; tiers: Tier[] }
  checkout: {
    /** M18: ولايات كل محافظة (قائمة بدل نص حر) */
    governorates: { code: string; name: string; wilayats?: string[] }[]
    phone: { prefix: string; pattern: string; placeholder: string }
    shipping: Record<string, { icon: string; eta: string }>
    giftNote: string
  }
  tailoring?: {
    handle: string
    title: string
    services: { key: string; title: string; price: number; categories: string[] }[]
    measurements: { key: string; label: string }[]
  }
  product: {
    lowStockAt: number
    /** نص التوفر تحت زر الشراء (مثل «متوفر في المشغل — جرّبيها قبل الشراء») */
    availability?: { inStock: string; outOfStock: string }
    lengthField?: { categories: string[]; note: string }
    atelier?: { categories: string[] }
    bnpl?: { installments: number; providers: string[] }
    delivery: { timezone: string; cityLabel: string; othersLabel: string }
    perks: { icon: string; text: string }[]
    craftNote?: string
    shippingReturns: string
    sizeGuides?: Record<string, { head: string[]; rows: string[][] }>
  }
}

/** ملف من مجلد العميل (images/…، icons/…، logo.svg، og.jpg) يُقدَّم عبر /client-assets */
export const clientAsset = (p: string) => (/^https?:\/\//.test(p) ? p : `/client-assets/${p.replace(/^\/+/, "")}`)

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
/** دمج عميق مطابق للخادم: الكائنات تُدمج، والمصفوفات والقيم تُستبدل */
function deepMerge<T>(base: T, over: Record<string, unknown>): T {
  if (!isObj(base)) return base
  const out: Record<string, unknown> = { ...(base as any) }
  for (const [k, v] of Object.entries(over ?? {})) out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v
  return out as T
}

/** يبني إعداد الواجهة من store.json بعد دمج إعدادات اللوحة (وحدة store-settings في الخادم) */
function build(c: ClientStore) {
  const on = (k: keyof Features) => c.features?.[k] === true

  /** طرق الدفع المدعومة في المنصة — تظهر فقط إن فُعّلت في store.json وفي منطقة Medusa */
  const PAYMENTS = [
    { id: "pp_thawani_thawani", key: "thawani", feature: "thawani" as const, icon: "card", title: "الدفع الإلكتروني عبر ثواني", desc: "بطاقة بنكية، Apple Pay أو محفظة ثواني", cta: c.voice === "f" ? "ادفعي الآن" : "ادفع الآن", logos: ["visa.svg", "mastercard.svg", "applepay.svg", "thawani.png"] },
    { id: "pp_cod_offline", key: "cod", feature: "cod" as const, icon: "cash", title: "الدفع عند الاستلام", desc: "نقداً أو ببطاقة عند وصول المندوب", cta: "تأكيد الطلب" },
    { id: "pp_whatsapp_offline", key: "whatsapp", feature: "whatsappOrder" as const, icon: "whatsapp", title: "إرسال الطلب عبر واتساب", desc: "نؤكد معك الطلب والدفع على واتساب", cta: "إرسال عبر واتساب" },
  ]


  /** عملات كل مزوّد تقسيط (يُتحقق من العقد عند التفعيل) */
  const BNPL_CURRENCIES: Record<string, string[]> = { tabby: ["sar", "aed", "kwd"], tamara: ["sar", "aed", "kwd", "bhd"] }
  const bnplProviders: string[] = ((c.product as any).bnpl?.providers ?? []).filter((p: string) =>
    (BNPL_CURRENCIES[p.toLowerCase()] ?? []).includes(String(c.currency).toLowerCase())
  )

  return {
    /** اللغات: العربية الأصل؛ الإنجليزية طبقة فوقها إن فُعّلت (المبدّل وروابط /en تظهر فقط عندها) */
    languages: ((c as any).languages?.length ? (c as any).languages : ["ar"]) as string[],
    defaultLanguage: ((c as any).defaultLanguage ?? "ar") as string,
    /** الهوية من «إعدادات المتجر»: لوحة/خط مختاران (يوجدان فقط إن خالفا الافتراضي) */
    theme: ((c as any).theme ?? {}) as { palette?: string; font?: string },
    /** السجل التجاري والرقم الضريبي (إعدادات المتجر ← بيانات المتجر) */
    legal: ((c as any).legal ?? {}) as { cr?: string | null; vat?: string | null },
    slug: c.slug,
    voice: (c.voice ?? "neutral") as "f" | "m" | "neutral",
    name: c.name,
    nameEn: c.nameEn,
    shortName: c.shortName,
    tagline: c.tagline,
    description: c.description,
    locale: c.locale,
    dir: c.dir,
    currency: c.currency,
    currencyLabel: c.currencyLabel,
    freeShippingOver: c.freeShippingOver,
    cutoffHour: c.cutoffHour,
    taxRate: c.taxRate ?? 5,
    deliveryOffDays: c.deliveryOffDays ?? [5],
    colors: c.colors,
    defaultTheme: c.defaultTheme ?? "light",
    brand: {
      logo: c.brand?.logo ?? "logo.svg",
      logoDark: c.brand?.logoDark ?? c.brand?.logo ?? "logo.svg",
      // الفوتر داكن في الوضعين: نسخة للأرضية الداكنة إن وُجدت
      logoOnDark: c.brand?.logoOnDark ?? c.brand?.logoDark ?? c.brand?.logo ?? "logo.svg",
      wordmark: c.brand?.wordmark === true,
    },
    icons: {
      icon192: c.icons?.icon192 ?? "icons/icon-192.png",
      icon512: c.icons?.icon512 ?? "icons/icon-512.png",
      maskable: c.icons?.maskable ?? c.icons?.icon512 ?? "icons/icon-512.png",
      apple: c.icons?.apple ?? c.icons?.icon192 ?? "icons/icon-192.png",
      svg: c.icons?.svg ?? null,
    },
    decor: c.decor ?? null,
    contact: c.contact,
    social: c.social,
    nav: c.nav,
    searchPlaceholder: c.searchPlaceholder ?? "ابحث في المتجر…",
    ticker: c.ticker,
    welcomeCode: c.welcomeCode ?? null,
    home: c.home,
    builtBy: { name: "نقلة للحلول الرقمية", url: "https://naqla.tech" },
    // للسيو (JSON-LD): التوصيل حسب مفاتيح التشغيل، والإرجاع، والمحل
    seo: {
      returnDays: c.returnDays ?? 0,
      shipping: c.shipping.filter((sh) => !(sh.code === "express" && !on("expressDelivery")) && !(sh.code === "pickup" && !on("pickup"))),
      location: c.location,
      country: c.country,
    },

    features: {
      tailoring: on("tailoring"),
      sizeGuide: on("sizeGuide"),
      lengthField: on("lengthField"),
      gift: on("gift"),
      expressDelivery: on("expressDelivery"),
      pickup: on("pickup"),
      loyalty: on("loyalty"),
      loyaltyTiers: on("loyalty") && on("loyaltyTiers"),
      whatsappOrder: on("whatsappOrder"),
      bnpl: on("bnpl") && bnplProviders.length > 0,
      reviews: on("reviews"),
    },

    /** خيارات المنتج لنشاط العميل بترتيبها (المقاس/اللون، الحجم، الوزن/النكهة…) */
    options: c.options,

    loyalty: {
      /** أول مستوى بتوصيل مجاني دائماً (لتلميح الدخول في الدفع) — فقط إن كانت المستويات مفعّلة */
      freeShippingTier: on("loyalty") && on("loyaltyTiers") ? c.loyalty.tiers.find((t) => (t as any).freeShipping) ?? null : null,
      pointsPerUnit: c.loyalty.pointsPerUnit,
      redeemPoints: c.loyalty.redeemPoints,
      redeemValue: c.loyalty.redeemValue,
      // نص الامتياز يُعرض فقط إن وُجد (أي إن كان مطبَّقاً فعلاً)، والمستويات تُطفأ بمفتاحها
      /** كود عرض كل مستوى ← اسمه (لتسمية سطر الخصم «امتياز ماسية») */
      tierPromoNames: Object.fromEntries(c.loyalty.tiers.filter((t) => (t as any).promoCode).map((t) => [String((t as any).promoCode).toUpperCase(), t.name])) as Record<string, string>,
      tierPerks: Object.fromEntries(c.loyalty.tiers.map((t) => [t.key, on("loyaltyTiers") ? t.perk ?? "" : t.min === 0 ? t.perk ?? "" : ""])) as Record<string, string>,
    },

    /** التفصيل الخاص (features.tailoring) + خصم المستوى عليه إن وُجد */
    tailoring: on("tailoring") && c.tailoring
      ? {
          ...c.tailoring,
          discountTier: on("loyalty") && on("loyaltyTiers")
            ? (c.loyalty.tiers.find((t) => (t as any).tailoringDiscount) as (Tier & { tailoringDiscount: number }) | undefined) ?? null
            : null,
        }
      : null,

    checkout: {
      orderPrefix: c.orderPrefix,
      governorates: c.checkout.governorates,
      phone: c.checkout.phone,
      shipping: c.checkout.shipping,
      payments: PAYMENTS.filter((p) => on(p.feature)),
      giftNote: c.checkout.giftNote,
    },

    product: {
      lowStockAt: c.product.lowStockAt,
      availability: c.product.availability ?? { inStock: "متوفر", outOfStock: "سنعيد توفيره قريباً" },
      lengthField: on("lengthField") && c.product.lengthField ? c.product.lengthField : { categories: [] as string[], note: "" },
      atelier: on("tailoring") && c.product.atelier ? c.product.atelier : { categories: [] as string[] },
      // منخفضة: مزوّدو التقسيط حسب عملة المتجر (تابي وتمارا لا يدعمان الريال العُماني) — يُفعَّل فقط إن بقي مزوّد يدعمها
      bnpl: { enabled: on("bnpl") && bnplProviders.length > 0, installments: c.product.bnpl?.installments ?? 4, providers: bnplProviders },
      delivery: c.product.delivery,
      perks: c.product.perks,
      craftNote: c.product.craftNote ?? "",
      shippingReturns: c.product.shippingReturns,
      sizeGuides: (on("sizeGuide") ? c.product.sizeGuides ?? {} : {}) as Record<string, { head: string[]; rows: string[][] }>,
    },
  }
}

let current = build(raw as ClientStore)
let currentKey = "{}"

/** إعدادات اللوحة: الخادم يمررها من التخطيط الجذري (وسم store-settings)، والمتصفح من window.__NAQLA_SETTINGS__ */
export function applyStoreOverrides(o: Record<string, unknown> | null | undefined) {
  const key = JSON.stringify(o ?? {})
  if (key === currentKey) return
  currentKey = key
  current = build(deepMerge(raw as ClientStore, (o ?? {}) as Record<string, unknown>))
}
if (typeof window !== "undefined" && (window as any).__NAQLA_SETTINGS__) applyStoreOverrides((window as any).__NAQLA_SETTINGS__)

/** القيمة الحالية دائماً (Proxy): كل الاستخدامات القائمة storeConfig.x تبقى كما هي */
export const storeConfig = new Proxy({} as ReturnType<typeof build>, {
  get: (_t, k) => (current as any)[k],
  has: (_t, k) => k in current,
  ownKeys: () => Reflect.ownKeys(current),
  getOwnPropertyDescriptor: (_t, k) => ({ ...Object.getOwnPropertyDescriptor(current, k), configurable: true }),
})

export type StoreConfig = ReturnType<typeof build>
