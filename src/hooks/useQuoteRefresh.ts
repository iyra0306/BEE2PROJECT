import { useEffect, useRef } from 'react';
import type { ApiProviderMeta } from '../types/market';

/**
 * Refreshes active market views via SSE when real-time WebSocket streaming is enabled,
 * or falls back to visibility-aware, rate-limited polling when providers are configured.
 */
export function useQuoteRefresh(
  meta: ApiProviderMeta | null | undefined,
  onRefresh: () => void
) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const streamingActive = Boolean(meta?.streamingActive);
  const pollMs = meta?.recommendedPollMs ?? 0;
  const mode = meta?.mode ?? 'unconfigured';

  useEffect(() => {
    if (mode === 'unconfigured' || pollMs <= 0) return;

    let es: EventSource | null = null;
    let lastStreamTrigger = 0;

    if (streamingActive && typeof EventSource !== 'undefined') {
      es = new EventSource('/api/stream/quotes');
      es.addEventListener('quote', () => {
        const now = Date.now();
        // Throttle UI re-fetches to max once every 3s during high-frequency ticks
        if (now - lastStreamTrigger >= 3000 && document.visibilityState === 'visible') {
          lastStreamTrigger = now;
          onRefreshRef.current();
        }
      });
    }

    const effectivePoll = Math.max(15_000, pollMs);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        onRefreshRef.current();
      }
    }, effectivePoll);

    return () => {
      if (es) es.close();
      window.clearInterval(timer);
    };
  }, [mode, pollMs, streamingActive]);
}
