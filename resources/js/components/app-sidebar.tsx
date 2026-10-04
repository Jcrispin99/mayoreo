import { Link, router, usePage } from "@inertiajs/react"
import {
  ArrowLeftRightIcon,
  BoxesIcon,
  ChevronUpIcon,
  HomeIcon,
  HistoryIcon,
  LogOutIcon,
  PackageCheckIcon,
  PackageIcon,
  QrCodeIcon,
  RulerIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  WarehouseIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { SharedProps } from "@/types"

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function AppSidebar() {
  const page = usePage<SharedProps>()
  const { user, permissions } = page.props.auth
  const can = (permission: string) => permissions.includes(permission)
  const groups = [
    {
      label: "Navegación",
      items: [
        { title: "Inicio", href: "/", icon: HomeIcon, visible: true },
        { title: "Ventas históricas", href: "/historical-sales", icon: HistoryIcon, visible: can("sales.manage") },
        { title: "QR de asistencia", href: "/attendance-qr", icon: QrCodeIcon, visible: can("attendance-qr.manage") },
        { title: "Configuración SUNAT", href: "/fiscal-settings", icon: ShieldCheckIcon, visible: can("fiscal-settings.view") },
      ],
    },
    {
      label: "Catálogo",
      items: [
        { title: "Productos", href: "/catalog/products", icon: PackageIcon, visible: can("products.view") },
        { title: "Unidades de medida", href: "/catalog/units", icon: RulerIcon, visible: can("products.view") },
      ],
    },
    {
      label: "Inventario",
      items: [
        { title: "Stock", href: "/inventory/stock", icon: BoxesIcon, visible: can("stock.view") },
        { title: "Kardex", href: "/inventory/movements", icon: ArrowLeftRightIcon, visible: can("stock.view") },
        { title: "Tiendas y almacenes", href: "/inventory/locations", icon: WarehouseIcon, visible: can("stores.view") },
      ],
    },
    {
      label: "Cuenta",
      items: [
        { title: "Mi perfil", href: "/profile", icon: UserRoundIcon, visible: true },
      ],
    },
  ]

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Mayoreo"
              render={<Link href="/" />}
            >
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <PackageCheckIcon className="size-4" />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">Mayoreo</span>
                <span className="truncate text-xs text-muted-foreground">
                  Gestión comercial
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => {
          const items = group.items.filter((item) => item.visible)
          if (items.length === 0) return null

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={
                          item.href === "/"
                            ? page.url === "/"
                            : page.url.startsWith(item.href)
                        }
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton size="lg" />}
              >
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </span>
                <ChevronUpIcon className="ml-auto" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-60">
                <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.visit("/profile")}>
                  <UserRoundIcon />
                  Administrar perfil
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => router.post("/logout")}
                >
                  <LogOutIcon />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
