import mongoose from 'mongoose';
import { getServerEnv } from '../lib/env';
import { CreatorProfileModel, PaymentTransactionModel } from './models';

export type DbSession = mongoose.ClientSession;

const globalForMongo = globalThis as unknown as {
  __tippyMongoReady?: Promise<typeof mongoose>;
  __tippyMongoIndexesReady?: Promise<void>;
};

async function ensureIndexes(): Promise<void> {
  if (globalForMongo.__tippyMongoIndexesReady) {
    return globalForMongo.__tippyMongoIndexesReady;
  }

  globalForMongo.__tippyMongoIndexesReady = (async () => {
    try {
      // Old unique+sparse index treated `null` as a value, blocking every
      // creator after the first. Strip nulls then replace the index.
      await CreatorProfileModel.updateMany(
        {
          $or: [
            { bachsAccountId: null },
            { bachsAccountId: '' },
          ],
        },
        { $unset: { bachsAccountId: 1 } },
      );

      const collection = CreatorProfileModel.collection;
      const existing = await collection.indexes();
      for (const idx of existing) {
        const name = idx.name;
        if (!name || name === '_id_') continue;
        const keys = Object.keys(idx.key ?? {});
        if (
          keys.length === 1 &&
          keys[0] === 'bachsAccountId' &&
          name !== 'bachsAccountId_partial'
        ) {
          await collection.dropIndex(name);
          console.info(`[db] dropped legacy index ${name}`);
        }
      }

      await CreatorProfileModel.syncIndexes();
    } catch (err) {
      console.warn(
        `[db] creator index repair skipped: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }

    try {
      // Same null-vs-sparse trap on checkout refs: one pending payment with
      // providerReference:null blocked every later POST /api/tips (E11000 → 500).
      await PaymentTransactionModel.updateMany(
        {
          $or: [
            { providerReference: null },
            { providerReference: '' },
          ],
        },
        { $unset: { providerReference: 1 } },
      );

      const paymentCollection = PaymentTransactionModel.collection;
      const paymentIndexes = await paymentCollection.indexes();
      for (const idx of paymentIndexes) {
        const name = idx.name;
        if (!name || name === '_id_') continue;
        const keys = Object.keys(idx.key ?? {});
        if (
          keys.length === 2 &&
          keys[0] === 'provider' &&
          keys[1] === 'providerReference' &&
          name !== 'provider_providerReference_partial'
        ) {
          await paymentCollection.dropIndex(name);
          console.info(`[db] dropped legacy index ${name}`);
        }
      }

      await PaymentTransactionModel.syncIndexes();
    } catch (err) {
      console.warn(
        `[db] payment index repair skipped: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  })();

  return globalForMongo.__tippyMongoIndexesReady;
}

export async function connectMongo(uri?: string): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    await ensureIndexes();
    return mongoose;
  }
  if (!globalForMongo.__tippyMongoReady) {
    const connectionUri = uri || getServerEnv().MONGODB_URI;
    globalForMongo.__tippyMongoReady = mongoose
      .connect(connectionUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 15_000,
      })
      .then(async (conn) => {
        console.info('[db] mongodb connected');
        await ensureIndexes();
        return conn;
      });
    globalForMongo.__tippyMongoReady.catch((err: Error) => {
      globalForMongo.__tippyMongoReady = undefined;
      globalForMongo.__tippyMongoIndexesReady = undefined;
      console.error(`[db] mongodb connect failed: ${err.message}`);
    });
  }
  return globalForMongo.__tippyMongoReady;
}

/** Ensure a connection exists (call from request handlers / services). */
export async function useDb(): Promise<typeof mongoose> {
  return connectMongo();
}

export async function withTransaction<T>(
  fn: (session: DbSession) => Promise<T>,
): Promise<T> {
  await connectMongo();
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function resetDb(): Promise<void> {
  globalForMongo.__tippyMongoReady = undefined;
  globalForMongo.__tippyMongoIndexesReady = undefined;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: number | string }).code === 11000
  );
}

/** Field names from a Mongo duplicate-key (E11000) error, if present. */
export function uniqueViolationFields(err: unknown): string[] {
  if (!isUniqueViolation(err) || typeof err !== 'object' || err === null) {
    return [];
  }

  const keyPattern = (err as { keyPattern?: Record<string, unknown> })
    .keyPattern;
  if (keyPattern && typeof keyPattern === 'object') {
    return Object.keys(keyPattern);
  }

  const message =
    'message' in err && typeof (err as { message?: unknown }).message === 'string'
      ? (err as { message: string }).message
      : '';
  const indexMatch = message.match(/index:\s+[\w.]*?(\w+?)(?:_1|_partial)\b/i);
  if (indexMatch?.[1]) {
    return [indexMatch[1]];
  }
  const dupKeyMatch = message.match(/dup key:\s*\{\s*(\w+)\s*:/i);
  if (dupKeyMatch?.[1]) {
    return [dupKeyMatch[1]];
  }
  return [];
}

export {
  UserModel,
  CreatorProfileModel,
  TipPageViewModel,
  SocialLinkModel,
  PaymentTransactionModel,
  TipModel,
  WebhookEventModel,
  OtpChallengeModel,
  NotificationModel,
  AuditLogModel,
  toPlain,
  toPlainList,
} from './models';

export type * from './types';
