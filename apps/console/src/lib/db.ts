import { Pool } from "pg"

/** قاعدة اللوحة naqla_console — لا تلمس قواعد المتاجر (تلك عبر أدوات التجهيز فقط) */
const g = globalThis as unknown as { __consolePool?: Pool }
export const pool = g.__consolePool ?? new Pool({ connectionString: process.env.CONSOLE_DATABASE_URL, max: 5 })
g.__consolePool = pool

export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pool.query(sql, params)).rows as T[]
}

export { SCHEMA } from "./db-schema"
