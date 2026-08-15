import { Head } from "@inertiajs/react"
import { PackageCheckIcon } from "lucide-react"

import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <>
      <Head title="Iniciar sesión" />

      <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-muted p-6 md:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_38%),radial-gradient(circle_at_bottom_right,color-mix(in_oklch,var(--accent)_70%,transparent),transparent_34%)]" />
        <div className="relative flex w-full max-w-sm flex-col gap-7">
          <div className="flex items-center justify-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <PackageCheckIcon className="size-5" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Mayoreo</p>
              <p className="text-xs text-muted-foreground">
                Gestión comercial
              </p>
            </div>
          </div>

          <LoginForm />

          <p className="text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Mayoreo
          </p>
        </div>
      </main>
    </>
  )
}
