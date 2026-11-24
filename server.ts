import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HorizonType, MarketRegion } from './src/types/market.ts';
import { ensureMongoConnection, getAccountServiceStatus, initMongo } from './server/db/mongo.ts';
import { gfdlStreamBus } from './server/providers/gfdlProvider.ts';
import { newsProvider } from './server/providers/newsProvider.ts';
import { predictionProvider } from './server/providers/predictionProvider.ts';
import { createAuthRouter } from './server/routes/authRoutes.ts';
import {
  ALLOWED_EXCHANGES,
  ALLOWED_MARKETS,
  ALLOWED_MODES,
  ALLOWED_PERFORMANCE,
  ALLOWED_PRICE_TIERS,
  ALLOWED_RANGES,
  ALLOWED_SORT_BY,
  ALLOWED_SORT_DIR,
  buildProviderMeta,
  initProviderStreams,
  isValidSymbolFormat,
  marketService,
  normalizeRange,
  resolveDataMode,
} from './server/services/marketService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_HORIZONS: readonly HorizonType[] = ['7D', '14D', '30D', '90D'];

function getStringQuery(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return undefined;
}

function parseSymbolsQuery(raw?: string): string[] | undefined {
  if (!raw || !raw.trim()) return undefined;
  const list = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => isValidSymbolFormat(s))
    .slice(0, 20);
  return list.length > 0 ? list : undefined;
}

export function createApiApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();

  // Disable HTTP caching on API responses so live/stale status stays fresh
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // GET /api/health
  api.get('/health', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawMode = getStringQuery(req.query.mode);
      const dataMode = resolveDataMode(rawMode);
      if (!dataMode) {
        res.status(400).json({
          error: `Unsupported mode "${rawMode}". Allowed values: ${ALLOWED_MODES.join(', ')}.`,
          code: 'INVALID_MODE',
        });
        return;
      }

      await ensureMongoConnection();
      const counts = marketService.getCounts();
      const meta = await buildProviderMeta(dataMode);
      res.json({
        status: 'ok',
        service: 'bullsight-api',
        mode: meta.mode,
        dataMode: meta.dataMode,
        hasRealSource: meta.hasRealSource,
        accountService: meta.accountService ?? getAccountServiceStatus(),
        uptimeSeconds: Number(process.uptime().toFixed(2)),
        timestamp: new Date().toISOString(),
        counts,
        meta,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/market/overview?market=All&indexId=NIFTY50&range=3M&mode=demo|real
  api.get('/market/overview', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawMode = getStringQuery(req.query.mode);
      const dataMode = resolveDataMode(rawMode);
      if (!dataMode) {
        res.status(400).json({
          error: `Unsupported mode "${rawMode}". Allowed values: ${ALLOWED_MODES.join(', ')}.`,
          code: 'INVALID_MODE',
        });
        return;
      }

      const rawMarket = getStringQuery(req.query.market) ?? 'All';
      if (!(ALLOWED_MARKETS as readonly string[]).includes(rawMarket)) {
        res.status(400).json({
          error: `Unsupported market filter "${rawMarket}". Allowed values: All, India, US.`,
          code: 'INVALID_MARKET',
          allowedMarkets: ALLOWED_MARKETS,
        });
        return;
      }

      const rawRange = getStringQuery(req.query.range);
      const range =
        rawRange === undefined || rawRange === '' ? '3M' : normalizeRange(rawRange);
      if (!range) {
        res.status(400).json({
          error: `Unsupported range "${rawRange}". Supported ranges: ${ALLOWED_RANGES.join(', ')}.`,
          code: 'INVALID_RANGE',
          allowedRanges: ALLOWED_RANGES,
        });
        return;
      }

      const rawIndexId = getStringQuery(req.query.indexId)?.trim().toUpperCase();
      if (
        rawIndexId &&
        !['NIFTY50', 'SENSEX', 'NASDAQ', 'SP500'].includes(rawIndexId)
      ) {
        res.status(400).json({
          error: `Unknown index identifier "${rawIndexId}".`,
          code: 'INVALID_INDEX',
          allowedIndices: ['NIFTY50', 'SENSEX', 'NASDAQ', 'SP500'],
        });
        return;
      }

      const symbols = parseSymbolsQuery(getStringQuery(req.query.symbols));

      const [overview, meta] = await Promise.all([
        marketService.getOverview({
          market: rawMarket as 'All' | MarketRegion,
          indexId: rawIndexId,
          range,
          mode: dataMode,
          symbols,
        }),
        buildProviderMeta(dataMode),
      ]);

      res.json({
        ...overview,
        meta,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/stocks
  api.get('/stocks', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawMode = getStringQuery(req.query.mode);
      const dataMode = resolveDataMode(rawMode);
      if (!dataMode) {
        res.status(400).json({
          error: `Unsupported mode "${rawMode}". Allowed values: ${ALLOWED_MODES.join(', ')}.`,
          code: 'INVALID_MODE',
        });
        return;
      }

      const market = getStringQuery(req.query.market) ?? 'All';
      if (!(ALLOWED_MARKETS as readonly string[]).includes(market)) {
        res.status(400).json({
          error: `Unsupported market "${market}". Allowed values: All, India, US.`,
          code: 'INVALID_MARKET',
        });
        return;
      }

      const exchange = getStringQuery(req.query.exchange) ?? 'All';
      if (!(ALLOWED_EXCHANGES as readonly string[]).includes(exchange)) {
        res.status(400).json({
          error: `Unsupported exchange "${exchange}". Allowed values: ${ALLOWED_EXCHANGES.join(', ')}.`,
          code: 'INVALID_EXCHANGE',
        });
        return;
      }

      const priceTier = getStringQuery(req.query.priceTier) ?? 'All';
      if (!(ALLOWED_PRICE_TIERS as readonly string[]).includes(priceTier)) {
        res.status(400).json({
          error: `Unsupported priceTier "${priceTier}".`,
          code: 'INVALID_PRICE_TIER',
        });
        return;
      }

      const performance = getStringQuery(req.query.performance) ?? 'All';
      if (!(ALLOWED_PERFORMANCE as readonly string[]).includes(performance)) {
        res.status(400).json({
          error: `Unsupported performance filter "${performance}".`,
          code: 'INVALID_PERFORMANCE',
        });
        return;
      }

      const sortBy = getStringQuery(req.query.sortBy);
      if (sortBy && !(ALLOWED_SORT_BY as readonly string[]).includes(sortBy)) {
        res.status(400).json({
          error: `Unsupported sortBy "${sortBy}".`,
          code: 'INVALID_SORT_FIELD',
        });
        return;
      }

      const sortDir = getStringQuery(req.query.sortDir);
      if (sortDir && !(ALLOWED_SORT_DIR as readonly string[]).includes(sortDir)) {
        res.status(400).json({
          error: `Unsupported sortDir "${sortDir}". Use asc or desc.`,
          code: 'INVALID_SORT_DIR',
        });
        return;
      }

      const q = getStringQuery(req.query.q) ?? getStringQuery(req.query.search) ?? '';
      const sector = getStringQuery(req.query.sector) ?? 'All';
      const symbols = parseSymbolsQuery(getStringQuery(req.query.symbols));

      const [stocks, meta] = await Promise.all([
        marketService.listStocks({
          market: market as 'All' | MarketRegion,
          q,
          exchange,
          sector,
          priceTier,
          performance,
          sortBy: sortBy as (typeof ALLOWED_SORT_BY)[number] | undefined,
          sortDir: sortDir as (typeof ALLOWED_SORT_DIR)[number] | undefined,
          mode: dataMode,
          symbols,
        }),
        buildProviderMeta(dataMode),
      ]);

      const pricedCount = stocks.filter((s) => s.price !== null).length;

      res.json({
        dataMode,
        stocks,
        total: stocks.length,
        pricedCount,
        trackedUniverseLabel: meta.universeLabel,
        sectors: marketService.getSectors(),
        exchanges: marketService.getExchanges(),
        meta,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/stocks/:symbol
  api.get('/stocks/:symbol', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawMode = getStringQuery(req.query.mode);
      const dataMode = resolveDataMode(rawMode);
      if (!dataMode) {
        res.status(400).json({
          error: `Unsupported mode "${rawMode}". Allowed values: ${ALLOWED_MODES.join(', ')}.`,
          code: 'INVALID_MODE',
        });
        return;
      }

      const rawSymbol = String(req.params.symbol ?? '').trim().toUpperCase();
      if (!isValidSymbolFormat(rawSymbol)) {
        res.status(400).json({
          error: `Invalid stock symbol "${rawSymbol}".`,
          code: 'INVALID_SYMBOL',
          suggestions: marketService.getSuggestedSymbols(),
        });
        return;
      }

      const [detail, meta] = await Promise.all([
        marketService.getStockDetail(rawSymbol, dataMode),
        buildProviderMeta(dataMode),
      ]);

      if (!detail) {
        res.status(404).json({
          error: `Unknown stock symbol "${rawSymbol}". Not found in the tracked universe or connected provider.`,
          code: 'STOCK_NOT_FOUND',
          symbol: rawSymbol,
          suggestions: marketService.getSuggestedSymbols(),
        });
        return;
      }

      res.json({
        ...detail,
        meta,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/stocks/:symbol/history?range=1M
  api.get('/stocks/:symbol/history', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawMode = getStringQuery(req.query.mode);
      const dataMode = resolveDataMode(rawMode);
      if (!dataMode) {
        res.status(400).json({
          error: `Unsupported mode "${rawMode}". Allowed values: ${ALLOWED_MODES.join(', ')}.`,
          code: 'INVALID_MODE',
        });
        return;
      }

      const rawSymbol = String(req.params.symbol ?? '').trim().toUpperCase();
      if (!isValidSymbolFormat(rawSymbol)) {
        res.status(400).json({
          error: `Invalid stock symbol "${rawSymbol}".`,
          code: 'INVALID_SYMBOL',
          suggestions: marketService.getSuggestedSymbols(),
        });
        return;
      }

      const rawRange = getStringQuery(req.query.range);
      const range = normalizeRange(rawRange);
      if (!range) {
        res.status(400).json({
          error: `Unsupported range "${rawRange}". Supported ranges: ${ALLOWED_RANGES.join(', ')}.`,
          code: 'INVALID_RANGE',
          allowedRanges: ALLOWED_RANGES,
        });
        return;
      }

      const [hist, meta] = await Promise.all([
        marketService.getStockHistory(rawSymbol, range, dataMode),
        buildProviderMeta(dataMode),
      ]);

      if (!hist) {
        res.status(404).json({
          error: `Unknown stock symbol "${rawSymbol}". Cannot load historical prices.`,
          code: 'STOCK_NOT_FOUND',
          symbol: rawSymbol,
          suggestions: marketService.getSuggestedSymbols(),
        });
        return;
      }

      res.json({
        ...hist,
        meta,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/news
  api.get('/news', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawMode = getStringQuery(req.query.mode);
      const dataMode = resolveDataMode(rawMode);
      if (!dataMode) {
        res.status(400).json({
          error: `Unsupported mode "${rawMode}". Allowed values: ${ALLOWED_MODES.join(', ')}.`,
          code: 'INVALID_MODE',
        });
        return;
      }

      const category = getStringQuery(req.query.category) ?? 'All';
      const q = getStringQuery(req.query.q) ?? getStringQuery(req.query.query) ?? '';
      const ticker = getStringQuery(req.query.ticker);

      const [newsRes, meta] = await Promise.all([
        newsProvider.listNews({ category, q, ticker }, dataMode),
        buildProviderMeta(dataMode),
      ]);

      res.json({
        ...newsRes,
        meta,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/predictions/:symbol?horizon=14D
  api.get('/predictions/:symbol', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawMode = getStringQuery(req.query.mode);
      const dataMode = resolveDataMode(rawMode);
      if (!dataMode) {
        res.status(400).json({
          error: `Unsupported mode "${rawMode}". Allowed values: ${ALLOWED_MODES.join(', ')}.`,
          code: 'INVALID_MODE',
        });
        return;
      }

      const rawSymbol = String(req.params.symbol ?? '').trim().toUpperCase();
      if (!isValidSymbolFormat(rawSymbol)) {
        res.status(400).json({
          error: `Invalid stock symbol "${rawSymbol}".`,
          code: 'INVALID_SYMBOL',
        });
        return;
      }

      const rawHorizon = (getStringQuery(req.query.horizon) ?? '14D')
        .trim()
        .toUpperCase();
      if (!(ALLOWED_HORIZONS as readonly string[]).includes(rawHorizon)) {
        res.status(400).json({
          error: `Unsupported horizon "${rawHorizon}". Allowed: ${ALLOWED_HORIZONS.join(', ')}.`,
          code: 'INVALID_HORIZON',
        });
        return;
      }

      const [predRes, meta] = await Promise.all([
        predictionProvider.getPrediction(rawSymbol, rawHorizon as HorizonType, dataMode),
        buildProviderMeta(dataMode),
      ]);

      res.json({
        ...predRes,
        meta,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/stream/quotes — Server-Sent Events stream for real-time updates when WebSocket plan is connected
  api.get('/stream/quotes', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const onQuote = (payload: unknown) => {
      res.write(`event: quote\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    const heartbeat = setInterval(() => {
      res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    }, 25_000);

    gfdlStreamBus.on('quote', onQuote);
    res.write(`event: ready\ndata: ${JSON.stringify({ connected: true })}\n\n`);

    req.on('close', () => {
      clearInterval(heartbeat);
      gfdlStreamBus.off('quote', onQuote);
    });
  });

  // Account authentication & MongoDB watchlist routes
  api.use(createAuthRouter());

  // JSON 404 for unknown /api routes
  api.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'API endpoint not found.',
      code: 'ENDPOINT_NOT_FOUND',
    });
  });

  app.use('/api', api);

  // Express error guard without exposing stack traces
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[BULLSIGHT API Error]', err);
    if (res.headersSent) return;
    res.status(500).json({
      error: 'An unexpected server error occurred while processing the request.',
      code: 'INTERNAL_ERROR',
    });
  });

  return app;
}

async function startServer() {
  initMongo();
  initProviderStreams();
  const app = createApiApp();
  if (process.argv.includes('--production')) process.env.NODE_ENV = 'production';
  const apiOnly = process.env.API_ONLY === 'true' || process.argv.includes('--api-only');
  const isProd = process.env.NODE_ENV === 'production';

  if (apiOnly) {
    const apiPort = Number(process.env.API_PORT || 4000);
    app.listen(apiPort, '0.0.0.0', () => {
      console.log(`BULLSIGHT Express API running on http://0.0.0.0:${apiPort}`);
    });
    return;
  }

  const port = Number(process.env.PORT || 3000);

  if (isProd) {
    const distDir = path.resolve(__dirname, 'dist');
    const indexHtml = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      console.warn(
        'Warning: dist/index.html not found. Run "npm run build" before starting production server.'
      );
    }
    app.use(express.static(distDir, { index: false }));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(indexHtml);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(
      `BULLSIGHT server (${isProd ? 'production' : 'dev+vite'}) running on http://0.0.0.0:${port}`
    );
  });
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainModule) {
  startServer().catch((err) => {
    console.error('Failed to start BULLSIGHT server:', err);
    process.exit(1);
  });
}
