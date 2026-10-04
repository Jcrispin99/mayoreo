import { Head, Link, usePage } from "@inertiajs/react"
import {
  ArrowLeftIcon,
  BoxesIcon,
  ChartNoAxesColumnIncreasingIcon,
  CircleDollarSignIcon,
  InfoIcon,
  PackagePlusIcon,
  ShoppingBasketIcon,
} from "lucide-react"
import { useState } from "react"

import { PageHeading } from "@/components/catalog/page-heading"
import { ProductGeneralForm } from "@/components/catalog/product-general-form"
import { ProductPresentationsEditor } from "@/components/catalog/product-presentations-editor"
import { ProductPriceTiers } from "@/components/catalog/product-price-tiers"
import { ProductPurchaseUnits } from "@/components/catalog/product-purchase-units"
import { ProductStockPanel } from "@/components/catalog/product-stock-panel"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApi } from "@/hooks/use-api"
import { useCan } from "@/hooks/use-can"
import { AppLayout } from "@/layouts/app-layout"
import { api } from "@/lib/api"
import type { ProductTemplate, Unit } from "@/types/catalog"

type Tab = "general" | "presentations" | "prices" | "stock" | "purchases"

export default function ProductEdit({ templateId }: { templateId: number | null }) {
  const can = useCan()
  const canManage = can("products.manage")
  const page = usePage()
  const requestedTab = new URLSearchParams(page.url.split("?")[1] ?? "").get("tab")
  const initialTab: Tab = requestedTab === "variants" || requestedTab === "presentations" ? "presentations" : "general"
  const [tab, setTab] = useState<Tab>(initialTab)

  const { data, setData, loading, error, reload } = useApi(async () => {
    const [units, template] = await Promise.all([
      api.get<Unit[]>("/units-of-measure"),
      templateId ? api.get<ProductTemplate>(`/product-templates/${templateId}`) : Promise.resolve(null),
    ])
    return { units, template }
  }, [templateId], "No se pudo cargar el producto.")

  const template = data?.template ?? null
  const units = data?.units ?? []
  const title = templateId ? (template?.name ?? "Producto") : "Nuevo producto"

  function replaceTemplate(next: ProductTemplate) {
    setData((current) => (current ? { ...current, template: next } : current))
  }

  async function refreshTemplate() {
    if (!templateId) return
    replaceTemplate(await api.get<ProductTemplate>(`/product-templates/${templateId}`))
  }

  return (
    <AppLayout title={title}>
      <Head title={title} />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <Button
          className="-ml-2 self-start text-muted-foreground"
          nativeButton={false}
          size="sm"
          variant="ghost"
          render={<Link href="/catalog/products" />}
        >
          <ArrowLeftIcon /> Volver a productos
        </Button>

        <PageHeading
          eyebrow="Catálogo / Productos"
          title={title}
          description={
            template ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge variant={template.is_active ? "secondary" : "outline"}>{template.is_active ? "Activo" : "Inactivo"}</Badge>
                {!template.is_pos_visible ? <Badge variant="outline">Oculto en POS</Badge> : null}
                <span>
                  {Math.max(template.variants.filter((variant) => variant.is_active).length - 1, 0)} variante(s)
                </span>
              </span>
            ) : undefined
          }
          actions={template && canManage ? (
            <Button onClick={() => setTab("presentations")}>
              <PackagePlusIcon /> Configurar variantes
            </Button>
          ) : undefined}
        />

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {error}{" "}
              <button className="underline" type="button" onClick={() => void reload()}>
                Reintentar
              </button>
            </AlertDescription>
          </Alert>
        ) : null}

        {loading && !data ? (
          <Skeleton className="h-96 w-full" />
        ) : !templateId ? (
          <ProductGeneralForm template={null} units={units} canManage={canManage} onSaved={replaceTemplate} />
        ) : template ? (
          <Tabs className="gap-4" value={tab} onValueChange={(value) => setTab(value as Tab)}>
            <div className="overflow-x-auto border-b">
              <TabsList className="h-auto min-w-max gap-1 rounded-none bg-transparent p-0" variant="line">
                <TabsTrigger className="h-11 px-3" value="general">
                  <InfoIcon /> General
                </TabsTrigger>
                <TabsTrigger className="h-11 px-3" value="presentations">
                  <BoxesIcon /> Variantes
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {Math.max(template.variants.filter((variant) => variant.is_active).length - 1, 0)}
                  </span>
                </TabsTrigger>
                <TabsTrigger className="h-11 px-3" value="prices">
                  <CircleDollarSignIcon /> Precios
                </TabsTrigger>
                {can("stock.view") ? (
                  <TabsTrigger className="h-11 px-3" value="stock">
                    <ChartNoAxesColumnIncreasingIcon /> Stock
                  </TabsTrigger>
                ) : null}
                <TabsTrigger className="h-11 px-3" value="purchases">
                  <ShoppingBasketIcon /> Compras
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent keepMounted value="general" className="data-hidden:hidden">
              <ProductGeneralForm template={template} units={units} canManage={canManage} onSaved={replaceTemplate} />
            </TabsContent>
            <TabsContent keepMounted value="presentations" className="data-hidden:hidden">
              <ProductPresentationsEditor template={template} units={units} canManage={canManage} onSaved={replaceTemplate} />
            </TabsContent>
            <TabsContent value="prices">
              <ProductPriceTiers template={template} units={units} canManage={canManage} onChanged={refreshTemplate} />
            </TabsContent>
            {can("stock.view") ? (
              <TabsContent value="stock">
                <ProductStockPanel
                  template={template}
                  units={units}
                  canManage={can("stock.manage")}
                  canSeeWarehouses={can("warehouses.view")}
                />
              </TabsContent>
            ) : null}
            <TabsContent value="purchases">
              <ProductPurchaseUnits template={template} units={units} canManage={canManage} onChanged={refreshTemplate} />
            </TabsContent>
          </Tabs>
        ) : null}
      </div>
    </AppLayout>
  )
}
