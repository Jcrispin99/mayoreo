import { useForm } from "@inertiajs/react"
import { EyeIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react"
import { type FormEvent, useState } from "react"

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
import { cn } from "@/lib/utils"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const form = useForm({
    email: "",
    password: "",
  })

  const authenticationError = form.errors.email ?? form.errors.password

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    form.post("/login", {
      preserveScroll: true,
      onFinish: () => form.reset("password"),
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-border/80 shadow-xl shadow-primary/5">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Inicia sesión
          </CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder a Mayoreo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              <Field data-invalid={Boolean(authenticationError)}>
                <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  disabled={form.processing}
                  placeholder="nombre@empresa.com"
                  value={form.data.email}
                  onChange={(event) => {
                    form.setData("email", event.target.value)
                    form.clearErrors()
                  }}
                  aria-invalid={Boolean(authenticationError)}
                  className="h-10"
                  required
                />
              </Field>

              <Field data-invalid={Boolean(authenticationError)}>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    disabled={form.processing}
                    value={form.data.password}
                    onChange={(event) => {
                      form.setData("password", event.target.value)
                      form.clearErrors()
                    }}
                    aria-invalid={Boolean(authenticationError)}
                    className="h-10 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    aria-label={
                      passwordVisible
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                    disabled={form.processing}
                  >
                    {passwordVisible ? <EyeOffIcon /> : <EyeIcon />}
                  </Button>
                </div>
              </Field>

              <FieldError aria-live="polite">
                {authenticationError}
              </FieldError>

              <Field>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={form.processing}
                >
                  {form.processing ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : null}
                  {form.processing ? "Ingresando…" : "Entrar"}
                </Button>
                <FieldDescription className="text-center text-xs">
                  El acceso está limitado al personal autorizado.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
