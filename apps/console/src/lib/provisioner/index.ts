import { docker } from "./docker"
import { local } from "./local"
import type { Driver } from "./types"

/** السائق حسب CONSOLE_DRIVER (local افتراضياً في التطوير) */
export const driver = (): Driver => (process.env.CONSOLE_DRIVER === "docker" ? docker : local)
export type { Driver, StoreSpec } from "./types"
