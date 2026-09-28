import { Head, useForm } from "@inertiajs/react"
import { CheckCircle2Icon, PlusIcon, ShieldCheckIcon, TrashIcon, UploadIcon, XCircleIcon } from "lucide-react"
import { useState, type FormEvent } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { AppLayout } from "@/layouts/app-layout"

type CertificateInfo = {
  original_name: string | null
  source_format: string | null
  fingerprint_sha256: string | null
  matches_ruc: boolean | null
  is_self_signed: boolean | null
  key_algorithm: string | null
  key_size: number | null
  valid_from: string | null
  expires_at: string | null
  uploaded_at: string | null
  is_expired: boolean
  meets_production_requirements: boolean
}

type CredentialInfo = {
  environment: "beta" | "production"
  has_sol_username: boolean
  has_sol_password: boolean
  has_sol_credentials: boolean
  has_certificate: boolean
  certificate: CertificateInfo | null
}

type FiscalIssuer = {
  id: number
  ruc: string
  legal_name: string
  trade_name: string | null
  fiscal_address: string | null
  ubigeo: string | null
  urbanization: string | null
  department: string | null
  province: string | null
  district: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  stores_count: number
  configuration_complete: boolean
  credential: CredentialInfo | null
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date(value))
}

function IssuerDataForm({ issuer }: { issuer: FiscalIssuer }) {
  const form = useForm({
    legal_name: issuer.legal_name,
    trade_name: issuer.trade_name ?? "",
    fiscal_address: issuer.fiscal_address ?? "",
    ubigeo: issuer.ubigeo ?? "",
    urbanization: issuer.urbanization ?? "",
    department: issuer.department ?? "",
    province: issuer.province ?? "",
    district: issuer.district ?? "",
    phone: issuer.phone ?? "",
    email: issuer.email ?? "",
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    form.put(`/fiscal-settings/${issuer.id}`, { preserveScroll: true })
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(form.errors.legal_name)}>
            <FieldLabel>Razón social</FieldLabel>
            <Input
              aria-invalid={Boolean(form.errors.legal_name)}
              onChange={(event) => form.setData("legal_name", event.target.value)}
              value={form.data.legal_name}
            />
            <FieldError>{form.errors.legal_name}</FieldError>
          </Field>
          <Field data-invalid={Boolean(form.errors.trade_name)}>
            <FieldLabel>Nombre comercial</FieldLabel>
            <Input
              aria-invalid={Boolean(form.errors.trade_name)}
              onChange={(event) => form.setData("trade_name", event.target.value)}
              value={form.data.trade_name}
            />
            <FieldError>{form.errors.trade_name}</FieldError>
          </Field>
        </div>

        <Field data-invalid={Boolean(form.errors.fiscal_address)}>
          <FieldLabel>Domicilio fiscal</FieldLabel>
          <Input
            aria-invalid={Boolean(form.errors.fiscal_address)}
            onChange={(event) => form.setData("fiscal_address", event.target.value)}
            value={form.data.fiscal_address}
          />
          <FieldError>{form.errors.fiscal_address}</FieldError>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(form.errors.ubigeo)}>
            <FieldLabel>Ubigeo (6 dígitos)</FieldLabel>
            <Input
              aria-invalid={Boolean(form.errors.ubigeo)}
              maxLength={6}
              onChange={(event) => form.setData("ubigeo", event.target.value)}
              value={form.data.ubigeo}
            />
            <FieldError>{form.errors.ubigeo}</FieldError>
          </Field>
          <Field data-invalid={Boolean(form.errors.urbanization)}>
            <FieldLabel>Urbanización / zona</FieldLabel>
            <Input
              aria-invalid={Boolean(form.errors.urbanization)}
              onChange={(event) => form.setData("urbanization", event.target.value)}
              value={form.data.urbanization}
            />
            <FieldError>{form.errors.urbanization}</FieldError>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field data-invalid={Boolean(form.errors.department)}>
            <FieldLabel>Departamento</FieldLabel>
            <Input
              aria-invalid={Boolean(form.errors.department)}
              onChange={(event) => form.setData("department", event.target.value)}
              value={form.data.department}
            />
            <FieldError>{form.errors.department}</FieldError>
          </Field>
          <Field data-invalid={Boolean(form.errors.province)}>
            <FieldLabel>Provincia</FieldLabel>
            <Input
              aria-invalid={Boolean(form.errors.province)}
              onChange={(event) => form.setData("province", event.target.value)}
              value={form.data.province}
            />
            <FieldError>{form.errors.province}</FieldError>
          </Field>
          <Field data-invalid={Boolean(form.errors.district)}>
            <FieldLabel>Distrito</FieldLabel>
            <Input
              aria-invalid={Boolean(form.errors.district)}
              onChange={(event) => form.setData("district", event.target.value)}
              value={form.data.district}
            />
            <FieldError>{form.errors.district}</FieldError>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(form.errors.phone)}>
            <FieldLabel>Teléfono</FieldLabel>
            <Input
              aria-invalid={Boolean(form.errors.phone)}
              onChange={(event) => form.setData("phone", event.target.value)}
              value={form.data.phone}
            />
            <FieldError>{form.errors.phone}</FieldError>
          </Field>
          <Field data-invalid={Boolean(form.errors.email)}>
            <FieldLabel>Correo</FieldLabel>
            <Input
              aria-invalid={Boolean(form.errors.email)}
              onChange={(event) => form.setData("email", event.target.value)}
              type="email"
              value={form.data.email}
            />
            <FieldError>{form.errors.email}</FieldError>
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <Button disabled={form.processing} size="sm" type="submit">
            Guardar datos
          </Button>
          {form.recentlySuccessful ? (
            <span className="text-sm text-muted-foreground">Guardado.</span>
          ) : null}
        </div>
      </FieldGroup>
    </form>
  )
}

function CredentialsForm({ issuer }: { issuer: FiscalIssuer }) {
  const credential = issuer.credential
  const form = useForm({
    environment: credential?.environment ?? "beta",
    sol_username: "",
    sol_password: "",
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    form.transform((data) => {
      const payload: Record<string, string> = { environment: data.environment }
      if (data.sol_username.trim()) payload.sol_username = data.sol_username.trim()
      if (data.sol_password.trim()) payload.sol_password = data.sol_password.trim()
      return payload
    })
    form.put(`/fiscal-settings/${issuer.id}/credentials`, {
      preserveScroll: true,
      onSuccess: () => {
        form.setData("sol_username", "")
        form.setData("sol_password", "")
      },
    })
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <Field data-invalid={Boolean(form.errors.environment)}>
          <FieldLabel>Ambiente</FieldLabel>
          <Select
            onValueChange={(value) => form.setData("environment", (value ?? "beta") as "beta" | "production")}
            value={form.data.environment}
          >
            <SelectTrigger className="w-full" aria-invalid={Boolean(form.errors.environment)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beta">Beta (pruebas)</SelectItem>
              <SelectItem value="production">Producción</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>
            Producción exige credenciales SOL, certificado vigente, no autofirmado y vinculado al RUC.
          </FieldDescription>
          <FieldError>{form.errors.environment}</FieldError>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(form.errors.sol_username)}>
            <FieldLabel>Usuario Clave SOL secundaria</FieldLabel>
            <Input
              aria-invalid={Boolean(form.errors.sol_username)}
              onChange={(event) => form.setData("sol_username", event.target.value)}
              placeholder={credential?.has_sol_username ? "•••••••• (dejar en blanco para no cambiar)" : "Usuario"}
              value={form.data.sol_username}
            />
            <FieldError>{form.errors.sol_username}</FieldError>
          </Field>
          <Field data-invalid={Boolean(form.errors.sol_password)}>
            <FieldLabel>Contraseña Clave SOL</FieldLabel>
            <Input
              aria-invalid={Boolean(form.errors.sol_password)}
              onChange={(event) => form.setData("sol_password", event.target.value)}
              placeholder={credential?.has_sol_password ? "•••••••• (dejar en blanco para no cambiar)" : "Contraseña"}
              type="password"
              value={form.data.sol_password}
            />
            <FieldError>{form.errors.sol_password}</FieldError>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={credential?.has_sol_credentials ? "default" : "outline"}>
            {credential?.has_sol_credentials ? <CheckCircle2Icon /> : <XCircleIcon />}
            Credenciales SOL {credential?.has_sol_credentials ? "completas" : "incompletas"}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Button disabled={form.processing} size="sm" type="submit">
            Guardar credenciales
          </Button>
          {form.recentlySuccessful ? (
            <span className="text-sm text-muted-foreground">Guardado.</span>
          ) : null}
        </div>
      </FieldGroup>
    </form>
  )
}

function CertificateSection({ issuer }: { issuer: FiscalIssuer }) {
  const certificate = issuer.credential?.certificate ?? null
  const uploadForm = useForm({
    certificate: null as File | null,
    certificate_password: "",
  })
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    uploadForm.post(`/fiscal-settings/${issuer.id}/certificate`, {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: () => {
        uploadForm.reset()
      },
    })
  }

  function submitDelete() {
    uploadForm.delete(`/fiscal-settings/${issuer.id}/certificate`, { preserveScroll: true })
    setConfirmingDelete(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {certificate ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{certificate.original_name ?? "Certificado cargado"}</span>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={certificate.matches_ruc ? "default" : "destructive"}>
                {certificate.matches_ruc ? "Coincide con el RUC" : "No coincide con el RUC"}
              </Badge>
              <Badge variant={certificate.is_self_signed ? "outline" : "default"}>
                {certificate.is_self_signed ? "Autofirmado" : "Firmado por CA"}
              </Badge>
              <Badge variant={certificate.is_expired ? "destructive" : "default"}>
                {certificate.is_expired ? "Vencido" : "Vigente"}
              </Badge>
              <Badge variant={certificate.meets_production_requirements ? "default" : "outline"}>
                {certificate.meets_production_requirements ? "Listo para producción" : "No apto para producción"}
              </Badge>
            </div>
          </div>
          <div className="grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
            <span>Vigente desde: {formatDate(certificate.valid_from)}</span>
            <span>Vence: {formatDate(certificate.expires_at)}</span>
            <span>Clave: {certificate.key_algorithm ?? "—"} {certificate.key_size ? `(${certificate.key_size} bits)` : ""}</span>
            <span>Cargado: {formatDate(certificate.uploaded_at)}</span>
          </div>

          {confirmingDelete ? (
            <Alert variant="destructive">
              <AlertTitle>¿Eliminar el certificado?</AlertTitle>
              <AlertDescription>
                No podrás firmar ni enviar comprobantes a SUNAT hasta cargar uno nuevo.
                <div className="mt-2 flex gap-2">
                  <Button onClick={submitDelete} size="sm" variant="destructive">
                    Sí, eliminar
                  </Button>
                  <Button onClick={() => setConfirmingDelete(false)} size="sm" variant="outline">
                    Cancelar
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Button
              className="self-start"
              onClick={() => setConfirmingDelete(true)}
              size="sm"
              variant="outline"
            >
              <TrashIcon /> Eliminar certificado
            </Button>
          )}
        </div>
      ) : (
        <Alert>
          <ShieldCheckIcon />
          <AlertTitle>Sin certificado</AlertTitle>
          <AlertDescription>
            Sube el certificado digital (.pem, .pfx o .p12) para poder firmar comprobantes.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={submitUpload}>
        <FieldGroup>
          <Field data-invalid={Boolean(uploadForm.errors.certificate)}>
            <FieldLabel htmlFor={`certificate-${issuer.id}`}>
              {certificate ? "Reemplazar certificado" : "Cargar certificado"}
            </FieldLabel>
            <Input
              accept=".pem,.pfx,.p12,.txt"
              aria-invalid={Boolean(uploadForm.errors.certificate)}
              id={`certificate-${issuer.id}`}
              onChange={(event) => uploadForm.setData("certificate", event.target.files?.[0] ?? null)}
              type="file"
            />
            <FieldDescription>Formatos aceptados: .pem, .pfx, .p12 (o .txt exportado de un .p12).</FieldDescription>
            <FieldError>{uploadForm.errors.certificate}</FieldError>
          </Field>
          <Field data-invalid={Boolean(uploadForm.errors.certificate_password)}>
            <FieldLabel>Contraseña del certificado (solo .pfx/.p12)</FieldLabel>
            <Input
              aria-invalid={Boolean(uploadForm.errors.certificate_password)}
              onChange={(event) => uploadForm.setData("certificate_password", event.target.value)}
              type="password"
              value={uploadForm.data.certificate_password}
            />
            <FieldError>{uploadForm.errors.certificate_password}</FieldError>
          </Field>
          <div className="flex items-center gap-3">
            <Button disabled={uploadForm.processing || !uploadForm.data.certificate} size="sm" type="submit">
              <UploadIcon /> {uploadForm.processing ? "Subiendo…" : "Subir certificado"}
            </Button>
            {uploadForm.recentlySuccessful ? (
              <span className="text-sm text-muted-foreground">Certificado actualizado.</span>
            ) : null}
          </div>
        </FieldGroup>
      </form>
    </div>
  )
}

function IssuerCard({ issuer }: { issuer: FiscalIssuer }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{issuer.legal_name}</CardTitle>
            <CardDescription>RUC {issuer.ruc}{issuer.trade_name ? ` · ${issuer.trade_name}` : ""}</CardDescription>
          </div>
          <Badge variant={issuer.configuration_complete ? "default" : "outline"}>
            {issuer.configuration_complete ? "Listo para emitir" : "Configuración incompleta"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div>
          <h3 className="mb-3 text-sm font-semibold">Datos del emisor</h3>
          <IssuerDataForm issuer={issuer} />
        </div>
        <Separator />
        <div>
          <h3 className="mb-3 text-sm font-semibold">Clave SOL</h3>
          <CredentialsForm issuer={issuer} />
        </div>
        <Separator />
        <div>
          <h3 className="mb-3 text-sm font-semibold">Certificado digital</h3>
          <CertificateSection issuer={issuer} />
        </div>
      </CardContent>
    </Card>
  )
}

function NewIssuerCard() {
  const [expanded, setExpanded] = useState(false)
  const form = useForm({
    ruc: "",
    legal_name: "",
    trade_name: "",
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    form.post("/fiscal-settings", {
      onSuccess: () => {
        form.reset()
        setExpanded(false)
      },
    })
  }

  if (!expanded) {
    return (
      <Button onClick={() => setExpanded(true)} variant="outline">
        <PlusIcon /> Agregar otro emisor fiscal
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo emisor fiscal</CardTitle>
        <CardDescription>Solo RUC y razón social son obligatorios; el resto se completa después.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field data-invalid={Boolean(form.errors.ruc)}>
              <FieldLabel>RUC</FieldLabel>
              <Input
                aria-invalid={Boolean(form.errors.ruc)}
                maxLength={11}
                onChange={(event) => form.setData("ruc", event.target.value)}
                value={form.data.ruc}
              />
              <FieldError>{form.errors.ruc}</FieldError>
            </Field>
            <Field data-invalid={Boolean(form.errors.legal_name)}>
              <FieldLabel>Razón social</FieldLabel>
              <Input
                aria-invalid={Boolean(form.errors.legal_name)}
                onChange={(event) => form.setData("legal_name", event.target.value)}
                value={form.data.legal_name}
              />
              <FieldError>{form.errors.legal_name}</FieldError>
            </Field>
            <Field data-invalid={Boolean(form.errors.trade_name)}>
              <FieldLabel>Nombre comercial (opcional)</FieldLabel>
              <Input
                aria-invalid={Boolean(form.errors.trade_name)}
                onChange={(event) => form.setData("trade_name", event.target.value)}
                value={form.data.trade_name}
              />
              <FieldError>{form.errors.trade_name}</FieldError>
            </Field>
            <div className="flex gap-2">
              <Button disabled={form.processing} type="submit">
                Crear emisor
              </Button>
              <Button onClick={() => setExpanded(false)} type="button" variant="outline">
                Cancelar
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

export default function FiscalSettingsIndex({ issuers }: { issuers: FiscalIssuer[] }) {
  return (
    <AppLayout title="Configuración SUNAT">
      <Head title="Configuración SUNAT" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <p className="text-sm text-muted-foreground">Facturación electrónica</p>
          <h1 className="text-2xl font-semibold tracking-tight">Configuración SUNAT</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Emisor, Clave SOL y certificado digital usados para firmar y enviar comprobantes a SUNAT.
          </p>
        </div>

        {issuers.length === 0 ? (
          <Alert>
            <ShieldCheckIcon />
            <AlertTitle>Sin emisores configurados</AlertTitle>
            <AlertDescription>Crea el primer emisor fiscal para empezar a emitir comprobantes.</AlertDescription>
          </Alert>
        ) : (
          issuers.map((issuer) => <IssuerCard issuer={issuer} key={issuer.id} />)
        )}

        <NewIssuerCard />
      </div>
    </AppLayout>
  )
}
