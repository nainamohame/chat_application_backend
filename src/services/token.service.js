const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const refreshTokenModel = require("../models/refreshToken.model");

const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, email: user.email }, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtl,
  });

const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const issueRefreshToken = async (userId) => {
  const token = crypto.randomBytes(64).toString("hex");
  const tokenHash = hashRefreshToken(token);
  const expiresAt = new Date(
    Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000
  );
  await refreshTokenModel.insert(userId, tokenHash, expiresAt);
  return { token, expiresAt };
};

const verifyAndRotateRefresh = async (token) => {
  if (!token) return null;
  const tokenHash = hashRefreshToken(token);
  const row = await refreshTokenModel.findByHash(tokenHash);
  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at) <= new Date()) return null;
  await refreshTokenModel.revokeByHash(tokenHash);
  return { userId: row.user_id };
};

const revokeRefresh = async (token) => {
  if (!token) return;
  await refreshTokenModel.revokeByHash(hashRefreshToken(token));
};

// In production (Vercel frontend + Render backend = different domains) the
// refresh cookie has to be SameSite=None + Secure for the browser to send it
// on cross-site requests. Locally we keep SameSite=Lax so it still works on
// http://localhost without HTTPS.
const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd ? true : env.cookieSecure,
  sameSite: env.isProd ? "none" : "lax",
  path: "/api/auth",
  maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
});

module.exports = {
  signAccessToken,
  issueRefreshToken,
  verifyAndRotateRefresh,
  revokeRefresh,
  refreshCookieOptions,
};
