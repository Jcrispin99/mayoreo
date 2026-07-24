<?php

declare(strict_types=1);

use App\Services\MoneyService;

it('rounds non-negative decimal strings half up to two decimal places', function (
    string $amount,
    string $expected,
): void {
    expect((new MoneyService)->roundHalfUp($amount))->toBe($expected);
})->with([
    'below half a cent' => ['0.0049', '0.00'],
    'half a cent' => ['0.0050', '0.01'],
    'required lower example' => ['0.0140', '0.01'],
    'required upper example' => ['0.0150', '0.02'],
    'below a regular half boundary' => ['12.3449', '12.34'],
    'at a regular half boundary' => ['12.3450', '12.35'],
    'carry into the integer portion' => ['999.9950', '1000.00'],
    'already at money precision' => ['20.00', '20.00'],
]);

it('rejects negative or non-decimal input', function (string $amount): void {
    expect(fn (): string => (new MoneyService)->roundHalfUp($amount))
        ->toThrow(InvalidArgumentException::class);
})->with([
    'negative' => ['-0.01'],
    'letters' => ['not-money'],
    'empty' => [''],
    'comma decimal separator' => ['12,50'],
    'scientific notation' => ['1e2'],
]);
