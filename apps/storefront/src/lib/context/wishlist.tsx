"use client"

import { track } from "@lib/tracking/events"
import { toggleWishlist } from "@lib/data/account"
import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { storeConfig } from "../../store.config"

// مفتاح لكل متجر حتى لا تختلط مفضلات المتاجر على نفس المتصفح
const KEY = `${storeConfig.slug}:wishlist`

type Ctx = { ids: string[]; has: (id: string) => boolean; toggle: (id: string) => Promise<void>; loggedIn: boolean }
const WishlistContext = createContext<Ctx>({ ids: [], has: () => false, toggle: async () => {}, loggedIn: false })

const readLocal = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]")
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}
const writeLocal = (ids: string[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch {}
}

/** المفضلة: في الحساب للمسجّلات (metadata.wishlist)، وفي المتصفح للضيفات وتُضم عند الدخول */
export function WishlistProvider({ initial, loggedIn, children }: { initial: string[]; loggedIn: boolean; children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>(initial)

  useEffect(() => {
    if (loggedIn) { setIds(initial); writeLocal([]) } else setIds(readLocal())
  }, [loggedIn, initial])

  const toggle = useCallback(async (id: string) => {
    const adding = !ids.includes(id)
    if (adding) track("add_to_wishlist", { items: [{ id, name: "" }] })
    const next = adding ? [id, ...ids] : ids.filter((x) => x !== id)
    setIds(next) // تحديث فوري
    if (!loggedIn) { writeLocal(next); return }
    const r = await toggleWishlist(id)
    if (r.ok && r.data) setIds(r.data.ids)
    else setIds(ids) // تراجع عند الفشل
  }, [ids, loggedIn])

  return (
    <WishlistContext.Provider value={{ ids, has: (id) => ids.includes(id), toggle, loggedIn }}>
      {children}
    </WishlistContext.Provider>
  )
}

export const useWishlist = () => useContext(WishlistContext)
export const localWishlist = () => (typeof window === "undefined" ? [] : readLocal())
