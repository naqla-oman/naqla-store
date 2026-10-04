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

  /* ===== صفحة المنتج ===== */
  product: {
    // عناوين خيارات Medusa كما في data/<client>.json (options.size / options.color)
    optionTitles: { size: "المقاس", color: "اللون" },
    // ألوان العيّنات لكل اسم لون (تدرّج من لونين)
    swatches: {
      أسود: ["#1c1f1e", "#3b3f3d"],
      رملي: ["#e2cfb4", "#bf9f78"],
      زمردي: ["#0f4a3c", "#2a7a63"],
    } as Record<string, [string, string]>,
    lowStockAt: 3, // «بقي N فقط» عند هذا العدد أو أقل
    // حقل «طولك بالسنتيمتر» يظهر لهذه الأقسام ويُحفظ مع المنتج في السلة
    lengthField: { categories: ["abayas"], note: "تعديل الطول مجاناً" },
    // أزرار المشغل (تُفتح كرسالة واتساب) لهذه الأقسام
    atelier: { categories: ["abayas"] },
    // التقسيط: يبقى مخفياً حتى يُفعَّل مزوّده فعلياً في الدفع
    bnpl: { enabled: false, installments: 4, providers: ["tamara", "tabby"] },
    delivery: {
      timezone: "Asia/Muscat",
      cityLabel: "داخل مسقط",
      othersLabel: "بقية المحافظات خلال 48 ساعة",
    },
    perks: [
      { icon: "truck", text: "توصيل خلال ٢٤–٤٨ ساعة" },
      { icon: "refresh", text: "استبدال خلال ١٤ يوماً" },
      { icon: "shield", text: "دفع آمن عبر ثواني" },
      { icon: "gift", text: "تغليف هدايا مجاني" },
    ],
    craftNote: "تُخاط كل قطعة في مشغل ليان بمسقط.",
    shippingReturns:
      "التوصيل داخل مسقط خلال ٢٤ ساعة ولبقية المحافظات خلال ٤٨ ساعة. الاستبدال مجاني خلال ١٤ يوماً بشرط عدم الاستخدام وبقاء البطاقة.",
    // جدول المقاسات لكل قسم (اختياري)
    sizeGuides: {
      abayas: {
        head: ["المقاس", "الطول (سم)", "الصدر (سم)", "الكم (سم)"],
        rows: [
          ["50", "140", "100", "60"],
          ["52", "145", "104", "61"],
          ["54", "150", "108", "62"],
          ["56", "155", "112", "63"],
          ["58", "160", "116", "64"],
        ],
      },
      dresses: {
        head: ["المقاس", "الصدر (سم)", "الخصر (سم)", "الطول (سم)"],
        rows: [
          ["S", "88", "70", "138"],
          ["M", "94", "76", "140"],
          ["L", "100", "82", "142"],
          ["XL", "106", "88", "144"],
        ],
      },
    } as Record<string, { head: string[]; rows: string[][] }>,
  },
}

export type StoreConfig = typeof storeConfig
