"use client"

import { applyStoreOverrides } from "../../../../store.config"

/**
 * إعدادات اللوحة لطبقة مكوّنات العميل: في App Router لـ store.config نسختان على الخادم
 * (مكوّنات الخادم، ورسم مكوّنات العميل SSR). التخطيط الجذري يطبّقها على الأولى، وهذا المكوّن
 * يطبّقها على الثانية (وفي المتصفح) أثناء رسمه — قبل أبنائه.
 */
export default function StoreSettingsBoot({ settings, children }: { settings: Record<string, unknown>; children: React.ReactNode }) {
  applyStoreOverrides(settings)
  return <>{children}</>
}
