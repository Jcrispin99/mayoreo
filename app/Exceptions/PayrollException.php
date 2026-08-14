<?php

declare(strict_types=1);

namespace App\Exceptions;

final class PayrollException extends DomainException
{
    public static function employeeInactive(): self
    {
        return new self('El usuario no tiene un perfil laboral activo para la fecha actual.');
    }

    public static function invalidQr(): self
    {
        return new self('El código QR de asistencia no es válido o fue reemplazado.');
    }

    public static function duplicateScan(): self
    {
        return new self('La marcación fue rechazada porque se realizó demasiado pronto después de la anterior.');
    }

    public static function differentExitStore(): self
    {
        return new self('La salida debe registrarse en la misma tienda donde se marcó la entrada.');
    }

    public static function wrongAssignedStore(): self
    {
        return new self('El código QR no pertenece a la tienda asignada al trabajador.');
    }

    public static function closedPeriod(): self
    {
        return new self('El periodo de planilla está cerrado y ya no puede modificarse.');
    }

    public static function overlappingPeriod(): self
    {
        return new self('Las fechas se superponen con otro periodo de planilla.');
    }

    public static function missingCompensation(string $employeeName, string $date): self
    {
        return new self("El trabajador {$employeeName} no tiene una remuneración vigente para {$date}.");
    }

    public static function compensationInsideClosedPeriod(): self
    {
        return new self('No se puede registrar una remuneración dentro de un periodo de planilla cerrado.');
    }

    public static function invalidMonthlyCompensationDate(): self
    {
        return new self('Los cambios posteriores de sueldo mensual deben iniciar el primer día de un mes.');
    }

    public static function overlappingShift(): self
    {
        return new self('La jornada se superpone con otra asistencia del trabajador.');
    }

    public static function unresolvedIncidents(): self
    {
        return new self('No se puede cerrar la planilla mientras existan jornadas con incidencias.');
    }
}
