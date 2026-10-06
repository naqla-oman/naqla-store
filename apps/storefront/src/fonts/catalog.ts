import { Alexandria, Almarai, Cairo, Changa, El_Messiri, IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic, Noto_Sans_Arabic, Readex_Pro, Reem_Kufi, Tajawal, Tenor_Sans } from "next/font/google"

/**
 * كتالوج الخطوط لتبويب «الهوية»: كل عائلة بمتغير --ff-<slug> وpreload:false — المتصفح لا يحمّل
 * إلا الخط المستخدم فعلاً. الزوج المختار يُربط بـ --font-display/--font-body/--font-latin في التخطيط.
 * (مولَّد من ملفات src/fonts بنفس الأوزان والمجموعات)
 */
const alexandria = Alexandria({ subsets: ["arabic", "latin"], weight: ["500", "600", "700", "800"], variable: "--ff-alexandria", display: "swap", preload: false })
const almarai = Almarai({ subsets: ["arabic", "latin"], weight: ["300", "400", "700"], variable: "--ff-almarai", display: "swap", preload: false })
const cairo = Cairo({ subsets: ["arabic", "latin"], weight: ["300", "400", "500", "600", "700"], variable: "--ff-cairo", display: "swap", preload: false })
const changa = Changa({ subsets: ["arabic", "latin"], weight: ["500", "600", "700", "800"], variable: "--ff-changa", display: "swap", preload: false })
const el_messiri = El_Messiri({ subsets: ["arabic", "latin"], weight: ["500", "600", "700"], variable: "--ff-el-messiri", display: "swap", preload: false })
const ibm_plex_sans_arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["300", "400", "500", "600", "700"], variable: "--ff-ibm-plex-sans-arabic", display: "swap", preload: false })
const noto_kufi_arabic = Noto_Kufi_Arabic({ subsets: ["arabic", "latin"], weight: ["500", "600", "700", "800"], variable: "--ff-noto-kufi-arabic", display: "swap", preload: false })
const noto_sans_arabic = Noto_Sans_Arabic({ subsets: ["arabic"], weight: ["300", "400", "500", "600", "700"], variable: "--ff-noto-sans-arabic", display: "swap", preload: false })
const readex_pro = Readex_Pro({ subsets: ["arabic", "latin"], weight: ["300", "400", "500", "600", "700"], variable: "--ff-readex-pro", display: "swap", preload: false })
const reem_kufi = Reem_Kufi({ subsets: ["arabic", "latin"], weight: ["500", "600", "700"], variable: "--ff-reem-kufi", display: "swap", preload: false })
const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["300", "400", "500", "700"], variable: "--ff-tajawal", display: "swap", preload: false })
const tenor_sans = Tenor_Sans({ subsets: ["latin"], weight: ["400"], variable: "--ff-tenor-sans", display: "swap", preload: false })

export const FONT_CATALOG: Record<string, { variable: string }> = {
  "alexandria": alexandria,
  "almarai": almarai,
  "cairo": cairo,
  "changa": changa,
  "el-messiri": el_messiri,
  "ibm-plex-sans-arabic": ibm_plex_sans_arabic,
  "noto-kufi-arabic": noto_kufi_arabic,
  "noto-sans-arabic": noto_sans_arabic,
  "readex-pro": readex_pro,
  "reem-kufi": reem_kufi,
  "tajawal": tajawal,
  "tenor-sans": tenor_sans,
}
/** كل أصناف المتغيرات لوضعها على <html> */
export const FONT_CATALOG_CLASSES = Object.values(FONT_CATALOG).map((f) => f.variable).join(" ")
