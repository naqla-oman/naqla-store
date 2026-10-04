import { Almarai } from "next/font/google"

// خط النص «almarai» — يُختار من store.json → fonts.body
export default Almarai({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "700"],
  variable: "--font-body",
  display: "swap",
})
