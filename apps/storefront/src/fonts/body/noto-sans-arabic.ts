import { Noto_Sans_Arabic } from "next/font/google"

// خط النص «noto-sans-arabic» — يُختار من store.json → fonts.body
export default Noto_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
})
