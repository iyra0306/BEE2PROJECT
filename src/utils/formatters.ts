import type { CurrencyCode } from '../types/market';

export function convertPrice(
  value: number,
  from: CurrencyCode,
  mode: 'Native' | 'USD' | 'INR' = 'Native',
  fxUsdToInr: number | null = null
): { amount: number; currency: CurrencyCode; converted: boolean } {
  if (mode === 'Native' || mode === from || !fxUsdToInr || fxUsdToInr <= 0) {
    return { amount: value, currency: from, converted: false };
  }
  if (from === 'USD' && mode === 'INR') {
    return { amount: value * fxUsdToInr, currency: 'INR', converted: true };
  }
  if (from === 'INR' && mode === 'USD') {
    return { amount: value / fxUsdToInr, currency: 'USD', converted: true };
  }
  return { amount: value, currency: from, converted: false };
}

export function formatCurrency(
  value: number | null | undefined,
  currency: CurrencyCode,
  mode: 'Native' | 'USD' | 'INR' = 'Native',
  decimals = 2,
  fxUsdToInr: number | null = null
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Unavailable';
  }
  const converted = convertPrice(value, currency, mode, fxUsdToInr);
  const locale = converted.currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: converted.currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(converted.amount);
}

export function formatIndexValue(
  value: number | null | undefined,
  currency: CurrencyCode
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Unavailable';
  }
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatMarketCap(
  capInRawUnits: number | null | undefined,
  currency: CurrencyCode,
  mode: 'Native' | 'USD' | 'INR' = 'Native',
  fxUsdToInr: number | null = null
): string {
  if (
    capInRawUnits === null ||
    capInRawUnits === undefined ||
    !Number.isFinite(capInRawUnits) ||
    capInRawUnits <= 0
  ) {
    return 'Unavailable';
  }
  const converted = convertPrice(capInRawUnits, currency, mode, fxUsdToInr);
  const val = converted.amount;
  const symbol = converted.currency === 'INR' ? '₹' : '$';

  if (converted.currency === 'INR') {
    const crores = val / 1e7;
    if (crores >= 100000) {
      return `${symbol}${(crores / 100000).toFixed(2)}L Cr`;
    }
    return `${symbol}${new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(crores)} Cr`;
  }

  if (val >= 1e12) {
    return `${symbol}${(val / 1e12).toFixed(2)}T`;
  }
  if (val >= 1e9) {
    return `${symbol}${(val / 1e9).toFixed(2)}B`;
  }
  return `${symbol}${(val / 1e6).toFixed(1)}M`;
}

export function formatVolume(volume: number | null | undefined): string {
  if (volume === null || volume === undefined || !Number.isFinite(volume)) {
    return 'Unavailable';
  }
  if (volume >= 1e6) {
    return `${(volume / 1e6).toFixed(2)}M`;
  }
  if (volume >= 1e3) {
    return `${(volume / 1e3).toFixed(1)}K`;
  }
  return String(Math.round(volume));
}

export function formatSignedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatSignedNumber(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}`;
}

export function formatProviderTimestamp(isoOrStr: string | null | undefined): string {
  if (!isoOrStr) return 'No timestamp';
  const ms = Date.parse(isoOrStr);
  if (Number.isNaN(ms)) return isoOrStr;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(ms));
}
