import { usePage } from "@inertiajs/react"

import type { SharedProps } from "@/types"

/** Permisos del usuario actual, los mismos que valida el API. */
export function useCan() {
  const { permissions } = usePage<SharedProps>().props.auth
  return (permission: string) => permissions.includes(permission)
}
