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
  /** Permiso del backend requerido para ver este ítem (ej. 'products.view'). */
  permission?: string;
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
        description: 'Productos',
        icon: 'package-variant-closed',
        group: 'Catálogo',
        permission: 'products.view',
      },
      {
        id: 'stores',
        title: 'Tiendas',
        description: 'Locales y sus almacenes',
        icon: 'storefront-outline',
        group: 'Ubicaciones',
        permission: 'stores.view',
      },
      {
        id: 'warehouses',
        title: 'Almacenes',
        description: 'Stock por ubicación',
        icon: 'warehouse',
        group: 'Ubicaciones',
        permission: 'warehouses.view',
      },
      {
        id: 'units',
        title: 'Unidades de medida',
        description: 'Unidades disponibles para productos',
        icon: 'scale-balance',
        group: 'Catálogo',
        permission: 'products.view',
      },
      {
        id: 'movements',
        title: 'Kardex',
        description: 'Entradas y salidas de inventario',
        icon: 'swap-vertical',
        group: 'Operaciones',
        permission: 'stock.view',
      },
      {
        id: 'pos-supply-requests',
        title: 'Comandas POS',
        description: 'Pedidos de stock desde las cajas',
        icon: 'clipboard-list-outline',
        group: 'Operaciones',
        permission: 'pos-supply-requests.view-assigned',
      },
    ],
  },
  {
    id: 'transfers',
    title: 'Traslados',
    subtitle: 'Envíos entre almacenes',
    icon: 'truck-fast-outline',
    color: MODULE_COLORS.transfers.color,
    softColor: MODULE_COLORS.transfers.softColor,
    order: 15,
    items: [
      {
        id: 'transfer-list',
        title: 'Traslados',
        description: 'Envíos y recepciones de stock',
        icon: 'truck-fast-outline',
        group: 'Operaciones',
        permission: 'inventory-transfers.view',
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
        permission: 'purchase-orders.view',
      },
      {
        id: 'supplier-price-comparison',
        title: 'Comparador de precios',
        description: 'Últimos costos por proveedor y variante',
        icon: 'compare-horizontal',
        group: 'Análisis',
        permission: 'purchase-orders.view',
      },
      {
        id: 'suppliers',
        title: 'Proveedores',
        description: 'Catálogo de proveedores',
        icon: 'truck-delivery-outline',
        group: 'Catálogo',
        permission: 'suppliers.view',
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
        permission: 'pos-config.view',
      },
      {
        id: 'document-series',
        title: 'Series y correlativos',
        description: 'Catálogo de series de venta',
        icon: 'file-document-outline',
        group: 'Configuración',
        permission: 'pos-config.view',
      },
      {
        id: 'payment-methods',
        title: 'Métodos de pago',
        description: 'Formas de pago admitidas en caja',
        icon: 'credit-card-multiple-outline',
        group: 'Configuración',
        permission: 'cash-sessions.view',
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
        description: 'Clientes',
        icon: 'account-multiple-outline',
        group: 'Directorio',
        permission: 'customers.view',
      },
    ],
  },
  {
    id: 'accounting',
    title: 'Ventas',
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
        permission: 'sales.view',
      },
    ],
  },
  {
    id: 'access',
    title: 'Personal',
    subtitle: 'Usuarios, asistencia y planillas',
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
        permission: 'users.view',
      },
      {
        id: 'attendance',
        title: 'Asistencia',
        description: 'Entradas, salidas e incidencias',
        icon: 'calendar-clock-outline',
        group: 'Operaciones',
        permission: 'attendance.view',
      },
      {
        id: 'attendance-mark',
        title: 'Marcar asistencia',
        description: 'Escanear entrada o salida',
        icon: 'qrcode-scan',
        group: 'Mi asistencia',
        permission: 'attendance.mark',
      },
      {
        id: 'payroll',
        title: 'Planillas',
        description: 'Periodos y pagos del personal',
        icon: 'cash-multiple',
        group: 'Remuneraciones',
        permission: 'payroll.view',
      },
      {
        id: 'special-days',
        title: 'Días especiales',
        description: 'Recompensas por asistencia en fechas especiales',
        icon: 'calendar-star',
        group: 'Remuneraciones',
        permission: 'payroll.view',
      },
      {
        id: 'attendance-qr',
        title: 'QR de asistencia',
        description: 'Código de marcación por tienda',
        icon: 'qrcode',
        group: 'Configuración',
        permission: 'attendance-qr.manage',
      },
      {
        id: 'roles',
        title: 'Roles y permisos',
        description: 'Roles y permisos asignados',
        icon: 'shield-account-outline',
        group: 'Accesos',
        permission: 'roles.view',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Ajustes',
    subtitle: 'SUNAT e integraciones del sistema',
    icon: 'cog-outline',
    color: MODULE_COLORS.settings.color,
    softColor: MODULE_COLORS.settings.softColor,
    order: 70,
    items: [
      {
        id: 'sunat',
        title: 'SUNAT',
        description: 'Emisores, certificados y establecimientos',
        icon: 'file-certificate-outline',
        group: 'Facturación electrónica',
        permission: 'fiscal-settings.view',
      },
    ],
  },
];

/**
 * Menú visible para el usuario. Si se pasan sus permisos (del endpoint /me),
 * oculta los ítems cuyo permiso no tenga y los módulos que queden vacíos.
 * Sin permisos conocidos (sesiones antiguas) muestra todo: el backend
 * igualmente rechaza con 403 lo no autorizado.
 */
export function getVisibleMenu(permissions?: string[]): MenuModule[] {
  const canView = (item: MenuItem) =>
    !item.permission || !permissions || permissions.includes(item.permission);

  return MENU_MODULES.filter((module) => module.enabled !== false)
    .map((module) => ({
      ...module,
      items: module.items.filter((item) => item.enabled !== false && canView(item)),
    }))
    .filter((module) => module.items.length > 0)
    .sort((a, b) => a.order - b.order);
}
