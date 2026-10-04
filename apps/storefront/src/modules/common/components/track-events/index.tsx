"use client"

import { TrackItem, track } from "@lib/tracking/events"
import { useEffect } from "react"

/** purchase بمعرّف الخادم نفسه (purchase_<order_id>) — مرة واحدة لكل طلب حتى مع تحديث الصفحة */
export function PurchaseEvent({ orderId, value, currency, items }: { orderId: string; value: number; currency: string; items: TrackItem[] }) {
  useEffect(() => {
    const key = `trk:purchase:${orderId}`
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1") } catch { /* تصفّح خاص */ }
    track("purchase", { event_id: `purchase_${orderId}`, transaction_id: orderId, value, currency, items })
  }, [orderId]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/** view_item_list (+ search عند وجود عبارة بحث) */
export function ListEvent({ listName, items, searchTerm }: { listName: string; items: TrackItem[]; searchTerm?: string }) {
  const key = `${listName}|${searchTerm ?? ""}|${items.map((i) => i.id).join(",")}`
  useEffect(() => {
    if (searchTerm) track("search", { search_term: searchTerm, items })
    if (items.length) track("view_item_list", { list_name: listName, items })
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
