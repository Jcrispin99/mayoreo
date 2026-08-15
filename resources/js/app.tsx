import "../css/app.css"

import { createInertiaApp } from "@inertiajs/react"
import { type ComponentType, StrictMode } from "react"
import { createRoot } from "react-dom/client"

const appName = import.meta.env.VITE_APP_NAME ?? "Mayoreo"

void createInertiaApp({
  title: (title) => (title ? `${title} - ${appName}` : appName),
  resolve: async (name) => {
    const pages = import.meta.glob<{ default: ComponentType }>(
      "./pages/**/*.tsx"
    )
    const page = pages[`./pages/${name}.tsx`]

    if (page === undefined) {
      throw new Error(`Página de Inertia no encontrada: ${name}`)
    }

    return (await page()).default
  },
  setup({ el, App, props }) {
    createRoot(el).render(
      <StrictMode>
        <App {...props} />
      </StrictMode>
    )
  },
  progress: {
    color: "#c53f2f",
  },
})
