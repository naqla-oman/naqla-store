import { Tenor_Sans } from "next/font/google"

// خط السطر اللاتيني «tenor-sans» — اختياري، يُختار من store.json → fonts.latin
const font = Tenor_Sans({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-latin",
  display: "swap",
})

export default font
