import { Alexandria } from "next/font/google"

// خط العناوين «alexandria» — يُختار من store.json → fonts.display
const font = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
})

export default font
