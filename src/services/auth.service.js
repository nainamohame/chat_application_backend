const bcrypt = require("bcryptjs");
const HttpError = require("../utils/httpError");
const userModel = require("../models/user.model");
const refreshTokenModel = require("../models/refreshToken.model");
const otpService = require("./otp.service");
const emailService = require("./email.service");
const tokenService = require("./token.service");

const register = async ({ name, email, password }) => {
  const existing = await userModel.findByEmail(email);
  if (existing) {
    if (existing.is_verified) {
      throw new HttpError(409, "Email already registered");
    }
    const code = await otpService.generateAndStore(existing.id);
    await emailService.sendOtp(existing.email, code);
    return { email: existing.email };
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await userModel.createUser(name, email, hash);
  const code = await otpService.generateAndStore(user.id);
  await emailService.sendOtp(user.email, code);
  return { email: user.email };
};

const verifyOtp = async ({ email, code }) => {
  const user = await userModel.findByEmail(email);
  if (!user) throw new HttpError(404, "User not found");
  if (user.is_verified) throw new HttpError(400, "Already verified");

  const result = await otpService.verify(user.id, code);
  if (!result.ok) {
    const map = {
      NO_OTP: [400, "Request a new code"],
      EXPIRED: [400, "Code expired"],
      TOO_MANY_ATTEMPTS: [429, "Too many attempts; request a new code"],
      INVALID: [400, "Invalid code"],
    };
    const [status, message] = map[result.reason] || [400, "Invalid code"];
    throw new HttpError(status, message, result.reason);
  }

  await userModel.markVerified(user.id);
  return issueSession(user);
};

const resendOtp = async ({ email }) => {
  const user = await userModel.findByEmail(email);
  if (!user) throw new HttpError(404, "User not found");
  if (user.is_verified) throw new HttpError(400, "Already verified");
  const code = await otpService.generateAndStore(user.id);
  await emailService.sendOtp(user.email, code);
};

const login = async ({ email, password }) => {
  const user = await userModel.findByEmail(email);
  if (!user) throw new HttpError(401, "Invalid email or password");
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new HttpError(401, "Invalid email or password");
  if (!user.is_verified) throw new HttpError(403, "Email not verified", "NOT_VERIFIED");
  return issueSession(user);
};

const refresh = async (refreshToken) => {
  const result = await tokenService.verifyAndRotateRefresh(refreshToken);
  if (!result) throw new HttpError(401, "Invalid refresh token");
  const user = await userModel.findById(result.userId);
  if (!user) throw new HttpError(401, "Invalid refresh token");
  return issueSession(user);
};

const logout = async (refreshToken) => {
  await tokenService.revokeRefresh(refreshToken);
};

const issueSession = async (user) => {
  const accessToken = tokenService.signAccessToken(user);
  const { token: refreshToken } = await tokenService.issueRefreshToken(user.id);
  return {
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email },
  };
};

module.exports = { register, verifyOtp, resendOtp, login, refresh, logout };
