<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\DeviceAlreadyLinkedException;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class DeviceSessionService
{
    public const string MULTIPLE_DEVICES_PERMISSION = 'auth.multiple-devices';

    public function issueToken(
        User $user,
        string $deviceId,
        string $deviceName,
        bool $replaceExistingDevice = false,
    ): string
    {
        return DB::transaction(function () use ($user, $deviceId, $deviceName, $replaceExistingDevice): string {
            /** @var User $lockedUser */
            $lockedUser = User::query()->lockForUpdate()->findOrFail($user->getKey());
            $allowsMultipleDevices = $lockedUser->can(self::MULTIPLE_DEVICES_PERMISSION);

            $hasAnotherDevice = $lockedUser->tokens()
                ->whereNotNull('device_id')
                ->where('device_id', '!=', $deviceId)
                ->exists();

            if (! $allowsMultipleDevices && $hasAnotherDevice && ! $replaceExistingDevice) {
                throw new DeviceAlreadyLinkedException;
            }

            if ($allowsMultipleDevices) {
                $lockedUser->tokens()->where('device_id', $deviceId)->delete();
            } else {
                // Reissuing on the authorized device also retires legacy, unidentified tokens.
                $lockedUser->tokens()->delete();
            }

            $newToken = $lockedUser->createToken($deviceName);
            $newToken->accessToken->forceFill(['device_id' => $deviceId])->save();

            return $newToken->plainTextToken;
        });
    }
}
