import { Noto_Kufi_Arabic } from "next/font/google"

// خط العناوين «noto-kufi-arabic» — يُختار من store.json → fonts.display
export default Noto_Kufi_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
})
