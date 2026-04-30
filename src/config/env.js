require("dotenv").config();

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
};

module.exports = {
  port: parseInt(process.env.PORT || "5000", 10),
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshTokenTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "7", 10),
  clientOrigin: (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  cookieSecure: process.env.COOKIE_SECURE === "true",
  isProd: process.env.NODE_ENV === "production",
  // Brevo HTTPS API — used in production when no custom domain is available
  // (Brevo allows single-sender verification with a plain Gmail address).
  brevoApiKey: process.env.BREVO_API_KEY || "",
  // Resend HTTPS API — used in production (Render blocks outbound SMTP).
  resendApiKey: process.env.RESEND_API_KEY || "",
  // Sender for both Resend and SMTP. For Resend testing without a verified
  // domain, use "onboarding@resend.dev" (emails only deliver to the account
  // owner's address). For production, verify a domain in Resend and set
  // MAIL_FROM=YourApp <noreply@yourdomain.com>.
  mailFrom:
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM ||
    "Chat App <onboarding@resend.dev>",
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: (process.env.SMTP_PASS || "").replace(/\s+/g, ""),
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
  },
};
