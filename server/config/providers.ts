import type { FeedStatus } from '../../src/types/market.ts';

function normalizeFreshness(raw: string | undefined, fallback: FeedStatus): FeedStatus {
  const cleaned = (raw ?? '').trim().toLowerCase();
  if (cleaned === 'live' || cleaned === 'realtime' || cleaned === 'real-time') {
    return 'Live';
  }
  if (cleaned === 'delayed') return 'Delayed';
  if (cleaned === 'eod' || cleaned === 'end of day' || cleaned === 'end_of_day') {
    return 'End of day';
  }
  return fallback;
}

export function resolveVerifiedFreshness(opts: {
  providerTimestampIso: string | null;
  streamingActive?: boolean;
  explicitMarketOpen?: boolean | null;
  tierHint: FeedStatus;
}): FeedStatus {
  if (opts.tierHint === 'End of day') {
    return 'End of day';
  }
  if (opts.explicitMarketOpen === false) {
    return 'End of day';
  }
  if (!opts.providerTimestampIso) {
    return 'Delayed';
  }
  const tsMs = Date.parse(opts.providerTimestampIso);
  if (Number.isNaN(tsMs)) {
    return 'Delayed';
  }
  const ageMs = Math.max(0, Date.now() - tsMs);
  if (ageMs > 8 * 3600 * 1000) {
    return 'End of day';
  }
  if (opts.tierHint === 'Live' && (opts.streamingActive || ageMs <= 20_000)) {
    return 'Live';
  }
  return 'Delayed';
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '0.0.0.0' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  if (lower === '::1' || lower.startsWith('fe80:')) {
    return true;
  }
  return false;
}

export function validateExternalEndpoint(
  rawUrl: string | undefined,
  allowedProtocols: readonly string[],
  allowLocalInDev = false
): { valid: boolean; url: string | null; reason?: string } {
  const trimmed = (rawUrl ?? '').trim();
  if (!trimmed) return { valid: false, url: null };
  try {
    const parsed = new URL(trimmed);
    if (!allowedProtocols.includes(parsed.protocol)) {
      return {
        valid: false,
        url: null,
        reason: `Unsupported URL protocol "${parsed.protocol}". Expected ${allowedProtocols.join(' or ')}.`,
      };
    }
    if (!allowLocalInDev && isBlockedHostname(parsed.hostname)) {
      return {
        valid: false,
        url: null,
        reason: `Blocked internal/metadata host "${parsed.hostname}".`,
      };
    }
    return { valid: true, url: parsed.toString().replace(/\/+$/, '') };
  } catch {
    return {
      valid: false,
      url: null,
      reason: 'Invalid endpoint URL format. Expected protocol://host:port.',
    };
  }
}

export function getProviderConfig() {
  const gfdlApiKey = (process.env.GFDL_API_KEY ?? '').trim();
  const gfdlRestCheck = validateExternalEndpoint(
    process.env.GFDL_REST_URL,
    ['http:', 'https:'],
    false
  );
  const gfdlStreamingEnabled =
    (process.env.GFDL_STREAMING_ENABLED ?? 'false').trim().toLowerCase() === 'true';
  const gfdlWsCheck = gfdlStreamingEnabled
    ? validateExternalEndpoint(process.env.GFDL_WS_URL, ['ws:', 'wss:'], false)
    : { valid: false, url: null as string | null, reason: undefined };

  const allowedExchangesRaw = (
    process.env.GFDL_ALLOWED_EXCHANGES ?? 'NSE,NSE_IDX,BSE,BSE_IDX'
  )
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const twelveDataApiKey = (process.env.TWELVE_DATA_API_KEY ?? '').trim();
  const rpmParsed = Number.parseInt(
    process.env.TWELVE_DATA_RATE_LIMIT_RPM ?? '8',
    10
  );
  const twelveDataRpm =
    Number.isFinite(rpmParsed) && rpmParsed > 0 ? rpmParsed : 8;

  const newsUrlCheck = validateExternalEndpoint(
    process.env.NEWS_API_URL,
    ['http:', 'https:'],
    false
  );
  const newsApiKey = (process.env.NEWS_API_KEY ?? '').trim();

  const predUrlCheck = validateExternalEndpoint(
    process.env.PYTHON_PREDICTION_URL,
    ['http:', 'https:'],
    process.env.NODE_ENV !== 'production'
  );
  const predApiKey = (process.env.PYTHON_PREDICTION_API_KEY ?? '').trim();

  return {
    gfdl: {
      apiKey: gfdlApiKey,
      restUrl: gfdlRestCheck.valid ? gfdlRestCheck.url : null,
      restUrlError: gfdlRestCheck.reason,
      streamingEnabled: gfdlStreamingEnabled,
      wsUrl: gfdlStreamingEnabled && gfdlWsCheck.valid ? gfdlWsCheck.url : null,
      wsUrlError: gfdlWsCheck.reason,
      feedTierHint: normalizeFreshness(process.env.GFDL_FEED_FRESHNESS, 'Delayed'),
      allowedExchanges: new Set(allowedExchangesRaw),
      niftyExchange: (process.env.GFDL_NIFTY_EXCHANGE ?? 'NSE_IDX').trim().toUpperCase(),
      niftySymbol: (process.env.GFDL_NIFTY_SYMBOL ?? 'NIFTY 50').trim(),
      sensexExchange: (process.env.GFDL_SENSEX_EXCHANGE ?? 'BSE_IDX').trim().toUpperCase(),
      sensexSymbol: (process.env.GFDL_SENSEX_SYMBOL ?? 'SENSEX').trim(),
      fundamentalsEnabled:
        (process.env.GFDL_FUNDAMENTALS_ENABLED ?? 'false').trim().toLowerCase() === 'true',
      configured: Boolean(gfdlApiKey && gfdlRestCheck.valid),
    },
    twelveData: {
      apiKey: twelveDataApiKey,
      baseUrl: 'https://api.twelvedata.com',
      feedTierHint: normalizeFreshness(
        process.env.TWELVE_DATA_FEED_FRESHNESS,
        'Delayed'
      ),
      rateLimitRpm: twelveDataRpm,
      configured: Boolean(twelveDataApiKey),
    },
    news: {
      apiUrl: newsUrlCheck.valid ? newsUrlCheck.url : null,
      apiKey: newsApiKey,
      configured: Boolean(newsUrlCheck.valid),
    },
    prediction: {
      apiUrl: predUrlCheck.valid ? predUrlCheck.url : null,
      apiKey: predApiKey,
      configured: Boolean(predUrlCheck.valid),
    },
  };
}
