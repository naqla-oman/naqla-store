// node scripts/maintenance.mjs <port> <store-name> — صفحة صيانة (503) على منفذ المتجر أثناء الإيقاف المؤقت
import { createServer } from "node:http"
const [port, name = "المتجر"] = process.argv.slice(2)
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} — صيانة</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F4F7F8;font-family:system-ui,sans-serif;color:#0B1B2B;text-align:center}main{padding:24px}h1{font-size:24px}p{color:#5B6B78}</style></head>
<body><main><h1>${name}</h1><p>نُجري تحديثات على المتجر، ونعود قريباً.</p></main></body></html>`
createServer((req, res) => { res.writeHead(503, { "Content-Type": "text/html; charset=utf-8", "Retry-After": "600", "X-Naqla-Maintenance": "1" }); res.end(html) }).listen(Number(port), () => console.log(`maintenance on ${port}`))
