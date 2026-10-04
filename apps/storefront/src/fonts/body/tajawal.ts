import { Tajawal } from "next/font/google"

// خط النص «tajawal» — يُختار من store.json → fonts.body
export default Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-body",
  display: "swap",
})
