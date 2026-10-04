<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $document->series_code }}-{{ str_pad((string) $document->number, 8, '0', STR_PAD_LEFT) }}</title>
    <style>
        @page { margin: 5mm; size: 80mm auto; }
        * { box-sizing: border-box; }
        body { margin: 0; background: #f3f5f4; color: #172423; font-family: Arial, Helvetica, sans-serif; }
        .ticket { width: 80mm; max-width: 100%; min-height: 100vh; margin: 0 auto; padding: 6mm 5mm; background: #fff; }
        .center { text-align: center; }
        .issuer { font-size: 16px; font-weight: 800; }
        .muted { color: #5d6b69; font-size: 10px; line-height: 1.45; }
        .document { margin: 14px 0; padding: 10px; border: 2px solid #172423; text-align: center; }
        .document-type { font-size: 13px; font-weight: 800; text-transform: uppercase; }
        .document-number { margin-top: 4px; font-size: 18px; font-weight: 900; letter-spacing: .4px; }
        .row { display: flex; justify-content: space-between; gap: 12px; margin: 4px 0; font-size: 10px; }
        .row strong { text-align: right; }
        .divider { margin: 10px 0; border-top: 1px dashed #7d8987; }
        table { width: 100%; border-collapse: collapse; font-size: 9px; }
        th { padding: 5px 2px; border-bottom: 1px solid #172423; text-align: left; }
        td { padding: 6px 2px; border-bottom: 1px dotted #bcc4c2; vertical-align: top; }
        .number { text-align: right; white-space: nowrap; }
        .total { margin-top: 10px; font-size: 16px; font-weight: 900; }
        .status { margin: 12px 0; padding: 8px; border-radius: 6px; background: #eef3f1; font-size: 10px; text-align: center; }
        .actions { margin-top: 18px; text-align: center; }
        button { padding: 10px 18px; border: 0; border-radius: 8px; background: #b4232d; color: #fff; font-weight: 700; }
        @media print {
            body { background: #fff; }
            .ticket { min-height: 0; padding: 0; }
            .actions { display: none; }
        }
    </style>
</head>
<body>
<main class="ticket">
    <header class="center">
        <div class="issuer">{{ $document->issuer_trade_name ?: $document->issuer_legal_name ?: 'Mayoreo' }}</div>
        @if ($document->issuer_ruc)<div class="muted">RUC {{ $document->issuer_ruc }}</div>@endif
        @if ($document->issuer_legal_name && $document->issuer_trade_name)<div class="muted">{{ $document->issuer_legal_name }}</div>@endif
        @if ($document->establishment_address)<div class="muted">{{ $document->establishment_address }}</div>@endif
    </header>

    <section class="document">
        <div class="document-type">{{ match ($document->document_type) { 'receipt' => 'Boleta de venta electrónica', 'invoice' => 'Factura electrónica', default => 'Nota de venta' } }}</div>
        <div class="document-number">{{ $document->series_code }}-{{ str_pad((string) $document->number, 8, '0', STR_PAD_LEFT) }}</div>
    </section>

    <div class="row"><span>Fecha</span><strong>{{ $document->issued_at->timezone('America/Lima')->format('d/m/Y H:i') }}</strong></div>
    <div class="row"><span>Cliente</span><strong>{{ $sale->customer_name ?: 'Cliente de mostrador' }}</strong></div>
    @if ($sale->customer_document)<div class="row"><span>Documento</span><strong>{{ $sale->customer_document }}</strong></div>@endif

    <div class="divider"></div>
    <table>
        <thead><tr><th>Producto</th><th class="number">Cant.</th><th class="number">Importe</th></tr></thead>
        <tbody>
        @foreach ($sale->items as $item)
            <tr>
                <td>
                    {{ $item->product_name_snapshot ?: $item->product?->display_name ?: 'Producto' }}
                    @if ($item->product_sku_snapshot ?: $item->product?->sku)<div class="muted">{{ $item->product_sku_snapshot ?: $item->product?->sku }}</div>@endif
                </td>
                <td class="number">{{ rtrim(rtrim(number_format((float) ($item->input_quantity ?: $item->quantity), 3, '.', ''), '0'), '.') }} {{ $item->unit_code_snapshot ?: $item->inputUnit?->code }}</td>
                <td class="number">S/ {{ number_format((float) $item->line_total, 2) }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>

    <div class="row total"><span>Total</span><strong>S/ {{ number_format((float) $sale->payable_total, 2) }}</strong></div>
    @if ($sale->payments->first())
        <div class="row"><span>Pago</span><strong>{{ match ($sale->payments->first()->method) { 'cash' => 'Efectivo', 'card' => 'Tarjeta', 'bank_transfer' => 'Transferencia', default => ucfirst($sale->payments->first()->method) } }}</strong></div>
    @endif

    @if (in_array($document->document_type, ['receipt', 'invoice'], true))
        <div class="status">Estado SUNAT: {{ match ($document->sunat_status) { 'accepted' => 'Aceptado', 'observed' => 'Aceptado con observaciones', 'processing' => 'Procesando', 'error' => 'Pendiente de reenvío', default => 'En cola' } }}</div>
    @else
        <div class="status">Documento interno — no es comprobante fiscal.</div>
    @endif

    <p class="muted center">Gracias por su compra. Conserve este documento para cualquier consulta.</p>
    <div class="actions"><button type="button" onclick="window.print()">Imprimir comprobante</button></div>
</main>
</body>
</html>
