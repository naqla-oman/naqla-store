// بعد `medusa build`: يجهّز .medusa/server للتشغيل في الإنتاج (C8)
//  - نسخ admin-brand (شعارات نقلة، support.json) بجوار الخادم المبني
//  - ربط .medusa/server/static بمجلد الصور الدائم خارج .medusa (Medusa يقدّم /static من مجلد التشغيل ولا يسمح بتغييره)
import { cpSync, existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from "node:fs"
import { join, resolve } from "node:path"
import { BACKEND, c } from "./lib.mjs"

const server = join(BACKEND, ".medusa", "server")
if (!existsSync(server)) {
  console.error(c.r("✖ لا يوجد .medusa/server — شغّلي medusa build أولاً"))
  process.exit(1)
}
cpSync(join(BACKEND, "admin-brand"), join(server, "admin-brand"), { recursive: true })

const uploads = process.env.UPLOADS_DIR ? resolve(process.env.UPLOADS_DIR) : join(BACKEND, "static")
mkdirSync(uploads, { recursive: true })
const link = join(server, "static")
if (existsSync(link) || (() => { try { return lstatSync(link).isSymbolicLink() } catch { return false } })()) rmSync(link, { recursive: true, force: true })
symlinkSync(uploads, link, "dir")
console.log(c.g(`✔ postbuild: admin-brand نُسخ، و static ← ${uploads}`))
