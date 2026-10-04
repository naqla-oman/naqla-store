import { El_Messiri } from "next/font/google"

// خط العناوين «el-messiri» — يُختار من store.json → fonts.display
const font = El_Messiri({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
})

export default font
