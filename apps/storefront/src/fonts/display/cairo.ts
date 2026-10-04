import { Cairo } from "next/font/google"

// خط العناوين «cairo» — يُختار من store.json → fonts.display
const font = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
})

export default font
