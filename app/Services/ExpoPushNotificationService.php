<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\PushSubscription;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

final class ExpoPushNotificationService
{
    /**
     * @param list<int> $userIds
     * @param array<string, mixed> $data
     */
    public function sendToUsers(array $userIds, string $title, string $body, array $data): void
    {
        if ($userIds === []) {
            return;
        }

        $subscriptions = PushSubscription::query()
            ->whereIn('user_id', $userIds)
            ->where('is_active', true)
            ->get(['id', 'expo_push_token']);

        foreach ($subscriptions->chunk(100) as $chunk) {
            $messages = $chunk->map(fn (PushSubscription $subscription): array => [
                'to' => $subscription->expo_push_token,
                'sound' => 'default',
                'channelId' => 'price-changes',
                'title' => $title,
                'body' => $body,
                'data' => $data,
            ])->values()->all();

            try {
                $response = $this->request()->post(
                    (string) config('services.expo.push_url'),
                    $messages,
                );

                if (! $response->successful()) {
                    Log::warning('Expo rejected a price-change push batch.', [
                        'status' => $response->status(),
                    ]);

                    continue;
                }

                $tickets = $response->json('data');
                if (! is_array($tickets)) {
                    continue;
                }

                foreach ($tickets as $index => $ticket) {
                    if (($ticket['details']['error'] ?? null) !== 'DeviceNotRegistered') {
                        continue;
                    }

                    $subscription = $chunk->values()->get($index);
                    $subscription?->update(['is_active' => false]);
                }
            } catch (Throwable $exception) {
                Log::warning('Could not deliver price-change push notifications.', [
                    'exception' => $exception->getMessage(),
                ]);
            }
        }
    }

    private function request(): PendingRequest
    {
        $request = Http::acceptJson()->asJson()->timeout(5);
        $accessToken = config('services.expo.access_token');

        return is_string($accessToken) && $accessToken !== ''
            ? $request->withToken($accessToken)
            : $request;
    }
}
