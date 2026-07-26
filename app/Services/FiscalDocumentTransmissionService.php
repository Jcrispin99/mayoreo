<?php

declare(strict_types=1);

namespace App\Services;

use App\Contracts\SunatBillSender;
use App\Exceptions\SunatTransmissionException;
use App\Models\FiscalDocument;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

final readonly class FiscalDocumentTransmissionService
{
    public function __construct(
        private SunatBillSender $sender,
    ) {}

    public function send(FiscalDocument $document): FiscalDocument
    {
        $locked = DB::transaction(function () use ($document): FiscalDocument {
            $current = FiscalDocument::query()->lockForUpdate()->findOrFail($document->id);

            if (! in_array($current->document_type, ['receipt', 'invoice'], true)) {
                throw SunatTransmissionException::unsupportedDocument($current->document_type);
            }

            if ($current->sunat_status === 'accepted'
                || $current->sunat_status === 'observed') {
                return $current;
            }

            if ($current->sunat_status === 'processing'
                && $current->sunat_sent_at?->isAfter(now()->subMinutes(5)) === true) {
                throw SunatTransmissionException::alreadyProcessing();
            }

            $current->update([
                'sunat_status' => 'processing',
                'sunat_attempts' => $current->sunat_attempts + 1,
                'sunat_error_code' => null,
                'sunat_error_message' => null,
                'sunat_sent_at' => now(),
            ]);

            return $current->refresh();
        });

        if (in_array($locked->sunat_status, ['accepted', 'observed'], true)) {
            return $locked;
        }

        try {
            $result = $this->sender->send($locked);
            $configuredDisk = config('fiscal.document_disk', 'fiscal-documents');
            $disk = Storage::disk(
                is_string($configuredDisk) ? $configuredDisk : 'fiscal-documents',
            );
            $directory = sprintf(
                '%s/%s',
                $locked->issuer_ruc,
                $locked->issued_at->format('Y/m'),
            );
            $documentCode = $locked->document_type === 'invoice' ? '01' : '03';
            $baseName = sprintf(
                '%s-%s-%s-%d',
                $locked->issuer_ruc,
                $documentCode,
                $locked->series_code,
                $locked->number,
            );
            $xmlPath = $directory.'/'.$baseName.'.xml';
            $disk->put($xmlPath, $result->xml);
            $cdrPath = null;

            if (is_string($result->cdrZip)) {
                $cdrPath = $directory.'/R-'.$baseName.'.zip';
                $disk->put($cdrPath, $result->cdrZip);
            }

            $locked->update([
                'sunat_status' => $result->status,
                'sunat_error_code' => $result->errorCode,
                'sunat_error_message' => $result->errorMessage,
                'cdr_code' => $result->cdrCode,
                'cdr_description' => $result->cdrDescription,
                'cdr_notes' => $result->notes,
                'xml_path' => $xmlPath,
                'xml_hash' => hash('sha256', $result->xml),
                'cdr_path' => $cdrPath,
                'sunat_responded_at' => now(),
            ]);

            return $locked->refresh();
        } catch (SunatTransmissionException $exception) {
            $this->recordFailure($locked, $exception);

            throw $exception;
        } catch (Throwable $exception) {
            $this->recordFailure($locked, $exception);

            throw SunatTransmissionException::transportFailure($exception->getMessage());
        }
    }

    private function recordFailure(FiscalDocument $document, Throwable $exception): void
    {
        $document->update([
            'sunat_status' => 'error',
            'sunat_error_code' => (string) $exception->getCode(),
            'sunat_error_message' => $exception->getMessage(),
            'sunat_responded_at' => now(),
        ]);
    }
}
