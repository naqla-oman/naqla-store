/**
 * رقم بإشارة (+735 أو −2.850) معزول الاتجاه داخل نص عربي.
 * بدون العزل تُنقل الإشارة إلى الطرف الآخر في سياق RTL فتظهر «735+».
 * الوحدة (ر.ع، نقطة…) تبقى خارج العزل لتتبع اتجاه الجملة.
 */
export default function Signed({ value, sign, className }: { value: string | number; sign: "+" | "−"; className?: string }) {
  return (
    <bdi dir="ltr" className={className} style={{ whiteSpace: "nowrap" }}>
      {sign}
      {value}
    </bdi>
  )
}
