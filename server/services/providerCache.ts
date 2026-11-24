interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  updatedAt: number;
}

const inFlight = new Map<string, Promise<unknown>>();
const freshCache = new Map<string, CacheEntry<unknown>>();
const staleCache = new Map<string, CacheEntry<unknown>>();

// Tracks per-provider API credit timestamps over a rolling 60-second window
const creditLog = new Map<string, number[]>();

export async function dedupeInFlight<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

export function getFreshCache<T>(key: string): T | null {
  const entry = freshCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    freshCache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCacheValue<T>(key: string, value: T, ttlMs: number): void {
  const now = Date.now();
  const entry: CacheEntry<T> = {
    value,
    expiresAt: now + ttlMs,
    updatedAt: now,
  };
  freshCache.set(key, entry);
  staleCache.set(key, entry);
}

export function getStaleCache<T>(key: string): T | null {
  const entry = staleCache.get(key) as CacheEntry<T> | undefined;
  return entry ? entry.value : null;
}

export function clearExpiredCache(): void {
  const now = Date.now();
  for (const [k, v] of freshCache.entries()) {
    if (now > v.expiresAt) freshCache.delete(k);
  }
}

export function canConsumeCredits(
  provider: string,
  credits: number,
  maxPerMinute: number
): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (creditLog.get(provider) ?? []).filter((ts) => ts > windowStart);
  creditLog.set(provider, timestamps);
  return timestamps.length + credits <= maxPerMinute;
}

export function consumeCredits(
  provider: string,
  credits: number,
  maxPerMinute: number
): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (creditLog.get(provider) ?? []).filter((ts) => ts > windowStart);
  if (timestamps.length + credits > maxPerMinute) {
    creditLog.set(provider, timestamps);
    return false;
  }
  for (let i = 0; i < credits; i++) {
    timestamps.push(now);
  }
  creditLog.set(provider, timestamps);
  return true;
}

export function getRemainingCredits(provider: string, maxPerMinute: number): number {
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (creditLog.get(provider) ?? []).filter((ts) => ts > windowStart);
  creditLog.set(provider, timestamps);
  return Math.max(0, maxPerMinute - timestamps.length);
}
