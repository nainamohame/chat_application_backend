const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const env = require("../config/env");

// Send order:
//   1. BREVO_API_KEY  → Brevo HTTPS API   (works on Render; no domain needed — uses verified Gmail sender)
//   2. RESEND_API_KEY → Resend HTTPS API  (works on Render; needs verified domain for arbitrary recipients)
//   3. SMTP_USER+PASS → Nodemailer SMTP   (works locally; most PaaS block SMTP egress)
//   4. nothing        → console log       (dev fallback so register still completes)
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

// Accepts either "user@example.com" or `"Display Name <user@example.com>"`
// and returns an object Brevo's API can consume.
const parseFromHeader = (header) => {
    const s = String(header || "").trim();
    const m = s.match(/^"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    if (m) {
        const name = m[1].trim();
        const email = m[2].trim();
        return name ? { name, email } : { email };
    }
    return { email: s };
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

const sendViaBrevo = async (to, { subject, text, html }) => {
    const sender = parseFromHeader(env.mailFrom);
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": env.brevoApiKey,
            "content-type": "application/json",
            accept: "application/json",
        },
        body: JSON.stringify({
            sender,
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: text,
        }),
    });
    if (!res.ok) {
        let body = "";
        try {
            body = JSON.stringify(await res.json());
        } catch {
            body = await res.text().catch(() => "");
        }
        throw new Error(`Brevo ${res.status}: ${body}`);
    }
};

const sendOtp = async (email, code) => {
    const content = buildEmailContent(code);

    if (env.brevoApiKey) {
        try {
            await sendViaBrevo(email, content);
            console.log(`[email] OTP sent via Brevo to ${email}`);
            return;
        } catch (err) {
            console.error("[email] Brevo send failed", {
                to: email,
                from: env.mailFrom,
                errMessage: err.message,
            });
            throw err;
        }
    }

    const r = getResend();
    if (r) {
        try {
            const result = await r.emails.send({
                from: env.mailFrom,
                to: email,
                subject: content.subject,
                text: content.text,
                html: content.html,
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
            await t.sendMail({
                from: env.smtp.from,
                to: email,
                subject: content.subject,
                text: content.text,
                html: content.html,
            });
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
