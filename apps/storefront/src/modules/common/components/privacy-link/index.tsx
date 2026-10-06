"use client"
import { useT } from "@/i18n/t"

/** يعيد فتح شريط الموافقة لتغيير الاختيار */
export default function PrivacyLink() {
  const t = useT("layout")
  return (
    <button type="button" className="linkbtn" style={{ color: "inherit", fontSize: "inherit" }} onClick={() => window.dispatchEvent(new Event("open-consent"))}>
      {t("privacySettings")}
    </button>
  )
}
