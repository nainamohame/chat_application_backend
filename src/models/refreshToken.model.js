const pool = require("../config/db");

const insert = async (userId, tokenHash, expiresAt) => {
  await pool.query(
    `INSERT INTO refresh_tokens(user_id, token_hash, expires_at)
     VALUES($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
};

const findByHash = async (tokenHash) => {
  const { rows } = await pool.query(
    "SELECT * FROM refresh_tokens WHERE token_hash = $1",
    [tokenHash]
  );
  return rows[0];
};

const revokeByHash = async (tokenHash) => {
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL",
    [tokenHash]
  );
};

const revokeAllForUser = async (userId) => {
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
    [userId]
  );
};

module.exports = { insert, findByHash, revokeByHash, revokeAllForUser };
