/**
 * Configuración central del launcher.
 *
 * - Cambia `order` para reordenar los módulos.
 * - Usa `enabled: false` para ocultar un módulo o submenú.
 * - `icon` es un nombre de MaterialCommunityIcons (renderizado con react-native-paper's Icon).
 * - Cuando exista una pantalla real, agrega su ruta (por ejemplo: '/products/new').
 */
export type MenuItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
  group: string;
  route?: string;
  enabled?: boolean;
  badge?: string;
};

export type MenuModule = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  softColor: string;
  order: number;
  enabled?: boolean;
  items: MenuItem[];
};

export const MENU_MODULES: MenuModule[] = [
  {
    id: 'inventory',
    title: 'Inventario',
    subtitle: 'Productos, tiendas y almacenes',
    icon: 'warehouse',
    color: '#168C8C',
    softColor: '#E1F5F3',
    order: 10,
    items: [
      {
        id: 'product-list',
        title: 'Productos',
        description: 'Catálogo de productos',
        icon: 'package-variant-closed',
        group: 'Catálogo',
      },
      {
        id: 'stores',
        title: 'Tiendas',
        description: 'Locales y sus almacenes',
        icon: 'storefront-outline',
        group: 'Ubicaciones',
      },
      {
        id: 'warehouses',
        title: 'Almacenes',
        description: 'Existencias por ubicación',
        icon: 'warehouse',
        group: 'Ubicaciones',
      },
      {
        id: 'units',
        title: 'Unidades de medida',
        description: 'Unidades disponibles para productos',
        icon: 'scale-balance',
        group: 'Catálogo',
      },
      {
        id: 'movements',
        title: 'Kardex',
        description: 'Entradas y salidas de inventario',
        icon: 'swap-vertical',
        group: 'Operaciones',
      },
    ],
  },
  {
    id: 'purchases',
    title: 'Compras',
    subtitle: 'Órdenes de compra y proveedores',
    icon: 'cart-arrow-down',
    color: '#C26A34',
    softColor: '#FBEDE3',
    order: 20,
    items: [
      {
        id: 'purchase-orders',
        title: 'Compras',
        description: 'Compras guardadas como borrador',
        icon: 'file-document-edit-outline',
        group: 'Operaciones',
      },
      {
        id: 'suppliers',
        title: 'Proveedores',
        description: 'Catálogo de proveedores',
        icon: 'truck-delivery-outline',
        group: 'Catálogo',
      },
    ],
  },
  {
    id: 'access',
    title: 'Usuarios',
    subtitle: 'Usuarios, roles y permisos',
    icon: 'account-group-outline',
    color: '#73547B',
    softColor: '#F0EAF2',
    order: 30,
    items: [
      {
        id: 'users',
        title: 'Usuarios',
        description: 'Cuentas y accesos al sistema',
        icon: 'account-multiple-outline',
        group: 'Accesos',
      },
      {
        id: 'roles',
        title: 'Roles',
        description: 'Roles y permisos asignados',
        icon: 'shield-account-outline',
        group: 'Accesos',
      },
    ],
  },
];

export function getVisibleMenu(): MenuModule[] {
  return MENU_MODULES.filter((module) => module.enabled !== false)
    .map((module) => ({
      ...module,
      items: module.items.filter((item) => item.enabled !== false),
    }))
    .sort((a, b) => a.order - b.order);
}
