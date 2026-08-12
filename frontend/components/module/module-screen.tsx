import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { getVisibleMenu } from '../../config/menu';
import { useAuth } from '../../lib/auth-context';
import { AccessReferenceList } from '../../features/access/access-reference-list';
import { AccountingSaleList } from '../../features/accounting/accounting-sale-list';
import { CustomerList } from '../../features/customers/customer-list';
import { InventoryReferenceList } from '../../features/inventory/inventory-reference-list';
import { InventoryMovementList } from '../../features/inventory/inventory-movement-list';
import { PosSupplyRequestList } from '../../features/inventory/pos-supply-request-list';
import { ProductList, type ProductSummary } from '../../features/products/product-list';
import { PurchaseOrderList } from '../../features/purchases/purchase-order-list';
import { SupplierPriceComparison } from '../../features/purchases/supplier-price-comparison';
import { SupplierList } from '../../features/purchases/supplier-list';
import { CashRegisterList } from '../../features/pos/cash-register-list';
import { DocumentSeriesList } from '../../features/pos/document-series-list';
import { PosPaymentMethodList } from '../../features/pos/pos-payment-method-list';
import { SunatSettingsScreen } from '../../features/settings/sunat-settings-screen';
import { ModuleLayout } from './module-layout';

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function ModuleScreen() {
  const { user } = useAuth();
  const { moduleId: moduleParam, itemId: itemParam } = useLocalSearchParams<{
    moduleId: string | string[];
    itemId?: string | string[];
  }>();
  const moduleId = firstParam(moduleParam);
  const requestedItemId = firstParam(itemParam);
  const modules = useMemo(() => getVisibleMenu(user?.permissions), [user?.permissions]);
  const module = modules.find((candidate) => candidate.id === moduleId);

  if (!module) return <Redirect href="/home" />;

  const selectedItem = module.items.find((item) => item.id === requestedItemId) ?? module.items[0];

  function editProduct(product: ProductSummary) {
    router.push({ pathname: '/products/[productId]', params: { productId: String(product.id) } } as Href);
  }

  return (
    <ModuleLayout module={module} selectedItemId={selectedItem.id}>
      {module.id === 'inventory' && selectedItem.id === 'product-list' ? (
        <ProductList
          onCreate={() => router.push('/products/new')}
          onEdit={editProduct}
        />
      ) : module.id === 'inventory' && selectedItem.id === 'stores' ? (
        <InventoryReferenceList kind="stores" />
      ) : selectedItem.id === 'units' ? (
        <InventoryReferenceList kind="units" />
      ) : selectedItem.id === 'warehouses' ? (
        <InventoryReferenceList kind="warehouses" />
      ) : module.id === 'inventory' && selectedItem.id === 'movements' ? (
        <InventoryMovementList />
      ) : module.id === 'inventory' && selectedItem.id === 'pos-supply-requests' ? (
        <PosSupplyRequestList />
      ) : module.id === 'purchases' && selectedItem.id === 'purchase-orders' ? (
        <PurchaseOrderList />
      ) : module.id === 'purchases' && selectedItem.id === 'supplier-price-comparison' ? (
        <SupplierPriceComparison />
      ) : module.id === 'purchases' && selectedItem.id === 'suppliers' ? (
        <SupplierList />
      ) : module.id === 'pos' && selectedItem.id === 'cash-registers' ? (
        <CashRegisterList />
      ) : module.id === 'pos' && selectedItem.id === 'document-series' ? (
        <DocumentSeriesList />
      ) : module.id === 'pos' && selectedItem.id === 'payment-methods' ? (
        <PosPaymentMethodList />
      ) : module.id === 'customers' && selectedItem.id === 'customers' ? (
        <CustomerList />
      ) : module.id === 'accounting' && selectedItem.id === 'sales' ? (
        <AccountingSaleList />
      ) : module.id === 'access' && selectedItem.id === 'users' ? (
        <AccessReferenceList kind="users" />
      ) : module.id === 'access' && selectedItem.id === 'roles' ? (
        <AccessReferenceList kind="roles" />
      ) : module.id === 'settings' && selectedItem.id === 'sunat' ? (
        <SunatSettingsScreen />
      ) : (
        <View />
      )}
    </ModuleLayout>
  );
}
