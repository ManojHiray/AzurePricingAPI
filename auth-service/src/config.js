import 'dotenv/config';

function parseDurationToSeconds(input) {
  if (typeof input !== 'string') return Number(input) || 0;
  if (/^\d+$/.test(input)) return parseInt(input, 10);
  const match = input.trim().match(/^(\d+)([smhd])$/i);
  if (!match) return parseInt(input, 10) || 0;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      return value;
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
  accessTokenTtlSeconds: parseDurationToSeconds(process.env.ACCESS_TOKEN_TTL || '900s'),
  refreshTokenTtlSeconds: parseDurationToSeconds(process.env.RECRESH_TOKEN_TTL || process.env.REFRESH_TOKEN_TTL || '30d'),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  cookieSecure: String(process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true',
  allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
};

export { parseDurationToSeconds };