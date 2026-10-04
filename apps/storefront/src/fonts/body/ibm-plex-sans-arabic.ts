import { IBM_Plex_Sans_Arabic } from "next/font/google"

// خط النص «ibm-plex-sans-arabic» — يُختار من store.json → fonts.body
const font = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
})

export default font
