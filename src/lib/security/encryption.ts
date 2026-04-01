import crypto from 'crypto';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

export function encrypt(value: string) {
  const secret = getSecret();
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(secret).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2:${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

export function decrypt(payload: string) {
  const secret = getSecret();
  const key = crypto.createHash('sha256').update(secret).digest();
  const parts = payload.split(':');

  if (parts[0] !== 'v2' || parts.length !== 4) {
    throw new Error('Unsupported encryption format — all payloads should be v2 (AES-256-GCM)');
  }

  const [, ivHex, contentHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const content = Buffer.from(contentHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
  return decrypted.toString();
}
