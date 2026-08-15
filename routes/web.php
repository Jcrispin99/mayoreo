<?php

declare(strict_types=1);

use App\Http\Controllers\Web\AuthenticatedSessionController;
use App\Http\Controllers\Web\HistoricalSaleImportController;
use App\Http\Controllers\Web\ProfileController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

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
});
