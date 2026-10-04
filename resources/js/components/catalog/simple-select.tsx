import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type SelectOption = { value: string; label: string }

type SimpleSelectProps = {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}

/** Select con etiquetas visibles para el valor elegido (no el id). */
export function SimpleSelect({ value, options, onChange, placeholder, disabled, invalid, className }: SimpleSelectProps) {
  return (
    <Select
      items={options}
      value={value === "" ? null : value}
      onValueChange={(next) => onChange(typeof next === "string" ? next : "")}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? "w-full"} aria-invalid={invalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
