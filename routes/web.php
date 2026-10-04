<?php

declare(strict_types=1);

use App\Http\Controllers\Web\AttendanceQrController;
use App\Http\Controllers\Web\AuthenticatedSessionController;
use App\Http\Controllers\Web\FiscalSettingsController;
use App\Http\Controllers\Web\HistoricalSaleImportController;
use App\Http\Controllers\Web\ProfileController;
use App\Http\Controllers\Web\PublicFiscalDocumentController;
use App\Models\ProductTemplate;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/comprobantes/{token}', PublicFiscalDocumentController::class)
    ->middleware('throttle:60,1')
    ->name('fiscal-documents.public');

Route::middleware('guest')->group(function (): void {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store']);
});

Route::middleware('auth')->group(function (): void {
    Route::get('/', fn () => Inertia::render('home'))->name('home');
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::put('/profile/password', [ProfileController::class, 'updatePassword'])->name('profile.password.update');
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');

    Route::middleware('can:attendance-qr.manage')->prefix('attendance-qr')->name('attendance-qr.')->group(function (): void {
        Route::get('/', [AttendanceQrController::class, 'index'])->name('index');
        Route::post('/{store}/rotate', [AttendanceQrController::class, 'rotate'])->name('rotate');
        Route::put('/{store}/location', [AttendanceQrController::class, 'updateLocation'])->name('location.update');
        Route::post('/{store}/locations', [AttendanceQrController::class, 'storeAttendanceLocation'])->name('locations.store');
        Route::put('/{store}/locations/{attendanceLocation}', [AttendanceQrController::class, 'updateAttendanceLocation'])->name('locations.update');
        Route::delete('/{store}/locations/{attendanceLocation}', [AttendanceQrController::class, 'destroyAttendanceLocation'])->name('locations.destroy');
    });

    // Catálogo e inventario: las páginas solo se renderizan; los datos se
    // leen y guardan desde el navegador contra /api/v1 con la sesión web.
    Route::middleware('can:products.view')->prefix('catalog')->name('catalog.')->group(function (): void {
        Route::get('/products', fn () => Inertia::render('catalog/products/index'))->name('products.index');
        Route::get('/products/create', fn () => Inertia::render('catalog/products/edit', ['templateId' => null]))
            ->middleware('can:products.manage')
            ->name('products.create');
        Route::get('/products/{productTemplate}', fn (ProductTemplate $productTemplate) => Inertia::render('catalog/products/edit', [
            'templateId' => $productTemplate->id,
        ]))->name('products.edit');
        Route::get('/units', fn () => Inertia::render('catalog/units/index'))->name('units.index');
    });

    Route::prefix('inventory')->name('inventory.')->group(function (): void {
        Route::get('/stock', fn () => Inertia::render('inventory/stock/index'))
            ->middleware('can:stock.view')
            ->name('stock.index');
        Route::get('/movements', fn () => Inertia::render('inventory/movements/index'))
            ->middleware('can:stock.view')
            ->name('movements.index');
        Route::get('/locations', fn () => Inertia::render('inventory/locations/index'))
            ->middleware('can:stores.view')
            ->name('locations.index');
    });

    Route::middleware('can:sales.manage')->prefix('historical-sales')->name('historical-sales.')->group(function (): void {
        Route::get('/', [HistoricalSaleImportController::class, 'index'])->name('index');
        Route::get('/create', [HistoricalSaleImportController::class, 'create'])->name('create');
        Route::get('/template', [HistoricalSaleImportController::class, 'template'])->name('template');
        Route::post('/', [HistoricalSaleImportController::class, 'store'])->name('store');
        Route::get('/{historicalSaleImport}', [HistoricalSaleImportController::class, 'show'])->name('show');
        Route::get('/{historicalSaleImport}/file', [HistoricalSaleImportController::class, 'download'])->name('download');
        Route::post('/{historicalSaleImport}/confirm', [HistoricalSaleImportController::class, 'confirm'])->name('confirm');
        Route::post('/{historicalSaleImport}/rows/{row}/regenerate', [HistoricalSaleImportController::class, 'regenerate'])->name('rows.regenerate');
    });

    Route::prefix('fiscal-settings')->name('fiscal-settings.')->group(function (): void {
        Route::get('/', [FiscalSettingsController::class, 'index'])
            ->middleware('can:fiscal-settings.view')
            ->name('index');
        Route::post('/', [FiscalSettingsController::class, 'store'])
            ->middleware('can:fiscal-settings.manage')
            ->name('store');
        Route::put('/{fiscal_issuer}', [FiscalSettingsController::class, 'update'])
            ->middleware('can:fiscal-settings.manage')
            ->name('update');
        Route::put('/{fiscal_issuer}/credentials', [FiscalSettingsController::class, 'updateCredentials'])
            ->middleware('can:fiscal-credentials.manage')
            ->name('credentials.update');
        Route::post('/{fiscal_issuer}/certificate', [FiscalSettingsController::class, 'storeCertificate'])
            ->middleware('can:fiscal-credentials.manage')
            ->name('certificate.store');
        Route::delete('/{fiscal_issuer}/certificate', [FiscalSettingsController::class, 'destroyCertificate'])
            ->middleware('can:fiscal-credentials.manage')
            ->name('certificate.destroy');
    });
});
