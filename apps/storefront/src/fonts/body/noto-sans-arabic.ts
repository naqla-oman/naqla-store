import { Noto_Sans_Arabic } from "next/font/google"

// خط النص «noto-sans-arabic» — يُختار من store.json → fonts.body
const font = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
})

export default font
