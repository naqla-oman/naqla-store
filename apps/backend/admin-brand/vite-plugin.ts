/** جزء إضافة Vite الذي نستخدمه (يُعرَّف هنا لتجنّب استيراد أنواع vite بصيغة ESM في إعدادات CommonJS) */
type HtmlTag = { tag: string; attrs?: Record<string, string>; children?: string; injectTo?: "head" | "head-prepend" | "body" }
type Plugin = { name: string; transformIndexHtml: (html: string) => { html: string; tags: HtmlTag[] } }

/**
 * هوية «لوحة نقلة» على لوحة Medusa دون نسخ كودها — كل التعديلات في رأس الصفحة فقط:
 *  - العنوان والأيقونة، خط IBM Plex Sans Arabic، ألوان نقلة عبر متغيرات @medusajs/ui (لا المكوّنات)
 *  - العربية افتراضياً (localStorage.lng) ما لم يختر المستخدم لغة
 *  - إخفاء شعار Medusa في الدخول، وهوية نقلة + شعار العميل في رأس القائمة
 *  - عنوان المتبويب: Medusa يضيف « - Medusa» نصاً ثابتاً، فيُستبدل بـ«لوحة نقلة»
 * عند تحديث Medusa: راجعي المحدِّدات في BRAND_CSS فقط (مُعلَّمة بـ «محدِّد»).
 */
const NAVY = "#041B3F"
const TEAL = "#03635E"
const TEAL_HOVER = "#024E4A"
const TEAL_LIGHT = "#0E9E9F"

const BRAND_CSS = `
/* ---- الخط ---- */
html, body, body *:not(code):not(pre):not(.font-mono) { font-family: "IBM Plex Sans Arabic", "Inter", system-ui, sans-serif !important; }

/* ---- ألوان نقلة (متغيرات @medusajs/ui) — تحديد أعلى لأن app.css يُحمَّل بعد هذا الوسم ---- */
html:root, html.light:root {
  --bg-interactive: ${TEAL};
  --fg-interactive: ${TEAL};
  --fg-interactive-hover: ${TEAL_LIGHT};
  --border-interactive: ${TEAL};
  --borders-interactive-with-active: 0px 0px 0px 4px rgba(3, 99, 94, 0.2), 0px 0px 0px 1px ${TEAL};
  --button-inverted: ${TEAL};
  --button-inverted-hover: ${TEAL_HOVER};
  --button-inverted-pressed: #023B38;
  --bg-highlight: #E7F4F3;
  --bg-highlight-hover: #D2ECEA;
  --fg-base: ${NAVY};
}
html.dark:root, html:root .dark {
  --bg-interactive: ${TEAL_LIGHT};
  --fg-interactive: #3CC2C2;
  --fg-interactive-hover: #6FD6D5;
  --border-interactive: ${TEAL_LIGHT};
  --button-inverted: ${TEAL};
  --button-inverted-hover: ${TEAL_LIGHT};
  --bg-highlight: #0B3533;
}

/* ---- الدخول: إخفاء شعار Medusa (محدِّد: أول صندوق في نموذج الدخول يحوي svg) ---- */
.max-w-\\[280px\\] > div:first-child:has(> svg), .max-w-\\[280px\\] > div:first-child:has(svg):not(:has(img)) { display: none !important; }

/* ---- رأس القائمة: هوية نقلة فوق اسم المتجر (محدِّد: aside .sticky.top-0) ---- */
aside .sticky.top-0::before {
  content: ""; display: block; height: 34px; margin: 14px 14px 2px;
  background: url(/naqla-brand/logo-horizontal.png) no-repeat right center / contain;
}
.dark aside .sticky.top-0::before { background-image: url(/naqla-brand/logo-horizontal-white.png); }
/* شعار العميل الصغير بدل الحرف الأول (محدِّد: زر قائمة المتجر في الرأس) */
aside .sticky.top-0 button[aria-haspopup="menu"] > span:first-child > span {
  font-size: 0 !important; background: url(/naqla-brand/client-logo.png) center / cover no-repeat !important;
}

/* M29: روابط توثيق Medusa لا تظهر لعملاء لوحة نقلة (الدعم من نقلة) */
a[href*="docs.medusajs.com"], a[href*="medusajs.com/"] { display: none !important; }
`

// String.raw: الشرطات العكسية في التعابير النمطية تبقى كما هي (`\s` في قالب عادي تصبح «s» فتفشل المطابقة)
const HEAD_SCRIPT = String.raw`
(function () {
  // H8: اللوحة لا تعمل داخل إطار (clickjacking). الترويسات الكاملة يضيفها Caddy لـ /app لأن Medusa يقدّم اللوحة خارج middlewares
  if (window.top !== window.self) {
    try { window.top.location.replace(window.self.location.href); } catch (e) { document.documentElement.style.display = "none"; }
    return;
  }
  try {
    if (!localStorage.getItem("lng") && document.cookie.indexOf("i18next=") < 0) localStorage.setItem("lng", "ar");
  } catch (e) {}
  var fix = function () {
    var t = document.title;
    if (t.indexOf("Medusa") < 0) return;
    var base = t.replace(/\s*-\s*Medusa\s*$/, "");
    // «مرحباً بك في لوحة نقلة» لا تحتاج لاحقة، وغيرها: «الطلبات — لوحة نقلة»
    var next = base.indexOf("لوحة نقلة") >= 0 ? base : (base && base !== "Medusa" ? base + " — لوحة نقلة" : "لوحة نقلة");
    // حارس: لا كتابة إلا عند تغيّر فعلي (وإلا يعيد المراقب استدعاء الدالة بلا نهاية)
    if (next !== t) document.title = next;
  };
  new MutationObserver(fix).observe(document.head, { childList: true, subtree: true, characterData: true });
  fix();

  // عملات الخليج: Intl بلغة متصفح إنجليزية يعطي «OMR» رمزاً مختصراً فتظهر «OMR 10.000 OMR».
  // نغلّف Intl.NumberFormat لهذه العملات فقط (style=currency + narrowSymbol) ليظهر رمزها العربي.
  // النقطة هنا U+2024 (․) لا «.»: Medusa يحذف [.,] من الرمز فتصير «ر.ع.» «رع»
  var SYM = { OMR: "ر\u2024ع\u2024", SAR: "ر\u2024س", AED: "د\u2024إ", KWD: "د\u2024ك", BHD: "د\u2024ب", QAR: "ر\u2024ق" };
  var NF = Intl.NumberFormat;
  var Wrapped = function (locales, opts) {
    var f = new NF(locales, opts);
    var code = opts && opts.style === "currency" && opts.currencyDisplay === "narrowSymbol" && String(opts.currency || "").toUpperCase();
    if (!code || !SYM[code] || f.format(0).indexOf(code) < 0) return f;
    // format في Intl.NumberFormat خاصية getter فقط على النموذج: الإسناد العادي يفشل بصمت، لذا defineProperty
    var w = Object.create(f);
    var def = function (k, fn) { Object.defineProperty(w, k, { value: fn, configurable: true }); };
    def("format", function (n) { return f.format(n).replace(code, SYM[code]); });
    def("formatToParts", function (n) { return f.formatToParts(n).map(function (p) { return p.type === "currency" ? { type: p.type, value: SYM[code] } : p; }); });
    def("resolvedOptions", function () { return f.resolvedOptions(); });
    return w;
  };
  Wrapped.prototype = NF.prototype;
  Wrapped.supportedLocalesOf = NF.supportedLocalesOf;
  Intl.NumberFormat = Wrapped;

  // نصوص ثابتة خارج الترجمة (من @medusajs/ui وإضافة المسودات): تُستبدل عند التطابق التام فقط
  var TEXT = { "Not fulfilled": "غير منفّذ", "Fulfilled": "منفّذ", "Partially fulfilled": "منفّذ جزئياً", "Shipped": "تم الشحن", "Partially shipped": "شُحن جزئياً", "Delivered": "تم التسليم", "Partially delivered": "سُلِّم جزئياً", "Canceled": "ملغى", "Returned": "مُرتجع", "Partially returned": "مُرتجع جزئياً", "Not paid": "غير مدفوع", "Awaiting": "بانتظار الدفع", "Authorized": "مفوَّض", "Partially authorized": "مفوَّض جزئياً", "Captured": "مُحصَّل", "Partially captured": "مُحصَّل جزئياً", "Refunded": "مُسترد", "Partially refunded": "مُسترد جزئياً", "Requires action": "يتطلب إجراء", "Pending": "معلّق", "Completed": "مكتمل", "Draft": "مسودة", "Archived": "مؤرشف", "Items": "المنتجات", "Shipping from": "الشحن من", "Manual": "يدوي", "Tracking": "التتبّع", "Oman": "عُمان", "Omani Rial": "ريال عُماني", "Drafts": "المسودات", "Show password": "إظهار كلمة المرور", "Hide password": "إخفاء كلمة المرور" };
  // H16: روابط ملفات التصدير الخاصة ← مسار التنزيل المحمي (الملف ليس في static)
  var PRIV = /\/static\/[^\/]+\/(private-[A-Za-z0-9._-]+)/;
  var fixLinks = function (root) {
    if (!root.querySelectorAll) return;
    var links = root.querySelectorAll('a[href*="/private-"]');
    for (var i = 0; i < links.length; i++) {
      var m = links[i].getAttribute("href").match(PRIV);
      if (m) links[i].setAttribute("href", "/admin/naqla/files/" + m[1]);
    }
  };
  var swap = function (node) {
    if (node.nodeType === 1) fixLinks(node);
    if (node.nodeType === 3) { var v = TEXT[node.nodeValue.trim()]; if (v) node.nodeValue = v; return; }
    if (node.nodeType !== 1) return;
    var it = document.createTreeWalker(node, 4), t;
    while ((t = it.nextNode())) { var r = TEXT[t.nodeValue.trim()]; if (r) t.nodeValue = r; }
  };
  var start = function () {
    swap(document.body);
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === "characterData") swap(m.target);
        for (var j = 0; j < m.addedNodes.length; j++) swap(m.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
`

export function naqlaAdminBrand(): Plugin {
  return {
    name: "naqla-admin-brand",
    transformIndexHtml(html: string): { html: string; tags: HtmlTag[] } {
      return {
        html: html.replace(/<title>[\s\S]*?<\/title>/, "<title>لوحة نقلة</title>").replace(/<link[^>]+rel="icon"[^>]*>/g, "")
          // M30: إعلان الترميز المتأخر يُحذف (إعلان واحد فقط مسموح، والمحقون أول الرأس)
          .replace(/<meta[^>]+http-equiv="Content-Type"[^>]*>/gi, "")
          .replace(/<meta[^>]+charset=[^>]*>/gi, ""),
        tags: [
          { tag: "link", attrs: { rel: "icon", type: "image/png", sizes: "32x32", href: "/naqla-brand/favicon-32.png" }, injectTo: "head" },
          { tag: "link", attrs: { rel: "icon", type: "image/png", sizes: "16x16", href: "/naqla-brand/favicon-16.png" }, injectTo: "head" },
          { tag: "link", attrs: { rel: "apple-touch-icon", href: "/naqla-brand/apple-touch-icon.png" }, injectTo: "head" },
          { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "anonymous" }, injectTo: "head" },
          // الخط لا يحجب العرض: يُحمَّل كـ print ثم يُفعَّل عند وصوله (شبكة بطيئة/محجوبة لا تعطّل اللوحة)
          { tag: "link", attrs: { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap", media: "print", onload: "this.media='all'" }, injectTo: "head" },
          { tag: "meta", attrs: { name: "theme-color", content: TEAL }, injectTo: "head" },
          { tag: "style", attrs: { id: "naqla-brand" }, children: BRAND_CSS, injectTo: "head" },
          // M30: الترميز أول ما في الرأس (المتصفح يبحث عنه في أول 1024 بايت فقط) — قبل السكربت العربي (~5KB)
          { tag: "meta", attrs: { charset: "utf-8" }, injectTo: "head-prepend" },
          { tag: "script", children: HEAD_SCRIPT, injectTo: "head-prepend" },
        ],
      }
    },
  }
}
