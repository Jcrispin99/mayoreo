const MONEY_INPUT_PATTERN = /^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/;

function normalizedDecimal(value: string | number) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toFixed(6) : '';
  }

  return value.trim().replace(',', '.');
}

export function decimalToCents(value: string | number): number | null {
  const match = normalizedDecimal(value).match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return null;

  const whole = Number(match[1]);
  const fraction = match[2] ?? '';
  if (!Number.isSafeInteger(whole)) return null;

  const cents = Number((fraction.slice(0, 2) || '').padEnd(2, '0'));
  const rounded = (Number(fraction[2] ?? '0') >= 5 ? 1 : 0);
  const result = (whole * 100) + cents + rounded;

  return Number.isSafeInteger(result) ? result : null;
}

export function moneyInputToCents(value: string): number | null {
  const normalized = value.trim();
  if (!MONEY_INPUT_PATTERN.test(normalized)) return null;

  const [wholePart, fractionPart = ''] = normalized.replace(',', '.').split('.');
  const whole = Number(wholePart || '0');
  const cents = Number(fractionPart.padEnd(2, '0'));
  const result = (whole * 100) + cents;

  return Number.isSafeInteger(result) ? result : null;
}

export function centsToDecimal(cents: number) {
  const normalized = Number.isFinite(cents) ? Math.trunc(cents) : 0;
  const sign = normalized < 0 ? '-' : '';
  const absolute = Math.abs(normalized);

  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

export function formatMoneyFromCents(cents: number) {
  return `S/ ${centsToDecimal(cents)}`;
}

export function formatPosMoney(value: string | number) {
  return formatMoneyFromCents(decimalToCents(value) ?? 0);
}

export function cashSuggestions(totalCents: number) {
  const steps = [500, 1000, 2000, 5000, 10000, 20000];
  const uniqueSuggestions = new Set<number>();

  for (const step of steps) {
    const suggestion = (Math.floor(totalCents / step) + 1) * step;
    if (suggestion > totalCents) uniqueSuggestions.add(suggestion);
  }

  return [...uniqueSuggestions].sort((left, right) => left - right).slice(0, 3);
}
