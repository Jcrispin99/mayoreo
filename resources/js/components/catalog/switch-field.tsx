import { Switch } from "@/components/ui/switch"

type SwitchFieldProps = {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}

export function SwitchField({ label, description, checked, disabled, onCheckedChange }: SwitchFieldProps) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <span className="grid gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </label>
  )
}
