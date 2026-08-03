<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\DeletePushSubscriptionRequest;
use App\Http\Requests\Api\V1\StorePushSubscriptionRequest;
use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Http\JsonResponse;

final class PushSubscriptionController extends ApiController
{
    public function store(StorePushSubscriptionRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $accessToken = $user->currentAccessToken();
        $deviceId = is_object($accessToken) ? $accessToken->getAttribute('device_id') : null;

        $subscription = PushSubscription::query()->updateOrCreate(
            ['expo_push_token' => $request->string('expo_push_token')->toString()],
            [
                'user_id' => $user->id,
                'device_id' => is_string($deviceId) ? $deviceId : null,
                'platform' => $request->string('platform')->toString(),
                'is_active' => true,
                'last_seen_at' => now(),
            ],
        );

        return $this->success([
            'id' => $subscription->id,
            'registered' => true,
        ]);
    }

    public function destroy(DeletePushSubscriptionRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->pushSubscriptions()
            ->where('expo_push_token', $request->string('expo_push_token')->toString())
            ->update(['is_active' => false]);

        return $this->noContent();
    }
}
