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

    /**
     * @return list<array{row_number: int, sold_at: Carbon|null, total: string|null, error: string|null}>
     */
    public function read(string $path): array
    {
        $worksheet = IOFactory::load($path)->getActiveSheet();
        /** @var array<int, array<string, mixed>> $rows */
        $rows = $worksheet->toArray(null, true, true, true);

        if ($rows === []) {
            throw new InvalidArgumentException('El archivo no contiene filas.');
        }

        $headerRowNumber = (int) array_key_first($rows);
        $columns = $this->columns($rows[$headerRowNumber]);

        if (! isset($columns['date']) || ! isset($columns['total'])) {
            throw new InvalidArgumentException('La primera fila debe contener las columnas fecha y total.');
        }

        $result = [];

        foreach (array_slice($rows, 1, null, true) as $rowNumber => $row) {
            if (count($result) >= self::MAX_ROWS) {
                throw new InvalidArgumentException('El archivo supera el máximo de 1000 ventas por lote.');
            }

            $dateValue = $row[$columns['date']] ?? null;
            $timeValue = isset($columns['time']) ? ($row[$columns['time']] ?? null) : null;
            $totalValue = $row[$columns['total']] ?? null;

            if ($this->isEmpty($dateValue) && $this->isEmpty($totalValue)) {
                continue;
            }

            try {
                $soldAt = $this->dateTime($dateValue, $timeValue);
                $total = $this->money($totalValue);
                $error = null;
            } catch (Throwable $exception) {
                $soldAt = null;
                $total = null;
                $error = $exception->getMessage();
            }

            $result[] = [
                'row_number' => (int) $rowNumber,
                'sold_at' => $soldAt,
                'total' => $total,
                'error' => $error,
            ];
        }

        if ($result === []) {
            throw new InvalidArgumentException('El archivo no contiene ventas debajo de la cabecera.');
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $header
     * @return array{date?: string, time?: string, total?: string}
     */
    private function columns(array $header): array
    {
        $columns = [];

        foreach ($header as $column => $value) {
            $name = Str::of($this->stringValue($value))->ascii()->lower()->trim()->replaceMatches('/[^a-z0-9]+/', '_')->trim('_')->toString();

            if (in_array($name, ['fecha', 'fecha_hora', 'fecha_y_hora', 'date'], true)) {
                $columns['date'] = $column;
            } elseif (in_array($name, ['hora', 'time'], true)) {
                $columns['time'] = $column;
            } elseif (in_array($name, ['total', 'monto', 'importe', 'precio'], true)) {
                $columns['total'] = $column;
            }
        }

        return $columns;
    }

    private function dateTime(mixed $date, mixed $time): Carbon
    {
        if (is_numeric($date)) {
            $result = Carbon::instance(ExcelDate::excelToDateTimeObject((float) $date));
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

        return $result;
    }

    private function parseDateString(string $value): Carbon
    {
        foreach (['d/m/Y H:i:s', 'd/m/Y H:i', 'd/m/y H:i', 'd-m-Y H:i', 'Y-m-d H:i:s', 'Y-m-d H:i', 'd/m/Y', 'd/m/y', 'd-m-Y', 'Y-m-d'] as $format) {
            try {
                $date = Carbon::createFromFormat($format, $value);

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

    private function money(mixed $value): string
    {
        $displayValue = $this->stringValue($value);
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
}
