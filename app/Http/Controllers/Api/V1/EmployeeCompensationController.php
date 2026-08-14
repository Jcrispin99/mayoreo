<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Payroll\SaveEmployeeCompensationAction;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StoreEmployeeCompensationRequest;
use App\Http\Resources\EmployeeCompensationResource;
use App\Models\EmployeeProfile;
use Illuminate\Http\JsonResponse;

final class EmployeeCompensationController extends ApiController
{
    public function __construct(private readonly SaveEmployeeCompensationAction $saveAction) {}

    public function index(EmployeeProfile $employeeProfile): JsonResponse
    {
        return $this->success(EmployeeCompensationResource::collection($employeeProfile->compensations()->get()));
    }

    public function store(StoreEmployeeCompensationRequest $request, EmployeeProfile $employeeProfile): JsonResponse
    {
        $compensation = $this->saveAction->execute(
            $employeeProfile,
            $request->payType(),
            $request->amount(),
            $request->effectiveFrom(),
            $request->user()?->id,
            $request->notes(),
        );

        return $this->created(new EmployeeCompensationResource($compensation), 'Remuneración registrada');
    }
}
