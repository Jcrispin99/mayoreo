import type { PayFrequency } from './workforce-types';

export function frequencyLabel(frequency: PayFrequency | 'daily'): string {
  if (frequency === 'monthly') return 'Mensual';
  if (frequency === 'weekly') return 'Semanal';
  return 'Diario histórico';
}

export function minutesLabel(minutes: number | null): string {
  if (minutes === null) return 'Sin meta registrada';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}

export function decimalHours(minutes: number | null): string {
  if (minutes === null) return '';
  const value = minutes / 60;
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function percentageLabel(ratio: string | number): string {
  return `${Math.round(Number(ratio) * 100)}%`;
}
