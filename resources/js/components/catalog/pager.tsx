import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

type PagerProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Pager({ page, pageSize, total, onPageChange }: PagerProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-sm text-muted-foreground">
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeftIcon /> Anterior
        </Button>
        <Button size="sm" variant="outline" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
          Siguiente <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize)
}
