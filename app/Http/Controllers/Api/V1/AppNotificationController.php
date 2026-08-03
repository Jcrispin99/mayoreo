<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Resources\AppNotificationResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

final class AppNotificationController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $notifications = $user->notifications()->latest()->limit(100)->get();

        return $this->success([
            'items' => AppNotificationResource::collection($notifications),
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    public function read(Request $request, string $notification): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $ownedNotification = $user->notifications()->find($notification);

        if (! $ownedNotification instanceof DatabaseNotification) {
            return $this->notFound('La notificación no existe.');
        }

        $ownedNotification->markAsRead();

        return $this->success(new AppNotificationResource($ownedNotification->refresh()));
    }

    public function readAll(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->unreadNotifications()->update(['read_at' => now()]);

        return $this->success(message: 'Notificaciones marcadas como leídas.');
    }
}
