<?php

declare(strict_types=1);

use App\Exceptions\DeviceAlreadyLinkedException;
use App\Exceptions\DomainException;
use App\Exceptions\PosCheckoutTotalChangedException;
use App\Exceptions\StalePosSupplyRequestException;
use App\Exceptions\WholesaleSaleTotalChangedException;
use App\Http\Middleware\EnsureEmailVerified;
use App\Http\Middleware\ForceJsonResponse;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LogApiRequests;
use App\Http\Resources\PosOrderResource;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            HandleInertiaRequests::class,
        ]);

        $middleware->alias([
            'force.json' => ForceJsonResponse::class,
            'log.api' => LogApiRequests::class,
            'verified' => EnsureEmailVerified::class,
        ]);

        $middleware->trimStrings(except: [
            'sol_password',
            'certificate_password',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->dontFlash([
            'sol_username',
            'sol_password',
            'certificate_password',
        ]);

        $exceptions->render(function (WholesaleSaleTotalChangedException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'data' => $e->data(),
            ], 409);
        });

        $exceptions->render(function (PosCheckoutTotalChangedException $e, Request $request) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'data' => [
                    'order' => (new PosOrderResource($e->order()))->resolve($request),
                    'payable_total' => $e->payableTotal(),
                ],
            ], 409);
        });

        $exceptions->render(function (DeviceAlreadyLinkedException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 409);
        });

        $exceptions->render(function (StalePosSupplyRequestException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 409);
        });

        $exceptions->render(function (DomainException $e, Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                ], $e->statusCode());
            }
        });
    })->create();
