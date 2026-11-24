import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import type { UserAccount } from '../../src/types/market.ts';
import { getJwtSecretValue } from '../db/mongo.ts';
import type { UserDoc } from '../models/User.ts';

export const SESSION_COOKIE_NAME = 'bullsight_session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const BCRYPT_ROUNDS = 12;

export interface SessionPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TICKER_RE = /^[A-Z0-9&._:-]{1,24}$/;

export function validateDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (cleaned.length < 2 || cleaned.length > 80) return null;
  return cleaned;
}

export function validateEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized.length > 160) return null;
  if (!EMAIL_RE.test(normalized)) return null;
  return normalized;
}

export function validatePassword(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // bcrypt ignores bytes beyond 72; enforce a clean upper bound of 128 chars to avoid hashing DoS
  if (raw.length < 8 || raw.length > 128) return null;
  return raw;
}

export function sanitizeTickerSymbol(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const clean = raw.trim().toUpperCase().replace(/^NSE:|^BSE:|^NASDAQ:|^NYSE:/, '');
  if (!TICKER_RE.test(clean)) return null;
  return clean;
}

export function sanitizeWatchlistInput(raw: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(raw)) return fallback;
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const clean = sanitizeTickerSymbol(item);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      unique.push(clean);
      if (unique.length >= 100) break;
    }
  }
  return unique;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSessionToken(user: { id: string; email: string }): string {
  const secret = getJwtSecretValue();
  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return jwt.sign(
    { sub: user.id, email: user.email },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: SESSION_MAX_AGE_SECONDS,
      issuer: 'bullsight',
      audience: 'bullsight-web',
    }
  );
}

export function verifySessionToken(token: string): SessionPayload | null {
  const secret = getJwtSecretValue();
  if (!secret || !token || token.length > 2048) return null;
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'bullsight',
      audience: 'bullsight-web',
    });
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof decoded.sub === 'string' &&
      typeof (decoded as Record<string, unknown>).email === 'string'
    ) {
      return {
        sub: decoded.sub,
        email: String((decoded as Record<string, unknown>).email),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function isSecureRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = (req.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'HttpOnly',
  ];
  if (isSecureRequest(req)) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'HttpOnly',
  ];
  if (isSecureRequest(req)) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function getSessionCookieToken(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, unknown> }).cookies;
  const val = cookies?.[SESSION_COOKIE_NAME];
  if (typeof val !== 'string' || !val.trim()) return null;
  return val.trim();
}

export function toPublicUser(doc: UserDoc): UserAccount {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    watchlist: Array.isArray(doc.watchlist) ? doc.watchlist : [],
    createdAt:
      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : undefined,
  };
}
