// Demo smoke check for the mocked console. Serves nothing itself — point it at
// a running static server of the VITE_DEMO build (SPA fallback required):
//
//   VITE_DEMO=1 pnpm --filter @cozystack/console build
//   cp apps/console/dist/index.html apps/console/dist/404.html
//   (serve apps/console/dist on $SMOKE_BASE with SPA fallback)
//   node apps/console/demo-smoke.mjs
//
// It walks every sidebar/tab destination reachable from the three top sections,
// visits each, and fails on any un-mocked Kubernetes call (4xx/5xx to /api or
// /apis), any page error. Exit code is non-zero on
// failure so CI can gate a deploy on it.

import { chromium } from "@playwright/test"
import http from "node:http"
import fs from "node:fs"
import path from "node:path"

// Self-contained: serve the built demo (SPA fallback) so CI just runs
//   VITE_DEMO=1 pnpm --filter @cozystack/console build && node demo-smoke.mjs
const DIST = process.env.SMOKE_DIST || "dist"
const TYPES = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".woff2":"font/woff2", ".png":"image/png" }
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0]
  let file = path.join(DIST, url)
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html")
  res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream")
  fs.createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(0, r))
const PORT = server.address().port

const BASE = `http://localhost:${PORT}`
const ENTRIES = ["/marketplace", "/console", "/admin/capacity/cluster"]

// Deliberately un-mocked, handled gracefully by the app — not failures.
const ALLOWED_404 = [
  "cozy-dashboard-console-config", // config configmap, swallowed to {}
  "buckets/cozy-backups", // optional backup bucket
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const badApi = new Set()
const pageErrors = []
page.on("response", (r) => {
  const u = new URL(r.url()).pathname
  if (!/^\/(api|apis)\b/.test(u) && !u.startsWith("/api/") && !u.startsWith("/apis/")) return
  if (r.status() < 400) return
  if (ALLOWED_404.some((a) => u.includes(a))) return
  badApi.add(`${r.status()} ${u}`)
})
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)))

const routes = new Set(ENTRIES)
for (const entry of ENTRIES) {
  await page.goto(BASE + entry, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1500)
  for (const href of await page
    .locator("aside a, nav a, [role=tablist] a, a[href^='/console'], a[href^='/admin'], a[href^='/marketplace']")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href"))))
    if (href && href.startsWith("/") && !href.startsWith("//")) routes.add(href)
}

console.log(`\n########## visiting ${routes.size} destinations\n`)
for (const route of [...routes].sort()) {
  await page.goto(BASE + route, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1200)
}
// This console has no distinct "not found" screen (an unknown route just
// renders the shell), so a broken screen shows up as an un-mocked API call or
// a page error, both collected above — not as body text.

await browser.close()
server.close()

const fail = badApi.size || pageErrors.length
console.log("un-mocked API calls:", badApi.size ? [...badApi] : "none")
console.log("page errors:", pageErrors.length ? pageErrors : "none")
console.log(fail ? "\nSMOKE FAILED" : "\nsmoke OK")
process.exit(fail ? 1 : 0)
