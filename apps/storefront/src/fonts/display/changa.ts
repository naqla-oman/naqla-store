import { Changa } from "next/font/google"

// خط العناوين «changa» — يُختار من store.json → fonts.display
const font = Changa({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
})

export default font
