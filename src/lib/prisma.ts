import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

const nodeEnv = process.env.NODE_ENV as string;
const poolMax = Number(process.env.PG_POOL_MAX ?? (nodeEnv === 'production' ? 35 : nodeEnv === 'staging' ? 25 : 20));
const poolMin = Number(process.env.PG_POOL_MIN ?? (nodeEnv === 'production' ? 8 : nodeEnv === 'staging' ? 5 : 5));
const connectionTimeout = Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? (nodeEnv === 'production' ? 3000 : 5000));
const statementTimeout = Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? (nodeEnv === 'production' ? 30000 : 60000));

function buildUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  const separator = url.includes('?') ? '&' : '?';
  const params = new URLSearchParams({
    connection_limit: String(poolMax),
    min_connection_limit: String(poolMin),
    statement_timeout: String(statementTimeout),
    connection_timeout: String(connectionTimeout)
  });
  if (process.env.NODE_ENV === 'production') {
    params.set('sslmode', 'require');
  }
  return `${url}${separator}${params.toString()}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: buildUrl()
      }
    }
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
