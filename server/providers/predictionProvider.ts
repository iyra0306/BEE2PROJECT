import type {
  DataMode,
  HorizonType,
  PredictionResponse,
  ProviderHealthStatus,
  StockPrediction,
} from '../../src/types/market.ts';
import { getProviderConfig } from '../config/providers.ts';
import { getDemoPrediction } from '../data/demoData.ts';
import { dedupeInFlight, getFreshCache, setCacheValue } from '../services/providerCache.ts';

let lastSuccessAt: string | null = null;
let lastError: string | null = null;

export const predictionProvider = {
  isConfigured(): boolean {
    return getProviderConfig().prediction.configured;
  },

  getHealth(): ProviderHealthStatus {
    const cfg = getProviderConfig().prediction;
    return {
      id: 'prediction',
      name: 'Python Prediction Service',
      configured: cfg.configured,
      connected: cfg.configured && lastSuccessAt !== null,
      feedStatus: cfg.configured ? 'Live' : 'Unavailable',
      streaming: false,
      recommendedPollMs: 300_000,
      missingSettings: cfg.configured ? [] : ['PYTHON_PREDICTION_URL'],
      notes: cfg.configured
        ? 'Connected to Python model endpoint for actual forecasts and evaluation metrics.'
        : 'Prediction service not connected. Configure PYTHON_PREDICTION_URL to stream model forecasts.',
      lastSuccessAt,
      lastError: cfg.configured ? lastError : 'Prediction service not connected',
    };
  },

  async getPrediction(
    symbol: string,
    horizon: HorizonType,
    mode: DataMode = 'real'
  ): Promise<Omit<PredictionResponse, 'meta'>> {
    const upper = symbol.trim().toUpperCase();

    if (mode === 'demo') {
      return {
        dataMode: 'demo',
        connected: true,
        isDemo: true,
        symbol: upper,
        horizon,
        prediction: getDemoPrediction(upper, horizon),
      };
    }

    const cfg = getProviderConfig().prediction;
    if (!cfg.configured || !cfg.apiUrl) {
      return {
        dataMode: 'real',
        connected: false,
        isDemo: false,
        symbol: upper,
        horizon,
        message: 'Prediction service not connected',
        prediction: null,
      };
    }

    const cacheKey = `pred:${upper}:${horizon}`;
    const fresh = getFreshCache<Omit<PredictionResponse, 'meta'>>(cacheKey);
    if (fresh) return fresh;

    return dedupeInFlight(cacheKey, async () => {
      const url = new URL(`${cfg.apiUrl}/predict`);
      url.searchParams.set('symbol', upper);
      url.searchParams.set('horizon', horizon);

      const headers: Record<string, string> = { Accept: 'application/json' };
      if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(url.toString(), {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        if (!res.ok) {
          lastError = `Python prediction service returned HTTP ${res.status}.`;
          return {
            connected: false,
            symbol: upper,
            horizon,
            message: `Prediction service unavailable (HTTP ${res.status}).`,
            prediction: null,
          };
        }
        const data = (await res.json()) as StockPrediction;
        lastSuccessAt = new Date().toISOString();
        lastError = null;

        const out: Omit<PredictionResponse, 'meta'> = {
          connected: true,
          symbol: upper,
          horizon,
          prediction: data,
        };
        setCacheValue(cacheKey, out, 120_000);
        return out;
      } catch {
        lastError = 'Unable to reach Python prediction service.';
        return {
          connected: false,
          symbol: upper,
          horizon,
          message: 'Prediction service temporarily unreachable.',
          prediction: null,
        };
      } finally {
        clearTimeout(timer);
      }
    });
  },
};
