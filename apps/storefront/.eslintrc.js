module.exports = {
  extends: ["next/core-web-vitals"],
  // منخفضة: في monorepo يحتاج الإضافة جذر التطبيق؛ وno-html-link-for-pages خاص بـ pages/ (المتجر App Router)
  settings: { next: { rootDir: __dirname } },
  rules: { "@next/next/no-html-link-for-pages": "off" },
}
