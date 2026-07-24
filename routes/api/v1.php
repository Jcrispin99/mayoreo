<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CashRegisterController;
use App\Http\Controllers\Api\V1\CashRegisterMovementController;
use App\Http\Controllers\Api\V1\CashRegisterSessionController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\DocumentSeriesController;
use App\Http\Controllers\Api\V1\FiscalDocumentController;
use App\Http\Controllers\Api\V1\InventoryMovementController;
use App\Http\Controllers\Api\V1\InventoryTransferController;
use App\Http\Controllers\Api\V1\PermissionController;
use App\Http\Controllers\Api\V1\PosCatalogController;
use App\Http\Controllers\Api\V1\PosCheckoutController;
use App\Http\Controllers\Api\V1\PosOrderController;
use App\Http\Controllers\Api\V1\PosOrderItemController;
use App\Http\Controllers\Api\V1\PosPaymentMethodController;
use App\Http\Controllers\Api\V1\PriceTierController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\ProductPurchaseUnitController;
use App\Http\Controllers\Api\V1\PurchaseOrderController;
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

    // Email verification
    Route::post('email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
        ->middleware('signed')
        ->name('verification.verify');
    Route::post('email/resend', [AuthController::class, 'resendVerificationEmail'])
        ->middleware('throttle:6,1')
        ->name('verification.send');

    // Tiendas y almacenes
    Route::apiResource('stores', StoreController::class)->names('api.v1.stores');
    Route::apiResource('warehouses', WarehouseController::class)->names('api.v1.warehouses');

    // Clientes
    Route::apiResource('customers', CustomerController::class)->names('api.v1.customers');

    // Configuración POS
    Route::apiResource('cash-registers', CashRegisterController::class)
        ->only(['index', 'store', 'show', 'update'])->names('api.v1.cash-registers');
    Route::get('cash-register-sessions', [CashRegisterSessionController::class, 'index'])
        ->name('api.v1.cash-register-sessions.index');
    Route::post('cash-registers/{cash_register}/sessions', [CashRegisterSessionController::class, 'store'])
        ->name('api.v1.cash-register-sessions.store');
    Route::get('cash-register-sessions/{cash_register_session}', [CashRegisterSessionController::class, 'show'])
        ->name('api.v1.cash-register-sessions.show');
    Route::get('cash-register-sessions/{cash_register_session}/catalog', PosCatalogController::class)
        ->name('api.v1.cash-register-sessions.catalog');
    Route::get('pos/payment-methods', [PosPaymentMethodController::class, 'index'])
        ->name('api.v1.pos.payment-methods.index');
    Route::get('cash-register-sessions/{cash_register_session}/orders', [PosOrderController::class, 'index'])
        ->name('api.v1.cash-register-sessions.orders.index');
    Route::post('cash-register-sessions/{cash_register_session}/orders', [PosOrderController::class, 'store'])
        ->name('api.v1.cash-register-sessions.orders.store');
    Route::get('cash-register-sessions/{cash_register_session}/orders/{pos_order}', [PosOrderController::class, 'show'])
        ->name('api.v1.cash-register-sessions.orders.show');
    Route::patch('cash-register-sessions/{cash_register_session}/orders/{pos_order}/cancel', [PosOrderController::class, 'cancel'])
        ->name('api.v1.cash-register-sessions.orders.cancel');
    Route::post('cash-register-sessions/{cash_register_session}/orders/{pos_order}/checkout', PosCheckoutController::class)
        ->name('api.v1.cash-register-sessions.orders.checkout');
    Route::post('cash-register-sessions/{cash_register_session}/orders/{pos_order}/items', [PosOrderItemController::class, 'store'])
        ->name('api.v1.cash-register-sessions.orders.items.store');
    Route::patch('cash-register-sessions/{cash_register_session}/orders/{pos_order}/items/{item}', [PosOrderItemController::class, 'update'])
        ->name('api.v1.cash-register-sessions.orders.items.update');
    Route::delete('cash-register-sessions/{cash_register_session}/orders/{pos_order}/items/{item}', [PosOrderItemController::class, 'destroy'])
        ->name('api.v1.cash-register-sessions.orders.items.destroy');
    Route::post('cash-register-sessions/{cash_register_session}/movements', [CashRegisterMovementController::class, 'store'])
        ->name('api.v1.cash-register-movements.store');
    Route::post('cash-register-sessions/{cash_register_session}/close', [CashRegisterSessionController::class, 'close'])
        ->name('api.v1.cash-register-sessions.close');
    Route::apiResource('document-series', DocumentSeriesController::class)
        ->only(['index', 'store', 'show', 'update'])->names('api.v1.document-series');

    // Usuarios, roles y permisos
    Route::apiResource('users', UserController::class)->names('api.v1.users');
    Route::put('users/{user}/roles', [UserRoleController::class, 'update'])
        ->name('api.v1.users.roles.update');
    Route::apiResource('roles', RoleController::class)->names('api.v1.roles');
    Route::apiResource('permissions', PermissionController::class)
        ->only(['index'])->names('api.v1.permissions');

    // Catálogo
    Route::apiResource('units-of-measure', UnitOfMeasureController::class)
        ->parameters(['units-of-measure' => 'unit_of_measure'])
        ->names('api.v1.units-of-measure');
    Route::apiResource('products', ProductController::class)->names('api.v1.products');
    Route::post('products/{product}/image', [ProductController::class, 'uploadImage'])
        ->name('api.v1.products.image');
    Route::apiResource('products.purchase-units', ProductPurchaseUnitController::class)
        ->shallow()->names('api.v1.products.purchase-units');
    Route::apiResource('products.price-tiers', PriceTierController::class)
        ->shallow()->names('api.v1.products.price-tiers');

    // Stock (Kardex)
    Route::get('stocks', [StockController::class, 'index'])->name('api.v1.stocks.index');
    Route::post('stocks/adjust', [StockController::class, 'adjust'])->name('api.v1.stocks.adjust');
    Route::get('inventory-movements', [InventoryMovementController::class, 'index'])
        ->name('api.v1.inventory-movements.index');

    // Proveedores y compras
    Route::apiResource('suppliers', SupplierController::class)->names('api.v1.suppliers');
    Route::apiResource('purchase-orders', PurchaseOrderController::class)
        ->only(['index', 'store', 'show', 'update'])->names('api.v1.purchase-orders');
    Route::post('purchase-orders/{purchase_order}/confirm', [PurchaseOrderController::class, 'confirm'])
        ->name('api.v1.purchase-orders.confirm');

    // Transferencias
    Route::apiResource('inventory-transfers', InventoryTransferController::class)
        ->only(['index', 'store', 'show'])->names('api.v1.inventory-transfers');
    Route::post('inventory-transfers/{inventory_transfer}/dispatch', [InventoryTransferController::class, 'dispatch'])
        ->name('api.v1.inventory-transfers.dispatch');
    Route::post('inventory-transfers/{inventory_transfer}/receive', [InventoryTransferController::class, 'receive'])
        ->name('api.v1.inventory-transfers.receive');

    // Ventas / POS
    Route::get('sales/summary', [SaleController::class, 'summary'])
        ->name('api.v1.sales.summary');
    Route::apiResource('sales', SaleController::class)
        ->only(['index', 'store', 'show'])->names('api.v1.sales');
    Route::get('sales/{sale}/fiscal-documents', [FiscalDocumentController::class, 'index'])
        ->name('api.v1.sales.fiscal-documents.index');
    Route::post('sales/{sale}/fiscal-documents', [FiscalDocumentController::class, 'store'])
        ->name('api.v1.sales.fiscal-documents.store');
});

// Password reset routes (public with rate limiting)
Route::middleware('throttle:6,1')->group(function (): void {
    Route::post('forgot-password', [AuthController::class, 'forgotPassword'])
        ->name('password.email');
    Route::post('reset-password', [AuthController::class, 'resetPassword'])
        ->name('password.reset');
});
