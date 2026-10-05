import Constants from 'expo-constants';

const configuredTimeZone = Constants.expoConfig?.extra?.businessTimeZone;

export const BUSINESS_TIME_ZONE = typeof configuredTimeZone === 'string'
  ? configuredTimeZone
  : 'America/Lima';

export function formatBusinessDateTime(value: string | null): string {
  if (!value) return 'Pendiente';

  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(value));
}

export function formatBusinessTime(value: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(value));
}

export function currentBusinessMonth(): { startsOn: string; endsOn: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: BUSINESS_TIME_ZONE,
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const monthText = String(month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    startsOn: `${year}-${monthText}-01`,
    endsOn: `${year}-${monthText}-${lastDay}`,
  };
}

function businessDateParts(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: BUSINESS_TIME_ZONE,
  }).formatToParts(new Date());

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  };
}

function isoUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function currentBusinessWeek(): { startsOn: string; endsOn: string } {
  const { year, month, day } = businessDateParts();
  const today = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - daysSinceMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return { startsOn: isoUtcDate(start), endsOn: isoUtcDate(end) };
}

export function formatBusinessDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    ...(options ?? { day: 'numeric', month: 'short', year: 'numeric' }),
  }).format(new Date(`${value}T12:00:00Z`));
}
