import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { errorMessage } from "@/lib/api"

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => Promise<void>
}

/** Confirmación para acciones destructivas; muestra el error del API si falla. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Eliminar", onConfirm }: ConfirmDialogProps) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState("")

  async function confirm() {
    setWorking(true)
    setError("")
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (requestError) {
      setError(errorMessage(requestError, "No se pudo completar la acción."))
    } finally {
      setWorking(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError("")
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={working}>
            {working ? "Procesando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
