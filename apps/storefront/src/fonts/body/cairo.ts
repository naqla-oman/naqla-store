import { Cairo } from "next/font/google"

// خط النص «cairo» — يُختار من store.json → fonts.body
export default Cairo({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
})
