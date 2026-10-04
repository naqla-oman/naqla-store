import { Reem_Kufi } from "next/font/google"

// خط العناوين «reem-kufi» — يُختار من store.json → fonts.display
const font = Reem_Kufi({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
})

export default font
