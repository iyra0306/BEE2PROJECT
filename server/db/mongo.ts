import mongoose from 'mongoose';
import type { AccountServiceStatus } from '../../src/types/market.ts';

let connectionPromise: Promise<boolean> | null = null;
let lastConnectionError: string | null = null;

function sanitizeDbError(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Unable to reach MongoDB.';
  // Strip any embedded credentials if a driver message ever echoes a URI
  return raw.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, 'mongodb://<redacted>');
}

export function getMongoUri(): string | null {
  const uri = (process.env.MONGODB_URI ?? '').trim();
  return uri.length > 0 ? uri : null;
}

export function getJwtSecretValue(): string | null {
  const secret = (process.env.JWT_SECRET ?? '').trim();
  return secret.length > 0 ? secret : null;
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function ensureMongoConnection(): Promise<boolean> {
  const uri = getMongoUri();
  if (!uri) {
    lastConnectionError = null;
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      lastConnectionError = null;
      return true;
    } catch (err) {
      lastConnectionError = sanitizeDbError(err);
      return false;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

export function initMongo(): void {
  const uri = getMongoUri();
  if (!uri) {
    return;
  }

  mongoose.connection.on('connected', () => {
    lastConnectionError = null;
  });

  mongoose.connection.on('error', (err) => {
    lastConnectionError = sanitizeDbError(err);
  });

  mongoose.connection.on('disconnected', () => {
    // Wait gracefully for next request or automatic driver reconnect
  });

  void ensureMongoConnection();
}

export function getAccountServiceStatus(): AccountServiceStatus {
  const mongoConfigured = Boolean(getMongoUri());
  const jwtConfigured = Boolean(getJwtSecretValue());
  const configured = mongoConfigured && jwtConfigured;
  const connected = isMongoConnected();
  const ready = configured && connected;

  const missingSettings: string[] = [];
  if (!mongoConfigured) missingSettings.push('MONGODB_URI');
  if (!jwtConfigured) missingSettings.push('JWT_SECRET');

  let message: string;
  if (!configured) {
    message = `Account service is not configured (${missingSettings.join(
      ' and '
    )} unset). Guest watchlists remain saved locally in your browser.`;
  } else if (!connected) {
    message = lastConnectionError
      ? `MongoDB connection unavailable (${lastConnectionError}). Guest watchlists remain saved locally.`
      : 'Connecting to MongoDB Atlas...';
  } else {
    message = 'Account service connected to MongoDB Atlas.';
  }

  return {
    configured,
    mongoConfigured,
    jwtConfigured,
    connected,
    ready,
    missingSettings,
    message,
  };
}
