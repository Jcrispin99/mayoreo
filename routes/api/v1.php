<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\AssignedPosSupplyRequestController;
use App\Http\Controllers\Api\V1\AppNotificationController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CashRegisterController;
use App\Http\Controllers\Api\V1\CashRegisterMovementController;
use App\Http\Controllers\Api\V1\CashRegisterSessionController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\DocumentSeriesController;
use App\Http\Controllers\Api\V1\FiscalCertificateController;
use App\Http\Controllers\Api\V1\FiscalCredentialController;
use App\Http\Controllers\Api\V1\FiscalDocumentController;
use App\Http\Controllers\Api\V1\FiscalIssuerController;
use App\Http\Controllers\Api\V1\InventoryMovementController;
use App\Http\Controllers\Api\V1\InventoryTransferController;
use App\Http\Controllers\Api\V1\PermissionController;
use App\Http\Controllers\Api\V1\PosCatalogController;
use App\Http\Controllers\Api\V1\PosCheckoutController;
use App\Http\Controllers\Api\V1\PosOrderController;
use App\Http\Controllers\Api\V1\PosOrderItemController;
use App\Http\Controllers\Api\V1\PosOrderSupplyRequestController;
use App\Http\Controllers\Api\V1\PosPaymentMethodController;
use App\Http\Controllers\Api\V1\PriceTierController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\ProductPurchaseUnitController;
use App\Http\Controllers\Api\V1\ProductTemplateController;
use App\Http\Controllers\Api\V1\PurchaseOrderController;
use App\Http\Controllers\Api\V1\PushSubscriptionController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SaleController;
use App\Http\Controllers\Api\V1\StockController;
use App\Http\Controllers\Api\V1\StoreController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\UnitOfMeasureController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\UserRoleController;
use App\Http\Controllers\Api\V1\WarehouseController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API V1 Routes
|--------------------------------------------------------------------------
|
| Routes for API version 1.
|
*/

// Public routes with auth rate limiter (5/min - brute force protection)
Route::middleware('throttle:auth')->group(function (): void {
    Route::post('register', [AuthController::class, 'register'])->name('api.v1.register');
    Route::post('login', [AuthController::class, 'login'])->name('api.v1.login');
});

// Protected routes with authenticated rate limiter (120/min)
Route::middleware(['auth:sanctum', 'throttle:authenticated'])->group(function (): void {
    Route::post('logout', [AuthController::class, 'logout'])->name('api.v1.logout');
    Route::get('me', [AuthController::class, 'me'])->name('api.v1.me');
    Route::get('notifications', [AppNotificationController::class, 'index'])
        ->name('api.v1.notifications.index');
    Route::patch('notifications/read-all', [AppNotificationController::class, 'readAll'])
        ->name('api.v1.notifications.read-all');
    Route::patch('notifications/{notification}/read', [AppNotificationController::class, 'read'])
        ->name('api.v1.notifications.read');
    Route::post('push-subscriptions', [PushSubscriptionController::class, 'store'])
        ->name('api.v1.push-subscriptions.store');
    Route::delete('push-subscriptions/current', [PushSubscriptionController::class, 'destroy'])
        ->name('api.v1.push-subscriptions.destroy');

    // Email verification
    Route::post('email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
        ->middleware('signed')
        ->name('verification.verify');
    Route::post('email/resend', [AuthController::class, 'resendVerificationEmail'])
        ->middleware('throttle:6,1')
        ->name('verification.send');

    // Tiendas y almacenes
    Route::apiResource('stores', StoreController::class)
        ->middlewareFor(['index', 'show'], 'can:stores.view')
        ->middlewareFor(['store', 'update', 'destroy'], 'can:stores.manage')
        ->names('api.v1.stores');
    Route::apiResource('warehouses', WarehouseController::class)
        ->middlewareFor(['index', 'show'], 'can:warehouses.view')
        ->middlewareFor(['store', 'update', 'destroy'], 'can:warehouses.manage')
        ->names('api.v1.warehouses');

    // Configuración fiscal
    Route::get('fiscal-issuers', [FiscalIssuerController::class, 'index'])
        ->middleware('can:fiscal-settings.view')
        ->name('api.v1.fiscal-issuers.index');
    Route::get('fiscal-issuers/{fiscal_issuer}', [FiscalIssuerController::class, 'show'])
        ->middleware('can:fiscal-settings.view')
        ->name('api.v1.fiscal-issuers.show');
    Route::post('fiscal-issuers', [FiscalIssuerController::class, 'store'])
        ->middleware('can:fiscal-settings.manage')
        ->name('api.v1.fiscal-issuers.store');
    Route::match(['put', 'patch'], 'fiscal-issuers/{fiscal_issuer}', [FiscalIssuerController::class, 'update'])
        ->middleware('can:fiscal-settings.manage')
        ->name('api.v1.fiscal-issuers.update');
    Route::put('fiscal-issuers/{fiscal_issuer}/credentials', [FiscalCredentialController::class, 'update'])
        ->middleware('can:fiscal-credentials.manage')
        ->name('api.v1.fiscal-issuers.credentials.update');
    Route::delete('fiscal-issuers/{fiscal_issuer}/credentials', [FiscalCredentialController::class, 'destroy'])
        ->middleware('can:fiscal-credentials.manage')
        ->name('api.v1.fiscal-issuers.credentials.destroy');
    Route::post('fiscal-issuers/{fiscal_issuer}/certificate', [FiscalCertificateController::class, 'store'])
        ->middleware('can:fiscal-credentials.manage')
        ->name('api.v1.fiscal-issuers.certificate.store');
    Route::delete('fiscal-issuers/{fiscal_issuer}/certificate', [FiscalCertificateController::class, 'destroy'])
        ->middleware('can:fiscal-credentials.manage')
        ->name('api.v1.fiscal-issuers.certificate.destroy');

    // Clientes
    Route::apiResource('customers', CustomerController::class)
        ->middlewareFor(['index', 'show'], 'can:customers.view')
        ->middlewareFor(['store', 'update', 'destroy'], 'can:customers.manage')
        ->names('api.v1.customers');

    // Configuración POS
    Route::apiResource('cash-registers', CashRegisterController::class)
        ->only(['index', 'store', 'show', 'update'])
        ->middlewareFor(['index', 'show'], 'can:pos-config.view')
        ->middlewareFor(['store', 'update'], 'can:pos-config.manage')
        ->names('api.v1.cash-registers');
    Route::get('cash-register-sessions', [CashRegisterSessionController::class, 'index'])
        ->middleware('can:cash-sessions.view')
        ->name('api.v1.cash-register-sessions.index');
    Route::post('cash-registers/{cash_register}/sessions', [CashRegisterSessionController::class, 'store'])
        ->middleware('can:cash-sessions.manage')
        ->name('api.v1.cash-register-sessions.store');
    Route::get('cash-register-sessions/{cash_register_session}', [CashRegisterSessionController::class, 'show'])
        ->middleware('can:cash-sessions.view')
        ->name('api.v1.cash-register-sessions.show');
    Route::get('cash-register-sessions/{cash_register_session}/catalog', PosCatalogController::class)
        ->middleware('can:cash-sessions.view')
        ->name('api.v1.cash-register-sessions.catalog');
    Route::get('pos/payment-methods', [PosPaymentMethodController::class, 'index'])
        ->middleware('can:cash-sessions.view')
        ->name('api.v1.pos.payment-methods.index');
    Route::get('cash-register-sessions/{cash_register_session}/orders', [PosOrderController::class, 'index'])
        ->middleware('can:cash-sessions.view')
        ->name('api.v1.cash-register-sessions.orders.index');
    Route::post('cash-register-sessions/{cash_register_session}/orders', [PosOrderController::class, 'store'])
        ->middleware('can:cash-sessions.manage')
        ->name('api.v1.cash-register-sessions.orders.store');
    Route::get('cash-register-sessions/{cash_register_session}/orders/{pos_order}', [PosOrderController::class, 'show'])
        ->middleware('can:cash-sessions.view')
        ->name('api.v1.cash-register-sessions.orders.show');
    Route::patch('cash-register-sessions/{cash_register_session}/orders/{pos_order}/cancel', [PosOrderController::class, 'cancel'])
        ->middleware('can:cash-sessions.manage')
        ->name('api.v1.cash-register-sessions.orders.cancel');
    Route::patch('cash-register-sessions/{cash_register_session}/orders/{pos_order}/customer', [PosOrderController::class, 'updateCustomer'])
        ->middleware('can:cash-sessions.manage')
        ->name('api.v1.cash-register-sessions.orders.customer.update');
    Route::patch('cash-register-sessions/{cash_register_session}/orders/{pos_order}/warehouse-notes', [PosOrderController::class, 'updateWarehouseNotes'])
        ->middleware('can:cash-sessions.manage')
        ->name('api.v1.cash-register-sessions.orders.warehouse-notes.update');
    Route::post('cash-register-sessions/{cash_register_session}/orders/{pos_order}/checkout', PosCheckoutController::class)
        ->middleware('can:cash-sessions.manage')
        ->name('api.v1.cash-register-sessions.orders.checkout');
    Route::post('cash-register-sessions/{cash_register_session}/orders/{pos_order}/items', [PosOrderItemController::class, 'store'])
        ->middleware('can:cash-sessions.manage')
        ->name('api.v1.cash-register-sessions.orders.items.store');
    Route::patch('cash-register-sessions/{cash_register_session}/orders/{pos_order}/items/{item}', [PosOrderItemController::class, 'update'])
        ->middleware('can:cash-sessions.manage')
        ->name('api.v1.cash-register-sessions.orders.items.update');
    Route::delete('cash-register-sessions/{cash_register_session}/orders/{pos_order}/items/{item}', [PosOrderItemController::class, 'destroy'])
        ->middleware('can:cash-sessions.manage')
        ->name('api.v1.cash-register-sessions.orders.items.destroy');
    Route::post('cash-register-sessions/{cash_register_session}/orders/{pos_order}/supply-requests', [PosOrderSupplyRequestController::class, 'store'])
        ->middleware('can:pos-supply-requests.assign')
        ->name('api.v1.cash-register-sessions.orders.supply-requests.store');
    Route::get('pos/supply-assignees', [PosOrderSupplyRequestController::class, 'assignees'])
        ->middleware('can:pos-supply-requests.assign')
        ->name('api.v1.pos.supply-assignees.index');
    Route::post('cash-register-sessions/{cash_register_session}/orders/{pos_order}/supply-requests/{pos_supply_request}/receive', [PosOrderSupplyRequestController::class, 'receive'])
        ->middleware('can:pos-supply-requests.assign')
        ->name('api.v1.cash-register-sessions.orders.supply-requests.receive');
    Route::post('cash-register-sessions/{cash_register_session}/movements', [CashRegisterMovementController::class, 'store'])
        ->middleware('can:cash-sessions.manage')
        ->name('api.v1.cash-register-movements.store');
    Route::post('cash-register-sessions/{cash_register_session}/close', [CashRegisterSessionController::class, 'close'])
        ->middleware('can:cash-sessions.manage')
        ->name('api.v1.cash-register-sessions.close');
    Route::apiResource('document-series', DocumentSeriesController::class)
        ->only(['index', 'store', 'show', 'update'])
        ->middlewareFor(['index', 'show'], 'can:pos-config.view')
        ->middlewareFor(['store', 'update'], 'can:pos-config.manage')
        ->names('api.v1.document-series');

    // Usuarios, roles y permisos
    Route::apiResource('users', UserController::class)
        ->middlewareFor(['index', 'show'], 'can:users.view')
        ->middlewareFor(['store', 'update', 'destroy'], 'can:users.manage')
        ->names('api.v1.users');
    Route::put('users/{user}/roles', [UserRoleController::class, 'update'])
        ->middleware('can:users.manage')
        ->name('api.v1.users.roles.update');
    Route::apiResource('roles', RoleController::class)
        ->middlewareFor(['index', 'show'], 'can:roles.view')
        ->middlewareFor(['store', 'update', 'destroy'], 'can:roles.manage')
        ->names('api.v1.roles');
    Route::apiResource('permissions', PermissionController::class)
        ->only(['index'])
        ->middleware('can:roles.view')
        ->names('api.v1.permissions');

    // Catálogo
    Route::apiResource('units-of-measure', UnitOfMeasureController::class)
        ->parameters(['units-of-measure' => 'unit_of_measure'])
        ->middlewareFor(['index', 'show'], 'can:products.view')
        ->middlewareFor(['store', 'update', 'destroy'], 'can:products.manage')
        ->names('api.v1.units-of-measure');
    Route::apiResource('products', ProductController::class)
        ->middlewareFor(['index', 'show'], 'can:products.view')
        ->middlewareFor(['store', 'update', 'destroy'], 'can:products.manage')
        ->names('api.v1.products');
    Route::apiResource('product-templates', ProductTemplateController::class)
        ->only(['index', 'store', 'show', 'update'])
        ->middlewareFor(['index', 'show'], 'can:products.view')
        ->middlewareFor(['store', 'update'], 'can:products.manage')
        ->names('api.v1.product-templates');
    Route::post('products/{product}/image', [ProductController::class, 'uploadImage'])
        ->middleware('can:products.manage')
        ->name('api.v1.products.image');
    Route::apiResource('products.purchase-units', ProductPurchaseUnitController::class)
        ->shallow()
        ->middlewareFor(['index', 'show'], 'can:products.view')
        ->middlewareFor(['store', 'update', 'destroy'], 'can:products.manage')
        ->names('api.v1.products.purchase-units');
    Route::apiResource('products.price-tiers', PriceTierController::class)
        ->shallow()
        ->middlewareFor(['index', 'show'], 'can:products.view')
        ->middlewareFor(['store', 'update', 'destroy'], 'can:products.manage')
        ->names('api.v1.products.price-tiers');

    // Stock (Kardex)
    Route::get('stocks', [StockController::class, 'index'])
        ->middleware('can:stock.view')
        ->name('api.v1.stocks.index');
    Route::post('stocks/adjust', [StockController::class, 'adjust'])
        ->middleware('can:stock.manage')
        ->name('api.v1.stocks.adjust');
    Route::get('inventory-movements', [InventoryMovementController::class, 'index'])
        ->middleware('can:stock.view')
        ->name('api.v1.inventory-movements.index');

    // Proveedores y compras
    Route::apiResource('suppliers', SupplierController::class)
        ->middlewareFor(['index', 'show'], 'can:suppliers.view')
        ->middlewareFor(['store', 'update', 'destroy'], 'can:suppliers.manage')
        ->names('api.v1.suppliers');
    Route::apiResource('purchase-orders', PurchaseOrderController::class)
        ->only(['index', 'store', 'show', 'update'])
        ->middlewareFor(['index', 'show'], 'can:purchase-orders.view')
        ->middlewareFor(['store', 'update'], 'can:purchase-orders.manage')
        ->names('api.v1.purchase-orders');
    Route::post('purchase-orders/{purchase_order}/confirm', [PurchaseOrderController::class, 'confirm'])
        ->middleware('can:purchase-orders.manage')
        ->name('api.v1.purchase-orders.confirm');

    // Transferencias
    Route::apiResource('inventory-transfers', InventoryTransferController::class)
        ->only(['index', 'store', 'show'])
        ->middlewareFor(['index', 'show'], 'can:inventory-transfers.view')
        ->middlewareFor(['store'], 'can:inventory-transfers.manage')
        ->names('api.v1.inventory-transfers');
    Route::post('inventory-transfers/{inventory_transfer}/dispatch', [InventoryTransferController::class, 'dispatch'])
        ->middleware('can:inventory-transfers.manage')
        ->name('api.v1.inventory-transfers.dispatch');
    Route::post('inventory-transfers/{inventory_transfer}/receive', [InventoryTransferController::class, 'receive'])
        ->middleware('can:inventory-transfers.manage')
        ->name('api.v1.inventory-transfers.receive');
    Route::post('inventory-transfers/{inventory_transfer}/resolve', [InventoryTransferController::class, 'resolve'])
        ->middleware('can:inventory-transfers.manage')
        ->name('api.v1.inventory-transfers.resolve');
    Route::get('warehouse/supply-requests', [AssignedPosSupplyRequestController::class, 'index'])
        ->middleware('can:pos-supply-requests.view-assigned')
        ->name('api.v1.warehouse.supply-requests.index');
    Route::post('warehouse/supply-requests/{pos_supply_request}/acknowledge', [AssignedPosSupplyRequestController::class, 'acknowledge'])
        ->middleware('can:pos-supply-requests.prepare-assigned')
        ->name('api.v1.warehouse.supply-requests.acknowledge');
    Route::patch('warehouse/supply-requests/{pos_supply_request}/items/{item}', [AssignedPosSupplyRequestController::class, 'updateItem'])
        ->middleware('can:pos-supply-requests.prepare-assigned')
        ->name('api.v1.warehouse.supply-requests.items.update');
    Route::post('warehouse/supply-requests/{pos_supply_request}/ready', [AssignedPosSupplyRequestController::class, 'ready'])
        ->middleware('can:pos-supply-requests.prepare-assigned')
        ->name('api.v1.warehouse.supply-requests.ready');

    // Ventas / POS
    Route::get('sales/summary', [SaleController::class, 'summary'])
        ->middleware('can:sales.view')
        ->name('api.v1.sales.summary');
    Route::apiResource('sales', SaleController::class)
        ->only(['index', 'store', 'show'])
        ->middlewareFor(['index', 'show'], 'can:sales.view')
        ->middlewareFor(['store'], 'can:sales.manage')
        ->names('api.v1.sales');
    Route::get('sales/{sale}/fiscal-documents', [FiscalDocumentController::class, 'index'])
        ->middleware('can:sales.view')
        ->name('api.v1.sales.fiscal-documents.index');
    Route::post('sales/{sale}/fiscal-documents', [FiscalDocumentController::class, 'store'])
        ->middleware('can:sales.manage')
        ->name('api.v1.sales.fiscal-documents.store');
    Route::post('fiscal-documents/{fiscal_document}/send', [FiscalDocumentController::class, 'send'])
        ->middleware('can:sales.manage')
        ->name('api.v1.fiscal-documents.send');
});

// Password reset routes (public with rate limiting)
Route::middleware('throttle:6,1')->group(function (): void {
    Route::post('forgot-password', [AuthController::class, 'forgotPassword'])
        ->name('password.email');
    Route::post('reset-password', [AuthController::class, 'resetPassword'])
        ->name('password.reset');
});
