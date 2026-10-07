import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Icon from "@modules/common/components/icon"
import Ticker from "@modules/layout/components/ticker"
import { clientAsset } from "../../../../store.config"
import { useStoreConfig } from "@/i18n/store-config"

/** الواجهة الرئيسية — نصوصها وصورها من store.json → home */
const Hero = () => {
  const c = useStoreConfig()
  const { hero, tiles, trust } = c.home
  return (
    <div className="wrap">
      <section className="hero">
        <div className="hero-main">
          <Image src={clientAsset(hero.image)} alt="" fill priority sizes="(max-width: 900px) 100vw, 60vw" />
          <div className="hc">
            {hero.kicker && <span className="kicker"><Icon name="sparkle" size={14} /> {hero.kicker}</span>}
            <h1>
              {hero.title.map((line, i) => (
                <span key={i}>{i > 0 && <br />}{line}</span>
              ))}
            </h1>
            <p>{hero.text}</p>
            <div className="acts">
              <LocalizedClientLink href={hero.primary.href} className="btn lg hero-cta">{hero.primary.label} <Icon name="arrowL" size={16} /></LocalizedClientLink>
              {hero.secondary && (
                <LocalizedClientLink href={hero.secondary.href} className="btn lg ghost !bg-white/10 !text-white !border-white/25">{hero.secondary.label}</LocalizedClientLink>
              )}
            </div>
          </div>
        </div>
        {tiles.map((t) => (
          <LocalizedClientLink key={t.href} href={t.href} className="hero-side">
            <Image src={clientAsset(t.image)} alt="" fill sizes="(max-width: 900px) 100vw, 35vw" />
            <div className="hc"><b>{t.title}</b><span>{t.text}</span></div>
          </LocalizedClientLink>
        ))}
      </section>
      <div className="trust">
        {trust.map((t) => (
          <div key={t.title}><span className="ic"><Icon name={t.icon} size={18} /></span><div><b>{t.title}</b><span>{t.text}</span></div></div>
        ))}
      </div>
      <div className="mt-6"><Ticker /></div>
    </div>
  )
}

export default Hero
