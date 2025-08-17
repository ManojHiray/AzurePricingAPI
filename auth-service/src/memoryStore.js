import crypto from 'crypto';

const refreshTokenByHash = new Map();
const refreshTokenById = new Map();

export function hashToken(plainToken) {
  return crypto.createHash('sha256').update(plainToken).digest('hex');
}

export function generateRandomToken() {
  return crypto.randomBytes(48).toString('hex');
}

export function createRefreshToken(userId, ttlSeconds, metadata = {}) {
  const plainToken = generateRandomToken();
  const tokenHash = hashToken(plainToken);
  const tokenId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const record = {
    tokenId,
    userId,
    tokenHash,
    createdAt: now,
    expiresAt,
    revokedAt: null,
    revocationReason: null,
    replacedByTokenId: null,
    metadata,
  };
  refreshTokenByHash.set(tokenHash, record);
  refreshTokenById.set(tokenId, record);
  return { plainToken, record };
}

export function findByPlainToken(plainToken) {
  if (!plainToken) return null;
  const tokenHash = hashToken(plainToken);
  return refreshTokenByHash.get(tokenHash) || null;
}

export function isActive(record) {
  if (!record) return false;
  if (record.revokedAt) return false;
  return record.expiresAt.getTime() > Date.now();
}

export function revokeRecord(record, reason = 'revoked') {
  if (!record) return;
  if (!record.revokedAt) {
    record.revokedAt = new Date();
    record.revocationReason = reason;
    // Keep mapping to detect token reuse on future requests
  }
}

export function revokeByPlainToken(plainToken, reason = 'revoked') {
  const record = findByPlainToken(plainToken);
  if (record) revokeRecord(record, reason);
  return record;
}

export function revokeChainFrom(record, reason = 'compromised') {
  let current = record;
  while (current) {
    if (!current.revokedAt) revokeRecord(current, reason);
    current = current.replacedByTokenId ? refreshTokenById.get(current.replacedByTokenId) : null;
  }
}

export function rotate(record, userId, ttlSeconds, metadata = {}) {
  revokeRecord(record, 'rotated');
  const { plainToken, record: newRecord } = createRefreshToken(userId, ttlSeconds, metadata);
  record.replacedByTokenId = newRecord.tokenId;
  return { plainToken, newRecord };
}

export function revokeAllForUser(userId) {
  for (const record of refreshTokenById.values()) {
    if (record.userId === userId && !record.revokedAt) {
      revokeRecord(record, 'user_logout');
    }
  }
}