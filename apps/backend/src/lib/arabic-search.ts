/**
 * H10: تطبيع الإملاء العربي للبحث — «عبايه» = «عباية»، «اسود» = «أسود»، بلا تشكيل ولا «ال» التعريف.
 */
const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g // التشكيل والتطويل
export function normalizeAr(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    // «عباءة» = «عباية» (شائع في الخليج): «اء»/«اي» داخل الكلمة ← «ا» على الطرفين
    .replace(/(?<=\p{L})(اء|اي)/gu, "ا")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}
/** كلمات بعد التطبيع وحذف «ال» من أولها (و«بال/وال/لل» الشائعة) */
export function tokens(s: string): string[] {
  return normalizeAr(s)
    .split(" ")
    .map((w) => w.replace(/^(وال|بال|فال|كال|ال|لل)(?=.{2,})/, ""))
    .filter((w) => w.length > 1)
}
