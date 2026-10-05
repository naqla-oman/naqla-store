import { client } from "./client"

/** مفتاح ميزة من clients/<STORE>/store.json → features (M10: الخادم يحترمه لا الواجهة فقط) */
export const featureOn = (key: string) => !!(client() as any).features?.[key]
