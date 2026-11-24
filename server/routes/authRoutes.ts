import express, { type NextFunction, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import {
  ensureMongoConnection,
  getAccountServiceStatus,
} from '../db/mongo.ts';
import { UserModel } from '../models/User.ts';
import {
  clearSessionCookie,
  getSessionCookieToken,
  hashPassword,
  sanitizeTickerSymbol,
  sanitizeWatchlistInput,
  setSessionCookie,
  signSessionToken,
  toPublicUser,
  validateDisplayName,
  validateEmail,
  validatePassword,
  verifyPassword,
  verifySessionToken,
} from '../services/authService.ts';

interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    email: string;
  };
}

const DEFAULT_NEW_USER_WATCHLIST = [
  'RELIANCE',
  'TCS',
  'INFY',
  'NVDA',
  'AAPL',
  'MSFT',
];

// Simple sliding-window in-memory rate limiter for auth endpoints
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 25;
const authAttemptMap = new Map<string, number[]>();

function authRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const timestamps = (authAttemptMap.get(ip) ?? []).filter(
    (ts) => now - ts < AUTH_WINDOW_MS
  );
  if (timestamps.length >= AUTH_MAX_ATTEMPTS) {
    res.status(429).json({
      error: 'Too many authentication attempts. Please wait a few minutes and try again.',
      code: 'RATE_LIMITED',
    });
    return;
  }
  timestamps.push(now);
  authAttemptMap.set(ip, timestamps);
  next();
}

function verifyCsrfOrigin(req: Request, res: Response, next: NextFunction) {
  const rawHost = (req.get('x-forwarded-host') || req.get('host') || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const origin = req.get('origin');

  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (!rawHost || originHost !== rawHost) {
        res.status(403).json({
          error: 'Cross-origin request rejected.',
          code: 'FORBIDDEN_ORIGIN',
        });
        return;
      }
      next();
      return;
    } catch {
      res.status(403).json({
        error: 'Invalid request origin.',
        code: 'FORBIDDEN_ORIGIN',
      });
      return;
    }
  }

  const referer = req.get('referer');
  if (referer) {
    try {
      const refHost = new URL(referer).host.toLowerCase();
      if (rawHost && refHost !== rawHost) {
        res.status(403).json({
          error: 'Cross-origin referer rejected.',
          code: 'FORBIDDEN_ORIGIN',
        });
        return;
      }
      next();
      return;
    } catch {
      res.status(403).json({
        error: 'Invalid request referer.',
        code: 'FORBIDDEN_ORIGIN',
      });
      return;
    }
  }

  if (req.get('x-requested-with')) {
    next();
    return;
  }

  res.status(403).json({
    error: 'Missing origin verification header.',
    code: 'CSRF_REQUIRED',
  });
}

async function ensureServiceReady(res: Response): Promise<boolean> {
  await ensureMongoConnection();
  const status = getAccountServiceStatus();
  if (!status.ready) {
    res.status(503).json({
      error: status.configured
        ? status.message
        : 'Account service is unconfigured on the server. Add MONGODB_URI and JWT_SECRET to enable sign-in and registration.',
      code: 'ACCOUNT_SERVICE_UNAVAILABLE',
      accountService: status,
    });
    return false;
  }
  return true;
}

async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const ok = await ensureServiceReady(res);
  if (!ok) return;

  const token = getSessionCookieToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Authentication required. Please sign in to manage your saved watchlist.',
      code: 'UNAUTHENTICATED',
    });
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload || !mongoose.Types.ObjectId.isValid(payload.sub)) {
    clearSessionCookie(req, res);
    res.status(401).json({
      error: 'Your session has expired or is invalid. Please sign in again.',
      code: 'INVALID_SESSION',
    });
    return;
  }

  req.auth = { userId: payload.sub, email: payload.email };
  next();
}

export function createAuthRouter() {
  const router = express.Router();

  // GET /api/auth/status
  router.get('/auth/status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await ensureMongoConnection();
      res.json(getAccountServiceStatus());
    } catch (err) {
      next(err);
    }
  });

  // GET /api/auth/me
  router.get('/auth/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ensureMongoConnection();
      const status = getAccountServiceStatus();
      if (!status.ready) {
        res.json({
          authenticated: false,
          user: null,
          accountService: status,
        });
        return;
      }

      const token = getSessionCookieToken(req);
      if (!token) {
        res.json({
          authenticated: false,
          user: null,
          accountService: status,
        });
        return;
      }

      const payload = verifySessionToken(token);
      if (!payload || !mongoose.Types.ObjectId.isValid(payload.sub)) {
        clearSessionCookie(req, res);
        res.json({
          authenticated: false,
          user: null,
          accountService: status,
        });
        return;
      }

      const user = await UserModel.findById(payload.sub).exec();
      if (!user) {
        clearSessionCookie(req, res);
        res.json({
          authenticated: false,
          user: null,
          accountService: status,
        });
        return;
      }

      res.json({
        authenticated: true,
        user: toPublicUser(user),
        accountService: status,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/register
  router.post(
    '/auth/register',
    verifyCsrfOrigin,
    authRateLimit,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!(await ensureServiceReady(res))) return;

        const body =
          typeof req.body === 'object' && req.body !== null ? req.body : {};
        const name = validateDisplayName(body.name);
        const email = validateEmail(body.email);
        const password = validatePassword(body.password);

        if (!name) {
          res.status(400).json({
            error: 'Display name must be between 2 and 80 characters.',
            code: 'INVALID_NAME',
          });
          return;
        }
        if (!email) {
          res.status(400).json({
            error: 'Enter a valid email address.',
            code: 'INVALID_EMAIL',
          });
          return;
        }
        if (!password) {
          res.status(400).json({
            error: 'Password must be between 8 and 128 characters.',
            code: 'INVALID_PASSWORD',
          });
          return;
        }

        const existing = await UserModel.findOne({ email }).select('_id').exec();
        if (existing) {
          res.status(409).json({
            error: 'An account with this email address already exists.',
            code: 'EMAIL_EXISTS',
          });
          return;
        }

        const passwordHash = await hashPassword(password);
        const initialWatchlist =
          body.watchlist !== undefined
            ? sanitizeWatchlistInput(body.watchlist, DEFAULT_NEW_USER_WATCHLIST)
            : DEFAULT_NEW_USER_WATCHLIST;

        const created = await UserModel.create({
          name,
          email,
          passwordHash,
          watchlist: initialWatchlist,
        });

        const publicUser = toPublicUser(created);
        const token = signSessionToken({
          id: publicUser.id,
          email: publicUser.email,
        });
        setSessionCookie(req, res, token);

        res.status(201).json({
          authenticated: true,
          user: publicUser,
        });
      } catch (err) {
        if (
          typeof err === 'object' &&
          err !== null &&
          (err as { code?: number }).code === 11000
        ) {
          res.status(409).json({
            error: 'An account with this email address already exists.',
            code: 'EMAIL_EXISTS',
          });
          return;
        }
        next(err);
      }
    }
  );

  // POST /api/auth/login
  router.post(
    '/auth/login',
    verifyCsrfOrigin,
    authRateLimit,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!(await ensureServiceReady(res))) return;

        const body =
          typeof req.body === 'object' && req.body !== null ? req.body : {};
        const email = validateEmail(body.email);
        const password = typeof body.password === 'string' ? body.password : '';

        if (!email || !password || password.length > 128) {
          res.status(400).json({
            error: 'Enter a valid email address and password.',
            code: 'INVALID_CREDENTIALS_INPUT',
          });
          return;
        }

        const user = await UserModel.findOne({ email })
          .select('+passwordHash')
          .exec();
        if (!user || typeof user.passwordHash !== 'string') {
          res.status(401).json({
            error: 'Invalid email or password.',
            code: 'INVALID_CREDENTIALS',
          });
          return;
        }

        const matches = await verifyPassword(password, user.passwordHash);
        if (!matches) {
          res.status(401).json({
            error: 'Invalid email or password.',
            code: 'INVALID_CREDENTIALS',
          });
          return;
        }

        const publicUser = toPublicUser(user);
        const token = signSessionToken({
          id: publicUser.id,
          email: publicUser.email,
        });
        setSessionCookie(req, res, token);

        res.json({
          authenticated: true,
          user: publicUser,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/auth/logout
  router.post(
    '/auth/logout',
    verifyCsrfOrigin,
    (req: Request, res: Response) => {
      clearSessionCookie(req, res);
      res.json({ ok: true, authenticated: false });
    }
  );

  // GET /api/user/watchlist
  router.get(
    '/user/watchlist',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const user = await UserModel.findById(req.auth?.userId).exec();
        if (!user) {
          clearSessionCookie(req, res);
          res.status(401).json({
            error: 'Account session is no longer valid.',
            code: 'UNAUTHENTICATED',
          });
          return;
        }
        res.json({ watchlist: user.watchlist ?? [] });
      } catch (err) {
        next(err);
      }
    }
  );

  // PUT /api/user/watchlist (replace full ordered array)
  router.put(
    '/user/watchlist',
    verifyCsrfOrigin,
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const body =
          typeof req.body === 'object' && req.body !== null ? req.body : {};
        if (!Array.isArray(body.watchlist)) {
          res.status(400).json({
            error: 'Request body must include a watchlist array.',
            code: 'INVALID_WATCHLIST',
          });
          return;
        }

        const sanitized = sanitizeWatchlistInput(body.watchlist);
        const updated = await UserModel.findByIdAndUpdate(
          req.auth?.userId,
          { $set: { watchlist: sanitized } },
          { new: true }
        ).exec();

        if (!updated) {
          res.status(401).json({
            error: 'Account session is no longer valid.',
            code: 'UNAUTHENTICATED',
          });
          return;
        }

        res.json({ watchlist: updated.watchlist ?? [] });
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/user/watchlist (add single ticker)
  router.post(
    '/user/watchlist',
    verifyCsrfOrigin,
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const body =
          typeof req.body === 'object' && req.body !== null ? req.body : {};
        const ticker = sanitizeTickerSymbol(body.ticker);
        if (!ticker) {
          res.status(400).json({
            error: 'Provide a valid ticker symbol.',
            code: 'INVALID_TICKER',
          });
          return;
        }

        const existing = await UserModel.findById(req.auth?.userId).exec();
        if (!existing) {
          res.status(401).json({
            error: 'Account session is no longer valid.',
            code: 'UNAUTHENTICATED',
          });
          return;
        }

        const current = Array.isArray(existing.watchlist) ? existing.watchlist : [];
        const nextList = [
          ticker,
          ...current.filter((item) => item !== ticker),
        ].slice(0, 100);

        existing.watchlist = nextList;
        await existing.save();

        res.json({ watchlist: existing.watchlist });
      } catch (err) {
        next(err);
      }
    }
  );

  // DELETE /api/user/watchlist/:ticker
  router.delete(
    '/user/watchlist/:ticker',
    verifyCsrfOrigin,
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const ticker = sanitizeTickerSymbol(req.params.ticker);
        if (!ticker) {
          res.status(400).json({
            error: 'Invalid ticker symbol.',
            code: 'INVALID_TICKER',
          });
          return;
        }

        const updated = await UserModel.findByIdAndUpdate(
          req.auth?.userId,
          { $pull: { watchlist: ticker } },
          { new: true }
        ).exec();

        if (!updated) {
          res.status(401).json({
            error: 'Account session is no longer valid.',
            code: 'UNAUTHENTICATED',
          });
          return;
        }

        res.json({ watchlist: updated.watchlist ?? [] });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
