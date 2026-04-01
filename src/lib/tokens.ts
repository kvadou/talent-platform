import crypto from 'crypto';

/** Generate a cryptographically random 64-character hex token */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** One-way SHA-256 hash of a token (for storage/lookup) */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const APPLICATION_TOKEN_TTL_DAYS = (() => {
  const val = Number(process.env.APPLICATION_TOKEN_TTL_DAYS ?? 60);
  if (isNaN(val) || val < 1) throw new Error('APPLICATION_TOKEN_TTL_DAYS must be a positive number');
  return val;
})();

export function applicationTokenExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + APPLICATION_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function isTokenExpired(createdAt: Date, expiresAt?: Date | null): boolean {
  if (expiresAt) return expiresAt <= new Date();
  const legacyExpiry = applicationTokenExpiresAt(createdAt);
  return legacyExpiry <= new Date();
}
