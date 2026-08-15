<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Actions\Sales\CompleteWholesaleSaleAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Web\StoreHistoricalSaleImportRequest;
use App\Models\DocumentSeries;
use App\Models\HistoricalSaleImport;
use App\Models\HistoricalSaleImportRow;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\HistoricalSales\HistoricalSaleProposalGenerator;
use App\Services\HistoricalSales\HistoricalSaleSpreadsheetReader;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

final class HistoricalSaleImportController extends Controller
{
    public function __construct(
        private readonly HistoricalSaleSpreadsheetReader $spreadsheetReader,
        private readonly HistoricalSaleProposalGenerator $proposalGenerator,
        private readonly CompleteWholesaleSaleAction $completeWholesaleSaleAction,
    ) {}

    public function index(): Response
    {
        $imports = HistoricalSaleImport::query()
            ->with(['warehouse.store', 'documentSeries', 'creator'])
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn (HistoricalSaleImport $import): array => $this->summary($import));

        return Inertia::render('historical-sales/index', [
            'imports' => $imports,
        ]);
    }

    public function create(): Response
    {
        $warehouses = Warehouse::query()
            ->where('is_active', true)
            ->whereHas('store', fn ($query) => $query->where('is_active', true))
            ->with('store:id,name,fiscal_issuer_id')
            ->orderBy('name')
            ->get()
            ->map(fn (Warehouse $warehouse): array => [
                'id' => $warehouse->id,
                'name' => $warehouse->name,
                'code' => $warehouse->code,
                'store_name' => $warehouse->store?->name,
                'fiscal_issuer_id' => $warehouse->store?->fiscal_issuer_id,
            ]);

        $series = DocumentSeries::query()
            ->where('is_active', true)
            ->whereIn('document_type', ['sales_ticket', 'receipt'])
            ->with('cashRegisters:id')
            ->orderBy('document_type')
            ->orderBy('series_code')
            ->get()
            ->map(fn (DocumentSeries $documentSeries): array => [
                'id' => $documentSeries->id,
                'fiscal_issuer_id' => $documentSeries->fiscal_issuer_id,
                'document_type' => $documentSeries->document_type,
                'series_code' => $documentSeries->series_code,
                'current_number' => $documentSeries->current_number,
                'next_number' => $documentSeries->current_number + 1,
                'purpose' => $documentSeries->purpose,
                'assigned_to_pos' => $documentSeries->cashRegisters->isNotEmpty(),
            ]);

        return Inertia::render('historical-sales/create', [
            'warehouses' => $warehouses,
            'series' => $series,
        ]);
    }

    public function store(StoreHistoricalSaleImportRequest $request): RedirectResponse
    {
        $warehouse = Warehouse::query()->with('store')->findOrFail($request->integer('warehouse_id'));
        $issuerId = $warehouse->store?->fiscal_issuer_id;

        $series = DocumentSeries::query()
            ->whereKey($request->integer('document_series_id'))
            ->where('is_active', true)
            ->whereIn('document_type', ['sales_ticket', 'receipt'])
            ->first();

        if (! $series instanceof DocumentSeries) {
            throw ValidationException::withMessages([
                'document_series_id' => 'Selecciona una serie activa para nota de venta o boleta.',
            ]);
        }

        if ($series->fiscal_issuer_id !== $issuerId) {
            throw ValidationException::withMessages([
                'document_series_id' => 'La serie no pertenece al emisor fiscal del almacén seleccionado.',
            ]);
        }

        $file = $request->file('file');
        $realPath = $file?->getRealPath();

        if ($file === null || ! is_string($realPath)) {
            throw ValidationException::withMessages(['file' => 'No se pudo leer el archivo cargado.']);
        }

        $hash = hash_file('sha256', $realPath);

        if (HistoricalSaleImport::query()->where('warehouse_id', $warehouse->id)->where('file_hash', $hash)->exists()) {
            throw ValidationException::withMessages([
                'file' => 'Este archivo ya fue cargado para el almacén seleccionado.',
            ]);
        }

        $path = $file->store('historical-sale-imports');

        if (! is_string($path)) {
            throw ValidationException::withMessages(['file' => 'No se pudo almacenar el archivo.']);
        }

        /** @var User $user */
        $user = $request->user();
        $import = HistoricalSaleImport::query()->create([
            'warehouse_id' => $warehouse->id,
            'document_series_id' => $series->id,
            'created_by' => $user->id,
            'original_filename' => $file->getClientOriginalName(),
            'file_path' => $path,
            'file_hash' => $hash,
            'status' => 'draft',
        ]);

        try {
            $rows = $this->spreadsheetReader->read(Storage::path($path));

            foreach ($rows as $row) {
                $proposal = [];
                $error = $row['error'];

                if ($error === null && $row['sold_at'] !== null && $row['total'] !== null) {
                    /** @var numeric-string $rowTotal */
                    $rowTotal = $row['total'];
                    $proposal = $this->proposalGenerator->generate(
                        $warehouse,
                        $rowTotal,
                        $hash.'|'.$row['row_number'],
                    );
                    $error = $proposal === []
                        ? 'No se encontró una combinación de productos y cantidades que coincida con el total.'
                        : null;
                }

                $import->rows()->create([
                    'row_number' => $row['row_number'],
                    'sold_at' => $row['sold_at'],
                    'expected_total' => $row['total'],
                    'status' => $error === null ? 'ready' : 'invalid',
                    'proposed_items' => $proposal === [] ? null : $proposal,
                    'error_message' => $error,
                ]);
            }
        } catch (Throwable $exception) {
            Storage::delete($path);
            $import->delete();

            throw ValidationException::withMessages(['file' => $exception->getMessage()]);
        }

        $import->refreshStatistics();
        $import->update(['status' => $import->ready_rows > 0 ? 'ready' : 'invalid']);

        return redirect()->route('historical-sales.show', $import);
    }

    public function show(HistoricalSaleImport $historicalSaleImport): Response
    {
        $historicalSaleImport->load([
            'warehouse.store',
            'documentSeries',
            'creator',
            'rows' => fn (Builder $query): Builder => $query->with('sale.fiscalDocuments')->orderBy('sold_at')->orderBy('row_number'),
        ]);
        $series = $historicalSaleImport->documentSeries;
        assert($series instanceof DocumentSeries);
        $nextProvisionalNumber = $series->current_number + 1;

        return Inertia::render('historical-sales/show', [
            'import' => [
                ...$this->summary($historicalSaleImport),
                'rows' => $historicalSaleImport->rows->values()->map(function (HistoricalSaleImportRow $row) use ($series, &$nextProvisionalNumber): array {
                    $document = $row->sale?->fiscalDocuments->firstWhere('document_type', $series->document_type);
                    $documentNumber = null;

                    if ($document !== null) {
                        $documentNumber = $document->series_code.'-'.mb_str_pad((string) $document->number, 8, '0', STR_PAD_LEFT);
                    } elseif ($row->status === 'ready') {
                        $documentNumber = $series->series_code.'-'.mb_str_pad((string) $nextProvisionalNumber, 8, '0', STR_PAD_LEFT);
                        $nextProvisionalNumber++;
                    }

                    return [
                        'id' => $row->id,
                        'row_number' => $row->row_number,
                        'sold_at' => $row->sold_at?->toIso8601String(),
                        'expected_total' => $row->expected_total,
                        'status' => $row->status,
                        'proposed_items' => $row->proposed_items ?? [],
                        'error_message' => $row->error_message,
                        'sale_id' => $row->sale_id,
                        'document_number' => $documentNumber,
                    ];
                }),
            ],
        ]);
    }

    public function regenerate(HistoricalSaleImport $historicalSaleImport, HistoricalSaleImportRow $row): RedirectResponse
    {
        abort_unless($row->historical_sale_import_id === $historicalSaleImport->id, 404);
        abort_if($row->status === 'imported' || $row->expected_total === null, 409);

        $warehouse = $historicalSaleImport->warehouse;
        assert($warehouse instanceof Warehouse);
        /** @var numeric-string $expectedTotal */
        $expectedTotal = $row->expected_total;
        $proposal = $this->proposalGenerator->generate(
            $warehouse,
            $expectedTotal,
            $historicalSaleImport->file_hash.'|'.$row->row_number.'|'.(string) microtime(true),
        );

        $row->update([
            'status' => $proposal === [] ? 'invalid' : 'ready',
            'proposed_items' => $proposal === [] ? null : $proposal,
            'error_message' => $proposal === [] ? 'No se encontró otra combinación válida.' : null,
        ]);
        $historicalSaleImport->refreshStatistics();

        return back();
    }

    public function confirm(Request $request, HistoricalSaleImport $historicalSaleImport): RedirectResponse
    {
        $series = $historicalSaleImport->documentSeries;
        assert($series instanceof DocumentSeries);
        abort_unless($series->is_active && in_array($series->document_type, ['sales_ticket', 'receipt'], true), 409);

        /** @var User $user */
        $user = $request->user();
        $rows = $historicalSaleImport->rows()
            ->where('status', 'ready')
            ->orderBy('sold_at')
            ->orderBy('row_number')
            ->get();

        foreach ($rows as $row) {
            try {
                $items = [];

                foreach ($row->proposed_items ?? [] as $item) {
                    $productId = $item['product_id'] ?? null;
                    $quantityValue = $item['quantity'] ?? null;
                    $unitId = $item['unit_id'] ?? null;

                    if (! is_numeric($productId) || ! is_scalar($quantityValue) || ! is_numeric($unitId)) {
                        throw new RuntimeException('La propuesta contiene un producto o cantidad inválidos.');
                    }

                    $quantity = (string) $quantityValue;

                    if (preg_match('/^\d+(?:\.\d+)?$/D', $quantity) !== 1) {
                        throw new RuntimeException('La propuesta contiene una cantidad inválida.');
                    }

                    $items[] = [
                        'product_id' => (int) $productId,
                        'quantity' => $quantity,
                        'unit_id' => (int) $unitId,
                    ];
                }

                if ($row->sold_at === null || $row->expected_total === null || $items === []) {
                    throw new RuntimeException('La fila no tiene todos los datos necesarios para confirmar la venta.');
                }

                /** @var numeric-string $expectedTotal */
                $expectedTotal = $row->expected_total;
                /** @var list<array{product_id: int, quantity: numeric-string, unit_id: int}> $items */
                /** @var array{warehouse_id: int, document_series_id: int, sold_at: string, expected_total: numeric-string, notes: string, items: list<array{product_id: int, quantity: numeric-string, unit_id: int}>} $payload */
                $payload = [
                    'warehouse_id' => $historicalSaleImport->warehouse_id,
                    'document_series_id' => $series->id,
                    'sold_at' => $row->sold_at->toDateTimeString(),
                    'expected_total' => $expectedTotal,
                    'notes' => "Importación histórica #{$historicalSaleImport->id}, fila {$row->row_number}",
                    'items' => $items,
                ];

                $sale = $this->completeWholesaleSaleAction->execute(
                    $payload,
                    $user->id,
                    'historical_import',
                    $series->document_type,
                );

                $row->update([
                    'status' => 'imported',
                    'sale_id' => $sale->id,
                    'error_message' => null,
                ]);
            } catch (Throwable $exception) {
                $row->update([
                    'status' => 'failed',
                    'error_message' => $exception->getMessage(),
                ]);
            }
        }

        $historicalSaleImport->refreshStatistics();
        $historicalSaleImport->update([
            'status' => $historicalSaleImport->failed_rows > 0 ? 'partial' : 'completed',
            'confirmed_at' => now(),
        ]);

        return back();
    }

    public function download(HistoricalSaleImport $historicalSaleImport): StreamedResponse
    {
        return Storage::download($historicalSaleImport->file_path, $historicalSaleImport->original_filename);
    }

    public function template(): StreamedResponse
    {
        return response()->streamDownload(function (): void {
            $spreadsheet = new Spreadsheet;
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->fromArray([
                ['fecha', 'hora', 'total'],
                ['10/08/2026', '11:25', '25.00'],
                ['11/08/2026', '09:10', '48.50'],
            ]);
            (new Xlsx($spreadsheet))->save('php://output');
            $spreadsheet->disconnectWorksheets();
        }, 'plantilla-ventas-historicas.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /** @return array<string, mixed> */
    private function summary(HistoricalSaleImport $import): array
    {
        $warehouse = $import->warehouse;
        $series = $import->documentSeries;
        assert($warehouse instanceof Warehouse);
        assert($series instanceof DocumentSeries);

        return [
            'id' => $import->id,
            'original_filename' => $import->original_filename,
            'status' => $import->status,
            'warehouse' => $warehouse->name,
            'store' => $warehouse->store?->name,
            'series_code' => $series->series_code,
            'document_type' => $series->document_type,
            'series_purpose' => $series->purpose,
            'series_assigned_to_pos' => $series->cashRegisters()->exists(),
            'current_number' => $series->current_number,
            'next_number' => $series->current_number + 1,
            'total_rows' => $import->total_rows,
            'ready_rows' => $import->ready_rows,
            'imported_rows' => $import->imported_rows,
            'failed_rows' => $import->failed_rows,
            'expected_total' => $import->expected_total,
            'imported_total' => $import->imported_total,
            'created_by' => $import->creator?->name,
            'created_at' => $import->created_at?->toIso8601String(),
            'confirmed_at' => $import->confirmed_at?->toIso8601String(),
        ];
    }
}
