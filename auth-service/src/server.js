import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { config } from './config.js';
import { findUserByEmail, getUserById, verifyPassword } from './users.js';
import {
  createRefreshToken,
  findByPlainToken,
  isActive,
  revokeByPlainToken,
  revokeChainFrom,
  revokeAllForUser,
  rotate,
} from './memoryStore.js';

const REFRESH_COOKIE_NAME = 'refresh_token';

function buildRefreshCookieOptions() {
  const maxAgeMs = config.refreshTokenTtlSeconds * 1000;
  const sameSite = config.cookieSecure ? 'none' : 'lax';
  return {
    httpOnly: true,
    secure: !!config.cookieSecure,
    sameSite,
    path: '/auth/refresh',
    maxAge: maxAgeMs,
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
  };
}

function signAccessToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };
  const token = jwt.sign(payload, config.jwtAccessSecret, {
    algorithm: 'HS256',
    expiresIn: config.accessTokenTtlSeconds,
    issuer: 'auth-service',
  });
  return token;
}

function authenticateAccessToken(req, res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'missing_bearer_token' });
  const token = match[1];
  try {
    const decoded = jwt.verify(token, config.jwtAccessSecret, { algorithms: ['HS256'], issuer: 'auth-service' });
    const user = getUserById(decoded.sub);
    if (!user) return res.status(401).json({ error: 'user_not_found' });
    res.locals.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.allowedOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

app.post('/auth/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });
  const ok = await verifyPassword(user, password);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  const accessToken = signAccessToken(user);
  const { plainToken } = createRefreshToken(user.id, config.refreshTokenTtlSeconds, { ip: req.ip, ua: req.get('user-agent') || '' });

  res.cookie(REFRESH_COOKIE_NAME, plainToken, buildRefreshCookieOptions());
  return res.json({
    accessToken,
    user: { id: user.id, email: user.email, role: user.role, name: user.name },
    accessTokenExpiresIn: config.accessTokenTtlSeconds,
  });
});

const RefreshSchema = z.object({ refreshToken: z.string().min(10).optional() });

app.post('/auth/refresh', (req, res) => {
  const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME];
  const headerToken = req.get('x-refresh-token');
  const parsed = RefreshSchema.safeParse(req.body || {});
  const bodyToken = parsed.success ? parsed.data.refreshToken : undefined;
  const incomingToken = cookieToken || headerToken || bodyToken;

  if (!incomingToken) return res.status(401).json({ error: 'missing_refresh_token' });
  const record = findByPlainToken(incomingToken);
  if (!record) return res.status(401).json({ error: 'invalid_refresh_token' });

  if (record.revokedAt) {
    revokeChainFrom(record, 'refresh_token_reuse_detected');
    res.clearCookie(REFRESH_COOKIE_NAME, buildRefreshCookieOptions());
    return res.status(401).json({ error: 'refresh_token_reused' });
  }
  if (!isActive(record)) {
    res.clearCookie(REFRESH_COOKIE_NAME, buildRefreshCookieOptions());
    return res.status(401).json({ error: 'refresh_token_expired' });
  }

  const user = getUserById(record.userId);
  if (!user) {
    res.clearCookie(REFRESH_COOKIE_NAME, buildRefreshCookieOptions());
    return res.status(401).json({ error: 'user_not_found' });
  }

  const { plainToken: newRefreshToken } = rotate(record, user.id, config.refreshTokenTtlSeconds, { ip: req.ip, ua: req.get('user-agent') || '' });
  const accessToken = signAccessToken(user);

  res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, buildRefreshCookieOptions());
  return res.json({ accessToken, accessTokenExpiresIn: config.accessTokenTtlSeconds });
});

app.post('/auth/logout', (req, res) => {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) {
    try {
      const decoded = jwt.verify(match[1], config.jwtAccessSecret, { algorithms: ['HS256'], issuer: 'auth-service' });
      const user = getUserById(decoded.sub);
      if (user) {
        revokeAllForUser(user.id);
      }
    } catch (_) {}
  }
  const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (cookieToken) {
    revokeByPlainToken(cookieToken, 'user_logout');
  }
  res.clearCookie(REFRESH_COOKIE_NAME, buildRefreshCookieOptions());
  return res.status(204).end();
});

app.get('/me', authenticateAccessToken, (req, res) => {
  const user = res.locals.user;
  res.json({ user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

app.use((req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.listen(config.port, () => {
  console.log(`auth-service listening on http://localhost:${config.port}`);
});