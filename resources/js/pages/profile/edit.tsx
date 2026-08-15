import { Head, useForm } from "@inertiajs/react"
import { CheckIcon, KeyRoundIcon, LoaderCircleIcon, UserRoundIcon } from "lucide-react"
import type { FormEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { AppLayout } from "@/layouts/app-layout"
import type { SharedProps } from "@/types"

export default function EditProfile({ auth }: SharedProps) {
  const profileForm = useForm({
    name: auth.user.name,
    email: auth.user.email,
  })
  const passwordForm = useForm({
    current_password: "",
    password: "",
    password_confirmation: "",
  })

  function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    profileForm.patch("/profile", {
      preserveScroll: true,
      errorBag: "updateProfile",
    })
  }

  function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    passwordForm.put("/profile/password", {
      preserveScroll: true,
      errorBag: "updatePassword",
      onSuccess: () => passwordForm.reset(),
    })
  }

  return (
    <AppLayout title="Mi perfil">
      <Head title="Mi perfil" />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <p className="text-sm text-muted-foreground">Configuración</p>
          <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra tus datos personales y credenciales de acceso.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <UserRoundIcon className="size-4" />
            </div>
            <CardTitle>Información personal</CardTitle>
            <CardDescription>
              Actualiza el nombre y correo asociados a tu cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={updateProfile}>
              <FieldGroup>
                <Field data-invalid={Boolean(profileForm.errors.name)}>
                  <FieldLabel htmlFor="name">Nombre</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    value={profileForm.data.name}
                    onChange={(event) => profileForm.setData("name", event.target.value)}
                    aria-invalid={Boolean(profileForm.errors.name)}
                    disabled={profileForm.processing}
                    required
                  />
                  <FieldError>{profileForm.errors.name}</FieldError>
                </Field>

                <Field data-invalid={Boolean(profileForm.errors.email)}>
                  <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={profileForm.data.email}
                    onChange={(event) => profileForm.setData("email", event.target.value)}
                    aria-invalid={Boolean(profileForm.errors.email)}
                    disabled={profileForm.processing}
                    required
                  />
                  <FieldError>{profileForm.errors.email}</FieldError>
                  {auth.user.email_verified_at === null ? (
                    <FieldDescription className="text-amber-700">
                      Este correo está pendiente de verificación. Revisa tu bandeja de entrada.
                    </FieldDescription>
                  ) : null}
                </Field>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={profileForm.processing}>
                    {profileForm.processing ? <LoaderCircleIcon className="animate-spin" /> : null}
                    Guardar cambios
                  </Button>
                  {profileForm.recentlySuccessful ? (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <CheckIcon className="size-4 text-primary" />
                      Guardado
                    </span>
                  ) : null}
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <KeyRoundIcon className="size-4" />
            </div>
            <CardTitle>Cambiar contraseña</CardTitle>
            <CardDescription>
              Usa una contraseña segura que no utilices en otros servicios.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={updatePassword}>
              <FieldGroup>
                <Field data-invalid={Boolean(passwordForm.errors.current_password)}>
                  <FieldLabel htmlFor="current_password">Contraseña actual</FieldLabel>
                  <Input
                    id="current_password"
                    name="current_password"
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.data.current_password}
                    onChange={(event) => passwordForm.setData("current_password", event.target.value)}
                    aria-invalid={Boolean(passwordForm.errors.current_password)}
                    disabled={passwordForm.processing}
                    required
                  />
                  <FieldError>{passwordForm.errors.current_password}</FieldError>
                </Field>

                <Field data-invalid={Boolean(passwordForm.errors.password)}>
                  <FieldLabel htmlFor="password">Nueva contraseña</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.data.password}
                    onChange={(event) => passwordForm.setData("password", event.target.value)}
                    aria-invalid={Boolean(passwordForm.errors.password)}
                    disabled={passwordForm.processing}
                    required
                  />
                  <FieldDescription>Mínimo 8 caracteres.</FieldDescription>
                  <FieldError>{passwordForm.errors.password}</FieldError>
                </Field>

                <Field data-invalid={Boolean(passwordForm.errors.password_confirmation)}>
                  <FieldLabel htmlFor="password_confirmation">Confirmar nueva contraseña</FieldLabel>
                  <Input
                    id="password_confirmation"
                    name="password_confirmation"
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.data.password_confirmation}
                    onChange={(event) => passwordForm.setData("password_confirmation", event.target.value)}
                    aria-invalid={Boolean(passwordForm.errors.password_confirmation)}
                    disabled={passwordForm.processing}
                    required
                  />
                  <FieldError>{passwordForm.errors.password_confirmation}</FieldError>
                </Field>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={passwordForm.processing}>
                    {passwordForm.processing ? <LoaderCircleIcon className="animate-spin" /> : null}
                    Actualizar contraseña
                  </Button>
                  {passwordForm.recentlySuccessful ? (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <CheckIcon className="size-4 text-primary" />
                      Actualizada
                    </span>
                  ) : null}
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
