import { Readex_Pro } from "next/font/google"

// خط النص «readex-pro» — يُختار من store.json → fonts.body
export default Readex_Pro({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
})
