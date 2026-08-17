<?php

declare(strict_types=1);

namespace App\Services\HistoricalSales;

use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use InvalidArgumentException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use Throwable;

final class HistoricalSaleSpreadsheetReader
{
    private const int MAX_ROWS = 1000;

    private const int HEADER_SEARCH_LIMIT = 20;

    private const string RECEIPT_TOTAL_LIMIT = '700.00';

    /**
     * @return list<array{
     *     row_number: int,
     *     transaction_type: string,
     *     origin: string|null,
     *     destination: string|null,
     *     message: string|null,
     *     sold_at: Carbon|null,
     *     total: string|null,
     *     error: string|null
     * }>
     */
    public function read(string $path): array
    {
        $worksheet = IOFactory::load($path)->getActiveSheet();
        /** @var array<int, array<string, mixed>> $rows */
        $rows = $worksheet->toArray(null, true, true, true);

        if ($rows === []) {
            throw new InvalidArgumentException('El archivo no contiene filas.');
        }

        [$headerRowNumber, $columns] = $this->header($rows);

        $result = [];

        foreach ($rows as $rowNumber => $row) {
            if ($rowNumber <= $headerRowNumber) {
                continue;
            }

            $transactionValue = $row[$columns['transaction_type']] ?? null;
            $dateValue = $row[$columns['date']] ?? null;
            $totalValue = $row[$columns['total']] ?? null;

            if ($this->isEmpty($transactionValue) && $this->isEmpty($dateValue) && $this->isEmpty($totalValue)) {
                continue;
            }

            $transactionType = $this->transactionType($transactionValue);

            if ($transactionType !== 'TE PAGÓ') {
                continue;
            }

            if (count($result) >= self::MAX_ROWS) {
                throw new InvalidArgumentException('El archivo supera el máximo de 1000 operaciones TE PAGÓ por lote.');
            }

            $timeValue = isset($columns['time']) ? ($row[$columns['time']] ?? null) : null;

            try {
                $soldAt = $this->dateTime($dateValue, $timeValue);
                $total = $this->money($totalValue);
                $error = bccomp($total, self::RECEIPT_TOTAL_LIMIT, 2) >= 0
                    ? 'No se generan boletas para operaciones de S/ 700.00 o más.'
                    : null;
            } catch (Throwable $exception) {
                $soldAt = null;
                $total = null;
                $error = $exception->getMessage();
            }

            $result[] = [
                'row_number' => (int) $rowNumber,
                'transaction_type' => $transactionType,
                'origin' => $this->nullableString($row[$columns['origin']] ?? null),
                'destination' => $this->nullableString($row[$columns['destination']] ?? null),
                'message' => $this->nullableString($row[$columns['message']] ?? null),
                'sold_at' => $soldAt,
                'total' => $total,
                'error' => $error,
            ];
        }

        if ($result === []) {
            throw new InvalidArgumentException('El archivo no contiene operaciones con Tipo de Transacción TE PAGÓ.');
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $header
     * @return array{transaction_type?: string, origin?: string, destination?: string, total?: string, message?: string, date?: string, time?: string}
     */
    private function columns(array $header): array
    {
        $columns = [];

        foreach ($header as $column => $value) {
            $name = Str::of($this->stringValue($value))->ascii()->lower()->trim()->replaceMatches('/[^a-z0-9]+/', '_')->trim('_')->toString();

            if (in_array($name, ['tipo_de_transaccion', 'tipo_transaccion'], true)) {
                $columns['transaction_type'] = $column;
            } elseif ($name === 'origen') {
                $columns['origin'] = $column;
            } elseif ($name === 'destino') {
                $columns['destination'] = $column;
            } elseif (in_array($name, ['fecha_de_operacion', 'fecha_operacion', 'fecha', 'fecha_hora', 'fecha_y_hora', 'date'], true)) {
                $columns['date'] = $column;
            } elseif (in_array($name, ['hora', 'time'], true)) {
                $columns['time'] = $column;
            } elseif (in_array($name, ['total', 'monto', 'importe', 'precio'], true)) {
                $columns['total'] = $column;
            } elseif ($name === 'mensaje') {
                $columns['message'] = $column;
            }
        }

        return $columns;
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @return array{int, array{transaction_type: string, origin: string, destination: string, total: string, message: string, date: string, time?: string}}
     */
    private function header(array $rows): array
    {
        foreach (array_slice($rows, 0, self::HEADER_SEARCH_LIMIT, true) as $rowNumber => $row) {
            $columns = $this->columns($row);

            if (
                isset(
                    $columns['transaction_type'],
                    $columns['origin'],
                    $columns['destination'],
                    $columns['total'],
                    $columns['message'],
                    $columns['date'],
                )
            ) {
                /** @var array{transaction_type: string, origin: string, destination: string, total: string, message: string, date: string, time?: string} $columns */
                return [(int) $rowNumber, $columns];
            }
        }

        throw new InvalidArgumentException(
            'No se encontraron las columnas de Yape: Tipo de Transacción, Origen, Destino, Monto, Mensaje y Fecha de operación.',
        );
    }

    private function dateTime(mixed $date, mixed $time): Carbon
    {
        if (is_numeric($date)) {
            $result = Carbon::instance(ExcelDate::excelToDateTimeObject((float) $date))
                ->shiftTimezone('America/Lima');
        } else {
            $value = mb_trim($this->stringValue($date));
            $result = $this->parseDateString($value);
        }

        if (! $this->isEmpty($time)) {
            [$hours, $minutes, $seconds] = $this->timeParts($time);
            $result->setTime($hours, $minutes, $seconds);
        } elseif (! str_contains($this->stringValue($date), ':')) {
            $result->setTime(12, 0);
        }

        return $result->utc();
    }

    private function parseDateString(string $value): Carbon
    {
        foreach (['d/m/Y H:i:s', 'd/m/Y H:i', 'd/m/y H:i', 'd-m-Y H:i', 'Y-m-d H:i:s', 'Y-m-d H:i', 'd/m/Y', 'd/m/y', 'd-m-Y', 'Y-m-d'] as $format) {
            try {
                $date = Carbon::createFromFormat($format, $value, 'America/Lima');

                if ($date !== null && $date->format($format) === $value) {
                    return $date;
                }
            } catch (Throwable) {
                continue;
            }
        }

        throw new InvalidArgumentException("Fecha inválida: {$value}.");
    }

    /** @return array{int, int, int} */
    private function timeParts(mixed $value): array
    {
        if (is_numeric($value)) {
            $seconds = (int) round(((float) $value - floor((float) $value)) * 86400);

            return [intdiv($seconds, 3600) % 24, intdiv($seconds % 3600, 60), $seconds % 60];
        }

        $time = mb_trim($this->stringValue($value));

        foreach (['H:i:s', 'H:i'] as $format) {
            try {
                $date = Carbon::createFromFormat($format, $time);

                if ($date !== null && $date->format($format) === $time) {
                    return [$date->hour, $date->minute, $date->second];
                }
            } catch (Throwable) {
                continue;
            }
        }

        throw new InvalidArgumentException("Hora inválida: {$time}.");
    }

    /** @return numeric-string */
    private function money(mixed $value): string
    {
        $displayValue = is_numeric($value)
            ? number_format((float) $value, 2, '.', '')
            : $this->stringValue($value);
        $money = mb_trim($displayValue);
        $money = preg_replace('/[^0-9,.-]/', '', $money) ?? '';

        if (str_contains($money, ',') && ! str_contains($money, '.')) {
            $money = str_replace(',', '.', $money);
        } else {
            $money = str_replace(',', '', $money);
        }

        if (preg_match('/^\d+(?:\.\d{1,2})?$/D', $money) !== 1 || (float) $money <= 0) {
            throw new InvalidArgumentException("Total inválido: {$displayValue}.");
        }

        return number_format((float) $money, 2, '.', '');
    }

    private function isEmpty(mixed $value): bool
    {
        return $value === null || mb_trim($this->stringValue($value)) === '';
    }

    private function stringValue(mixed $value): string
    {
        return is_scalar($value) ? (string) $value : '';
    }

    private function nullableString(mixed $value): ?string
    {
        $normalized = mb_trim($this->stringValue($value));

        return $normalized === '' ? null : $normalized;
    }

    private function transactionType(mixed $value): string
    {
        $normalized = Str::of($this->stringValue($value))
            ->squish()
            ->ascii()
            ->upper()
            ->toString();

        return $normalized === 'TE PAGO' ? 'TE PAGÓ' : $normalized;
    }
}
