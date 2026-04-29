const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/auth.service");
const tokenService = require("../services/token.service");
const userModel = require("../models/user.model");

const REFRESH_COOKIE = "refresh";

const setRefreshCookie = (res, token) =>
  res.cookie(REFRESH_COOKIE, token, tokenService.refreshCookieOptions());

const clearRefreshCookie = (res) =>
  res.clearCookie(REFRESH_COOKIE, { ...tokenService.refreshCookieOptions(), maxAge: undefined });

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json({ success: true, ...result });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken, user } = await authService.verifyOtp(req.body);
  setRefreshCookie(res, refreshToken);
  res.json({ success: true, accessToken, user });
});

const resendOtp = asyncHandler(async (req, res) => {
  await authService.resendOtp(req.body);
  res.json({ success: true });
});

const login = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken, user } = await authService.login(req.body);
  setRefreshCookie(res, refreshToken);
  res.json({ success: true, accessToken, user });
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies[REFRESH_COOKIE];
  const { accessToken, refreshToken, user } = await authService.refresh(token);
  setRefreshCookie(res, refreshToken);
  res.json({ success: true, accessToken, user });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies[REFRESH_COOKIE];
  await authService.logout(token);
  clearRefreshCookie(res);
  res.json({ success: true });
});

const me = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  res.json({ success: true, user });
});

module.exports = { register, verifyOtp, resendOtp, login, refresh, logout, me };
