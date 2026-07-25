import { MODULE_COLORS } from '../theme/colors';

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
    color: MODULE_COLORS.inventory.color,
    softColor: MODULE_COLORS.inventory.softColor,
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
    color: MODULE_COLORS.purchases.color,
    softColor: MODULE_COLORS.purchases.softColor,
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
    id: 'pos',
    title: 'POS',
    subtitle: 'Cajas, cobros y correlativos',
    icon: 'cash-register',
    color: MODULE_COLORS.pos.color,
    softColor: MODULE_COLORS.pos.softColor,
    order: 30,
    items: [
      {
        id: 'cash-registers',
        title: 'Cajas',
        description: 'Almacén, series y correlativos',
        icon: 'cash-register',
        group: 'Configuración',
      },
      {
        id: 'document-series',
        title: 'Series y correlativos',
        description: 'Catálogo de series de venta',
        icon: 'file-document-outline',
        group: 'Configuración',
      },
      {
        id: 'payment-methods',
        title: 'Métodos de pago',
        description: 'Formas de pago admitidas en caja',
        icon: 'credit-card-multiple-outline',
        group: 'Configuración',
      },
    ],
  },
  {
    id: 'customers',
    title: 'Clientes',
    subtitle: 'Directorio y datos de contacto',
    icon: 'account-heart-outline',
    color: MODULE_COLORS.customers.color,
    softColor: MODULE_COLORS.customers.softColor,
    order: 40,
    items: [
      {
        id: 'customers',
        title: 'Clientes',
        description: 'Directorio de clientes',
        icon: 'account-multiple-outline',
        group: 'Directorio',
      },
    ],
  },
  {
    id: 'accounting',
    title: 'Contabilidad',
    subtitle: 'Ventas, cobros y análisis',
    icon: 'chart-box-outline',
    color: MODULE_COLORS.accounting.color,
    softColor: MODULE_COLORS.accounting.softColor,
    order: 50,
    items: [
      {
        id: 'sales',
        title: 'Ventas',
        description: 'Ventas POS y mayoristas',
        icon: 'receipt-text-check-outline',
        group: 'Operaciones',
      },
    ],
  },
  {
    id: 'access',
    title: 'Usuarios',
    subtitle: 'Usuarios, roles y permisos',
    icon: 'account-group-outline',
    color: MODULE_COLORS.access.color,
    softColor: MODULE_COLORS.access.softColor,
    order: 60,
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
