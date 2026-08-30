import { setupWorker } from "msw/browser"
import { handlers } from "./handlers.ts"

// Запускается только в demo-сборке (VITE_DEMO=1). unhandled-запросы пропускаем
// молча — часть путей k8s UI может дёргать опционально.
export async function startDemo() {
  const worker = setupWorker(...handlers)
  // worker + его scope должны жить под base-путём (напр. /demo/), иначе на
  // под-путях моки не перехватываются.
  await worker.start({
    onUnhandledRequest: "bypass",
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
}
