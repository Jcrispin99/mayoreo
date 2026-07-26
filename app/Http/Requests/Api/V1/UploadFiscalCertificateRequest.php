<?php

declare(strict_types=1);

namespace App\Http\Requests\Api\V1;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

/**
 * @property UploadedFile $certificate
 */
final class UploadFiscalCertificateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('fiscal-credentials.manage') === true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $maxSize = config('fiscal.certificate_max_size_kb', 5120);

        return [
            'certificate' => [
                'required',
                'file',
                'extensions:pem,pfx,p12,txt',
                'max:'.(is_numeric($maxSize) ? (int) $maxSize : 5120),
            ],
            'certificate_password' => ['sometimes', 'nullable', 'string', 'max:1024'],
        ];
    }

    public function certificatePassword(): ?string
    {
        $password = $this->validated('certificate_password');

        return is_string($password) && $password !== '' ? $password : null;
    }
}
