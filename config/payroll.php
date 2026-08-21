<?php

declare(strict_types=1);

return [
    'timezone' => env('APP_TIMEZONE', 'America/Lima'),
    'default_monthly_divisor' => (int) env('PAYROLL_MONTHLY_DIVISOR', 30),
    'scan_cooldown_seconds' => (int) env('ATTENDANCE_SCAN_COOLDOWN_SECONDS', 60),
    'maximum_shift_minutes' => (int) env('ATTENDANCE_MAXIMUM_SHIFT_MINUTES', 1080),
    'attendance_day_starts_at' => env('ATTENDANCE_DAY_STARTS_AT', '00:00'),
    'qr_prefix' => 'mayoreo-attendance:',
];
