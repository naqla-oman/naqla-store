import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Icon from "@modules/common/components/icon"
import Ticker from "@modules/layout/components/ticker"
import { storeConfig as c } from "../../../../store.config"

const Hero = () => {
  return (
    <div className="wrap">
      <section className="hero">
        <div className="hero-main">
          <Image src="/img/hero-1.jpg" alt="" fill priority sizes="(max-width: 900px) 100vw, 60vw" />
          <div className="hc">
            <span className="kicker"><Icon name="sparkle" size={14} /> تشكيلة الشتاء ٢٠٢٦ وصلت</span>
            <h1>عبايات تُخاط لكِ<br />بروح مسقط</h1>
            <p>{c.tagline} — قصّات حصرية، أقمشة مختارة، وتعديل مجاني للطول عند الشراء.</p>
            <div className="acts">
              <LocalizedClientLink href="/store" className="btn lg copper">تسوّقي التشكيلة <Icon name="arrowL" size={16} /></LocalizedClientLink>
              <LocalizedClientLink href="/categories/abayas" className="btn lg ghost !bg-white/10 !text-white !border-white/25">العبايات الجديدة</LocalizedClientLink>
            </div>
          </div>
        </div>
        <LocalizedClientLink href="/collections/sale" className="hero-side">
          <Image src="/img/lk-2.jpg" alt="" fill sizes="(max-width: 900px) 100vw, 35vw" />
          <div className="hc"><b>العروض</b><span>خصومات حتى ٢٣٪ على قطع مختارة</span></div>
        </LocalizedClientLink>
        <LocalizedClientLink href="/categories/bags" className="hero-side">
          <Image src="/img/n-bag3.jpg" alt="" fill sizes="(max-width: 900px) 100vw, 35vw" />
          <div className="hc"><b>حقائب جلد</b><span>صُنعت لتدوم — تكمل إطلالتك</span></div>
        </LocalizedClientLink>
      </section>
      <div className="trust">
        <div><span className="ic"><Icon name="truck" size={18} /></span><div><b>توصيل ٢٤–٤٨ ساعة</b><span>لكل محافظات السلطنة</span></div></div>
        <div><span className="ic"><Icon name="refresh" size={18} /></span><div><b>استبدال ١٤ يوماً</b><span>بلا أسئلة</span></div></div>
        <div><span className="ic"><Icon name="scissors" size={18} /></span><div><b>خياطة في مشغلنا</b><span>تعديل الطول مجاناً</span></div></div>
        <div><span className="ic"><Icon name="lock" size={18} /></span><div><b>دفع آمن</b><span>ثواني · Apple Pay · عند الاستلام</span></div></div>
      </div>
      <div className="mt-6"><Ticker /></div>
    </div>
  )
}

export default Hero
