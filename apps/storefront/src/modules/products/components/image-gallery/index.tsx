"use client"

import Image, { getImageProps } from "next/image"

/**
 * M33: صور العارض الكبير والشريط عبر محسّن Next (srcSet بصيغة WebP/AVIF وبالمقاس) —
 * كانت <img> بالرابط الأصلي فيُحمَّل كل أصل كاملاً حتى للمصغّرة 72px. getImageProps يُبقي <img> نفسه (التكبير والسحب).
 */
const big = (src: string, alt: string) => getImageProps({ src, alt, width: 1600, height: 2000, sizes: "(max-width: 900px) 100vw, 1200px", quality: 82 }).props
const thumb = (src: string) => getImageProps({ src, alt: "", width: 144, height: 144, sizes: "72px", quality: 70 }).props
import { HttpTypes } from "@medusajs/types"
import Icon from "@modules/common/components/icon"
import { useCallback, useEffect, useRef, useState } from "react"
import { useT } from "@/i18n/t"

type Props = {
  images: HttpTypes.StoreProductImage[]
  title: string
  /** بيانات لا عنصر JSX: عنصر مُمرَّر كخاصية من مكوّن خادم كان يطلق تحذير «unique key» بعد كل تحديث RSC */
  badge?: { text: string; red?: boolean } | null
  /** النص البديل (الاسم + القسم + الألوان) — الافتراضي العنوان */
  alt?: string
}

/** معرض المنتج: صورة رئيسية (سحب على الجوال) + مصغّرات + عارض بملء الشاشة مع تكبير */
export default function ImageGallery({ images, title, badge, alt }: Props) {
  const t = useT("product")
  const base = alt || title
  const list = images.length ? images : []
  const [shot, setShot] = useState(0)
  const [open, setOpen] = useState(false)
  const [zoom, setZoom] = useState(false)
  const startX = useRef<number | null>(null)
  const moved = useRef(false)
  const n = list.length

  const go = useCallback((d: number) => { setShot((i) => (i + d + n) % n); setZoom(false) }, [n])

  // السحب: في الاتجاه من اليمين لليسار تكون الصورة التالية بالسحب نحو اليمين
  const onDown = (e: React.PointerEvent) => { startX.current = e.clientX; moved.current = false }
  const onUp = (e: React.PointerEvent) => {
    if (startX.current === null) return
    const dx = e.clientX - startX.current
    startX.current = null
    if (Math.abs(dx) > 40 && n > 1) { moved.current = true; go(dx > 0 ? 1 : -1) }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
      if (e.key === "ArrowLeft") go(1)
      if (e.key === "ArrowRight") go(-1)
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev }
  }, [open, go])

  if (!n) return <div className="gallery"><div className="main"><div className="gthumb" /></div></div>

  return (
    <>
      <div className="gallery">
        <div
          className="main"
          role="button"
          tabIndex={0}
          aria-label={t("s328e82")}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onClick={() => { if (!moved.current) setOpen(true) }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true) } }}
        >
          <div className="gthumb">
            {list.map((img, i) => (
              <Image
                key={`${img.id ?? img.url}-${i}`}
                src={img.url}
                alt={i === 0 ? base : t("imageN", { base, n: i + 1 })}
                fill
                priority={i === 0}
                sizes="(max-width: 900px) 100vw, 50vw"
                className={i === shot ? "on" : ""}
                draggable={false}
              />
            ))}
          </div>
          {badge && <span className={`ptag ${badge.red ? "red" : ""}`}>{badge.red ? <bdi dir="ltr">{badge.text}</bdi> : badge.text}</span>}
          {n > 1 && <div className="dots" aria-hidden="true">{list.map((img, i) => <i key={`${img.id ?? img.url}-${i}`} className={i === shot ? "on" : ""} />)}</div>}
          <span className="zoomhint"><Icon name="zoom" size={13} /> {t("s068e54")}</span>
        </div>
        {n > 1 && (
          <div className="thumbs" role="tablist" aria-label={t("s1baeb3")}>
            {list.map((img, i) => (
              <button
                key={`${img.id ?? img.url}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === shot}
                aria-label={t("imageIndex", { n: i + 1 })}
                className={i === shot ? "on" : ""}
                onClick={() => setShot(i)}
              >
                <Image src={img.url} alt="" fill sizes="96px" />
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={title}>
          <div className="top">
            <span>{title} <span className="num">({shot + 1}/{n})</span></span>
            <button type="button" className="iconbtn" aria-label={t("s9932cc")} onClick={() => setOpen(false)} autoFocus><Icon name="x" /></button>
          </div>
          <div className="stage" onPointerDown={onDown} onPointerUp={(e) => { if (!zoom) onUp(e) }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              {...big(list[shot].url!, title)}
              alt={title}
              className={zoom ? "zoomed" : ""}
              onDoubleClick={() => setZoom((z) => !z)}
              draggable={false}
            />
            {n > 1 && (
              <>
                <button type="button" className="nav prev" aria-label={t("s650bd5")} onClick={() => go(-1)}><Icon name="chevR" /></button>
                <button type="button" className="nav next" aria-label={t("s8435af")} onClick={() => go(1)}><Icon name="chevL" /></button>
              </>
            )}
          </div>
          <div className="hint">{t("sd75e7d")}</div>
          {n > 1 && (
            <div className="strip">
              {list.map((img, i) => (
                <button key={`${img.id ?? img.url}-${i}`} type="button" className={i === shot ? "on" : ""} aria-label={t("imageIndex", { n: i + 1 })} onClick={() => { setShot(i); setZoom(false) }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img {...thumb(img.url!)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
