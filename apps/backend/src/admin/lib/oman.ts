/** محافظات سلطنة عُمان (ISO 3166-2:OM) — تطابق رموز المحافظة في عناوين الطلبات */
export const GOVERNORATES: Record<string, string> = {
  "om-ma": "مسقط",
  "om-zu": "ظفار",
  "om-bs": "شمال الباطنة",
  "om-bj": "جنوب الباطنة",
  "om-da": "الداخلية",
  "om-ss": "شمال الشرقية",
  "om-sj": "جنوب الشرقية",
  "om-za": "الظاهرة",
  "om-bu": "البريمي",
  "om-mu": "مسندم",
  "om-wu": "الوسطى",
}

export const SHIPPING: Record<string, string> = {
  standard: "توصيل عادي",
  express: "توصيل سريع (مسقط)",
  pickup: "استلام من المشغل",
}

export const PAYMENT: Record<string, string> = {
  cod: "الدفع عند الاستلام",
  whatsapp: "عبر واتساب",
  thawani: "ثواني (إلكتروني)",
}
