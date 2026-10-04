"use client"

/** يعيد فتح شريط الموافقة لتغيير الاختيار */
export default function PrivacyLink() {
  return (
    <button type="button" className="linkbtn" style={{ color: "inherit", fontSize: "inherit" }} onClick={() => window.dispatchEvent(new Event("open-consent"))}>
      إعدادات الخصوصية
    </button>
  )
}
