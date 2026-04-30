const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const env = require("../config/env");

// Three send paths, picked in this order:
//   1. RESEND_API_KEY set     → Resend HTTPS API  (works on Render — port 443, no SMTP block)
//   2. SMTP_USER + SMTP_PASS  → Nodemailer SMTP   (works locally; many PaaS block SMTP egress)
//   3. neither                → console log       (dev fallback so register still completes)
//
// External signature is unchanged: sendOtp(email, code).

let resendClient = null;
let smtpTransporter = null;

const getResend = () => {
    if (resendClient) return resendClient;
    if (!env.resendApiKey) return null;
    resendClient = new Resend(env.resendApiKey);
    return resendClient;
};

// `family: 4` and the long timeouts are kept for environments where SMTP
// IS reachable but Node's default IPv6 routing or default 10 s connection
// timeout is the problem.
const getSmtpTransporter = () => {
    if (smtpTransporter) return smtpTransporter;
    if (!env.smtp.user || !env.smtp.pass) return null;
    smtpTransporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: Number(env.smtp.port),
        secure: env.smtp.port === 465,
        family: 4,
        auth: { user: env.smtp.user, pass: env.smtp.pass },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000,
        tls: { rejectUnauthorized: false },
    });
    return smtpTransporter;
};

const buildEmailContent = (code) => ({
    subject: "Your verification code",
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background:#f8fafc; border-radius: 12px;">
          <h2 style="color: #2563eb; margin-bottom: 8px;">Verify your email</h2>
          <p style="color:#334155;">Use the code below to finish signing up. It expires in 10 minutes.</p>
          <div style="font-size: 32px; letter-spacing: 8px; font-weight: bold; color:#0f172a; background:#fff; padding: 16px 24px; border-radius: 8px; text-align: center; margin: 16px 0; border: 1px solid #e2e8f0;">${code}</div>
          <p style="color:#64748b; font-size: 12px;">If you didn't request this, you can ignore this email.</p>
        </div>`,
});

const sendOtp = async (email, code) => {
    const { subject, text, html } = buildEmailContent(code);

    const r = getResend();
    if (r) {
        try {
            const result = await r.emails.send({
                from: env.mailFrom,
                to: email,
                subject,
                text,
                html,
            });
            if (result.error) {
                throw new Error(result.error.message || JSON.stringify(result.error));
            }
            console.log(`[email] OTP sent via Resend to ${email}`);
            return;
        } catch (err) {
            console.error("[email] Resend send failed", {
                to: email,
                from: env.mailFrom,
                errMessage: err.message,
            });
            throw err;
        }
    }

    const t = getSmtpTransporter();
    if (t) {
        try {
            await t.sendMail({ from: env.smtp.from, to: email, subject, text, html });
            console.log(`[email] OTP sent via SMTP to ${email}`);
            return;
        } catch (err) {
            console.error("[email] SMTP send failed", {
                to: email,
                host: env.smtp.host,
                port: env.smtp.port,
                user: env.smtp.user,
                errCode: err.code,
                errMessage: err.message,
            });
            throw err;
        }
    }

    console.log(`[email.stub] OTP for ${email}: ${code}`);
};

module.exports = { sendOtp };
