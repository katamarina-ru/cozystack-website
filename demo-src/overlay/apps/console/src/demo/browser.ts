import { setupWorker } from "msw/browser"
import { handlers } from "./handlers.ts"

// Only ever started in a demo build (VITE_DEMO=1). Unhandled requests are let
// through silently — the Kubernetes UI asks for some paths optionally.
export async function startDemo() {
  const worker = setupWorker(...handlers)
  // The worker and its scope have to live under the base path (e.g. /demo-app/),
  // otherwise nothing is intercepted on sub-paths.
  await worker.start({
    onUnhandledRequest: "bypass",
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
}
