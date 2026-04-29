const pool = require("../config/db");

const upsertForUser = async (userId, codeHash, expiresAt) => {
  await pool.query(
    `INSERT INTO otp_codes(user_id, code_hash, expires_at, attempts)
     VALUES($1, $2, $3, 0)
     ON CONFLICT (user_id) DO UPDATE
       SET code_hash = EXCLUDED.code_hash,
           expires_at = EXCLUDED.expires_at,
           attempts = 0,
           created_at = NOW()`,
    [userId, codeHash, expiresAt]
  );
};

const findActiveForUser = async (userId) => {
  const { rows } = await pool.query(
    "SELECT * FROM otp_codes WHERE user_id = $1",
    [userId]
  );
  return rows[0];
};

const incrementAttempts = async (userId) => {
  await pool.query(
    "UPDATE otp_codes SET attempts = attempts + 1 WHERE user_id = $1",
    [userId]
  );
};

const deleteForUser = async (userId) => {
  await pool.query("DELETE FROM otp_codes WHERE user_id = $1", [userId]);
};

module.exports = { upsertForUser, findActiveForUser, incrementAttempts, deleteForUser };
