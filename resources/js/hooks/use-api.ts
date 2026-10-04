import { useCallback, useEffect, useRef, useState, type DependencyList } from "react"

import { errorMessage } from "@/lib/api"

/**
 * Carga datos del API al montar (y cuando cambian las dependencias).
 * `reload` vuelve a pedirlos sin vaciar la pantalla.
 */
export function useApi<T>(loader: () => Promise<T>, deps: DependencyList, fallbackError = "No se pudo cargar la información.") {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const reload = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setData(await loaderRef.current())
    } catch (requestError) {
      setError(errorMessage(requestError, fallbackError))
    } finally {
      setLoading(false)
    }
  }, [fallbackError])

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, setData, loading, error, reload }
}
