/** «مزوّد التشغيل»: واجهة واحدة وسائقان — local (التطوير) وdocker (الإنتاج، عبر المنفّذ) */
export type Log = (line: string) => void
export type StoreSpec = {
  slug: string; name: string; template: string; phone: string; email: string
  palette?: string; font?: string; voice?: "f" | "m" | "neutral"; features?: Record<string, boolean>
  logoPng?: string; domain?: string
}
export interface Driver {
  name: string
  createFolder(spec: StoreSpec, log: Log): Promise<void>
  setup(spec: StoreSpec, log: Log): Promise<{ backendPort: number; storefrontPort: number }>
  resetLink(slug: string, log: Log): Promise<string>
  start(slug: string, log: Log): Promise<void>
  stop(slug: string, log: Log): Promise<void>
  ready(slug: string, timeoutMs?: number): Promise<boolean>
  pause(slug: string, name: string, log: Log): Promise<void>
  resume(slug: string, log: Log): Promise<void>
  migrate(slug: string, log: Log): Promise<void>
  backup(slug: string, kind: string, log: Log): Promise<{ file: string; size: number }>
  restore(slug: string, file: string, log: Log): Promise<void>
  remove(slug: string, log: Log): Promise<void>
  rollback(slug: string, log: Log): Promise<void>
  stats(slug: string): Promise<{ orders: number; sales: number } | null>
  logs(slug: string, lines?: number): Promise<string>
}
