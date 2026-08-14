<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\Payroll\CreatePayrollPeriodAction;
use App\Actions\Payroll\RecalculatePayrollPeriodAction;
use App\Exceptions\PayrollException;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\V1\StorePayrollPeriodRequest;
use App\Http\Requests\Api\V1\UpdatePayrollLineRequest;
use App\Http\Resources\PayrollLineResource;
use App\Http\Resources\PayrollPeriodResource;
use App\Models\EmployeeProfile;
use App\Models\PayrollLine;
use App\Models\PayrollPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class PayrollPeriodController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $periods = PayrollPeriod::query()->withCount('lines')
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()))
            ->orderByDesc('starts_on')->get();

        return $this->success(PayrollPeriodResource::collection($periods));
    }

    public function store(StorePayrollPeriodRequest $request, CreatePayrollPeriodAction $action): JsonResponse
    {
        $period = $action->execute(
            $request->startsOn(),
            $request->endsOn(),
            $request->user()?->id,
        );

        return $this->created(new PayrollPeriodResource($period), 'Periodo de planilla creado');
    }

    public function show(PayrollPeriod $payrollPeriod): JsonResponse
    {
        return $this->success(new PayrollPeriodResource($this->loadRelations($payrollPeriod)));
    }

    public function recalculate(PayrollPeriod $payrollPeriod, RecalculatePayrollPeriodAction $action): JsonResponse
    {
        return $this->success(new PayrollPeriodResource($action->execute($payrollPeriod)), 'Planilla recalculada');
    }

    public function updateLine(
        UpdatePayrollLineRequest $request,
        PayrollPeriod $payrollPeriod,
        PayrollLine $payrollLine,
    ): JsonResponse {
        if ($payrollLine->payroll_period_id !== $payrollPeriod->id) {
            abort(404);
        }
        if ($payrollPeriod->status === PayrollPeriod::STATUS_CLOSED) {
            throw PayrollException::closedPeriod();
        }

        $adjustment = $request->adjustmentsAmount();
        $payrollLine->update([
            'adjustments_amount' => $adjustment,
            'payable_amount' => bcadd((string) $payrollLine->calculated_amount, $adjustment, 2),
            'notes' => $request->notes(),
        ]);

        return $this->success(new PayrollLineResource($payrollLine->fresh('employeeProfile.user')), 'Ajuste guardado');
    }

    public function close(
        Request $request,
        PayrollPeriod $payrollPeriod,
        RecalculatePayrollPeriodAction $action,
    ): JsonResponse {
        $period = $action->execute($payrollPeriod);
        if ($period->lines->contains(fn (PayrollLine $line) => $line->incident_days > 0)) {
            throw PayrollException::unresolvedIncidents();
        }
        $period = DB::transaction(function () use ($period, $request): PayrollPeriod {
            $locked = PayrollPeriod::query()->lockForUpdate()->findOrFail($period->id);
            if ($locked->status === PayrollPeriod::STATUS_CLOSED) {
                throw PayrollException::closedPeriod();
            }
            $locked->update([
                'status' => PayrollPeriod::STATUS_CLOSED,
                'closed_by' => $request->user()?->id,
                'closed_at' => now(),
            ]);

            return $locked;
        });

        return $this->success(new PayrollPeriodResource($this->loadRelations($period)), 'Periodo de planilla cerrado');
    }

    public function mine(Request $request): JsonResponse
    {
        $profile = $request->user()?->employeeProfile;
        if (! $profile) {
            return $this->success([]);
        }

        $lines = PayrollLine::query()->with('period')
            ->where('employee_profile_id', $profile->id)
            ->whereHas('period', fn ($query) => $query->where('status', PayrollPeriod::STATUS_CLOSED))
            ->latest('id')->get();

        return $this->success(PayrollLineResource::collection($lines));
    }

    public function employee(EmployeeProfile $employeeProfile): JsonResponse
    {
        $lines = PayrollLine::query()->with('period')
            ->where('employee_profile_id', $employeeProfile->id)
            ->latest('id')->get();

        return $this->success(PayrollLineResource::collection($lines));
    }

    private function loadRelations(PayrollPeriod $period): PayrollPeriod
    {
        return $period->load(['lines.employeeProfile.user.roles', 'lines.employeeProfile.store']);
    }
}
