const bcrypt = require("bcryptjs");
const otpModel = require("../models/otp.model");

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const generateAndStore = async (userId) => {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await otpModel.upsertForUser(userId, codeHash, expiresAt);
  return code;
};

const verify = async (userId, code) => {
  const row = await otpModel.findActiveForUser(userId);
  if (!row) return { ok: false, reason: "NO_OTP" };
  if (new Date(row.expires_at) <= new Date()) return { ok: false, reason: "EXPIRED" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "TOO_MANY_ATTEMPTS" };

  const match = await bcrypt.compare(code, row.code_hash);
  if (!match) {
    await otpModel.incrementAttempts(userId);
    return { ok: false, reason: "INVALID" };
  }
  await otpModel.deleteForUser(userId);
  return { ok: true };
};

module.exports = { generateAndStore, verify, OTP_TTL_MINUTES };
