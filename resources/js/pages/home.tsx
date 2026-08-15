import { Head, Link } from "@inertiajs/react"
import { ArrowRightIcon, PackageCheckIcon, UserRoundIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AppLayout } from "@/layouts/app-layout"
import type { SharedProps } from "@/types"

export default function Home({ auth }: SharedProps) {
  return (
    <AppLayout title="Inicio">
      <Head title="Inicio" />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div>
          <p className="text-sm text-muted-foreground">Panel principal</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hola, {auth.user.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Desde aquí iremos incorporando los módulos de gestión web.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <PackageCheckIcon className="size-5" />
              </div>
              <CardTitle>Mayoreo web</CardTitle>
              <CardDescription>
                El panel está conectado al mismo backend y sesión de Laravel.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <UserRoundIcon className="size-5" />
              </div>
              <CardTitle>Tu perfil</CardTitle>
              <CardDescription>
                Mantén actualizados tus datos y la contraseña de acceso.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button nativeButton={false} variant="outline" render={<Link href="/profile" />}>
                Administrar perfil
                <ArrowRightIcon />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
