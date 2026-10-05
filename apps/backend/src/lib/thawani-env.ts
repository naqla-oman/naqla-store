/**
 * M12: شرط تحميل ثواني — مصدر واحد لـ medusa-config ومزامنة مزوّدي المناطق.
 * ملف بلا استيرادات: medusa-config يحمّله قبل جاهزية الإطار.
 */
export const thawaniConfigured = () =>
  process.env.THAWANI_ENABLED === "true" && !!process.env.THAWANI_SECRET_KEY && !!process.env.THAWANI_PUBLISHABLE_KEY
