/**
 * إعدادات المتجر — الملف الوحيد الذي يتغيّر من عميل لآخر في الواجهة.
 * (الألوان في styles/theme.css، والبيانات التجارية في Medusa)
 */
export const storeConfig = {
  name: "بوتيك ليان",
  nameEn: "Layan Boutique",
  shortName: "ليان",
  tagline: "عبايات وفساتين تُخاط بعناية في مسقط",
  description:
    "بوتيك عُماني للعبايات والفساتين بتصاميم حصرية تُخاط بعناية في مسقط، ونوصلها إلى بابك في كل محافظات السلطنة.",
  locale: "ar-OM",
  dir: "rtl" as const,
  currency: "omr",
  currencyLabel: "ر.ع",
  freeShippingOver: 20,
  cutoffHour: 15, // آخر موعد لطلبات اليوم (توصيل الغد)
  contact: {
    whatsapp: "96890000000",
    phone: "+968 9XXX XXXX",
    email: "hello@layan.om",
    address: "مسقط، الخوير — مجمع ليان",
    hours: "السبت – الخميس ١٠ص – ١٠م · الجمعة ٤م – ١٠م",
  },
  social: {
    instagram: "https://instagram.com/",
    snapchat: "https://snapchat.com/",
    tiktok: "https://tiktok.com/",
  },
  nav: [
    { label: "كل المنتجات", href: "/store" },
    { label: "عباءات", href: "/categories/abayas" },
    { label: "فساتين", href: "/categories/dresses" },
    { label: "أوشحة", href: "/categories/scarves" },
    { label: "حقائب", href: "/categories/bags" },
    { label: "العروض", href: "/collections/sale", accent: true },
  ],
  ticker: [
    "توصيل مجاني للطلبات فوق ٢٠ ر.ع",
    "استبدال مجاني خلال ١٤ يوماً",
    "خصم ١٠٪ على طلبك الأول بكود LAYAN10",
    "تطريز حصري لليان",
    "دفع آمن عبر ثواني",
  ],
  builtBy: { name: "نقلة للحلول الرقمية", url: "https://naqla.om" },
}

export type StoreConfig = typeof storeConfig
