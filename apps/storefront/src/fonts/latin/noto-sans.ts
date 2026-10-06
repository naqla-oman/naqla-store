import { Noto_Sans } from "next/font/google"

// الخط اللاتيني المرافق لـ «رسمي متوازن» (Noto Sans Arabic بلا حروف لاتينية) — يُختار من presets → bodyLatin
const font = Noto_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-latin", display: "swap" })

export default font
