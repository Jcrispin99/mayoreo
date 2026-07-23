import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { View } from 'react-native';
import { getVisibleMenu } from '../../config/menu';
import { AccessReferenceList } from '../../features/access/access-reference-list';
import { InventoryReferenceList } from '../../features/inventory/inventory-reference-list';
import { InventoryMovementList } from '../../features/inventory/inventory-movement-list';
import { ProductList, type ProductSummary } from '../../features/products/product-list';
import { PurchaseOrderList } from '../../features/purchases/purchase-order-list';
import { SupplierList } from '../../features/purchases/supplier-list';
import { CashRegisterList } from '../../features/pos/cash-register-list';
import { DocumentSeriesList } from '../../features/pos/document-series-list';
import { ModuleLayout } from './module-layout';

const APP_MODULES = getVisibleMenu();

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function ModuleScreen() {
  const { moduleId: moduleParam, itemId: itemParam } = useLocalSearchParams<{
    moduleId: string | string[];
    itemId?: string | string[];
  }>();
  const moduleId = firstParam(moduleParam);
  const requestedItemId = firstParam(itemParam);
  const module = APP_MODULES.find((candidate) => candidate.id === moduleId);

  if (!module) return <Redirect href="/home" />;

  const selectedItem = module.items.find((item) => item.id === requestedItemId) ?? module.items[0];

  function editProduct(product: ProductSummary) {
    router.push({ pathname: '/products/[productId]', params: { productId: String(product.id) } } as Href);
  }

  return (
    <ModuleLayout module={module} selectedItemId={selectedItem.id}>
      {module.id === 'inventory' && selectedItem.id === 'product-list' ? (
        <ProductList onCreate={() => router.push('/products/new')} onEdit={editProduct} />
      ) : module.id === 'inventory' && selectedItem.id === 'stores' ? (
        <InventoryReferenceList kind="stores" />
      ) : selectedItem.id === 'units' ? (
        <InventoryReferenceList kind="units" />
      ) : selectedItem.id === 'warehouses' ? (
        <InventoryReferenceList kind="warehouses" />
      ) : module.id === 'inventory' && selectedItem.id === 'movements' ? (
        <InventoryMovementList />
      ) : module.id === 'purchases' && selectedItem.id === 'purchase-orders' ? (
        <PurchaseOrderList />
      ) : module.id === 'purchases' && selectedItem.id === 'suppliers' ? (
        <SupplierList />
      ) : module.id === 'pos' && selectedItem.id === 'cash-registers' ? (
        <CashRegisterList />
      ) : module.id === 'pos' && selectedItem.id === 'document-series' ? (
        <DocumentSeriesList />
      ) : module.id === 'access' && selectedItem.id === 'users' ? (
        <AccessReferenceList kind="users" />
      ) : module.id === 'access' && selectedItem.id === 'roles' ? (
        <AccessReferenceList kind="roles" />
      ) : (
        <View />
      )}
    </ModuleLayout>
  );
}
