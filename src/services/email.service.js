const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporter = null;

const getTransporter = () => {
    if (transporter) return transporter;
    if (!env.smtp.user || !env.smtp.pass) return null;
    transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
    return transporter;
};

const sendOtp = async (email, code) => {
    const t = getTransporter();
    if (!t) {
        console.log(`[email.stub] OTP for ${email}: ${code}`);
        return;
    }
    try {
        await t.sendMail({
            from: env.smtp.from,
            to: email,
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
        console.log(`[email] OTP sent to ${email}`);
    } catch (err) {
        console.error(`[email] failed to send OTP to ${email}:`, err.message);
        throw err;
    }
};

module.exports = { sendOtp };
