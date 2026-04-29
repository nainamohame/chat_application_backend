const pool = require("../config/db");

const PUBLIC_COLS = "id, name, email, is_verified, created_at";

const createUser = async (name, email, passwordHash) => {
  const { rows } = await pool.query(
    `INSERT INTO users(name, email, password) VALUES($1, $2, $3)
     RETURNING ${PUBLIC_COLS}`,
    [name, email, passwordHash]
  );
  return rows[0];
};

const findByEmail = async (email) => {
  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return rows[0];
};

const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLS} FROM users WHERE id = $1`,
    [id]
  );
  return rows[0];
};

const markVerified = async (id) => {
  await pool.query("UPDATE users SET is_verified = TRUE WHERE id = $1", [id]);
};

const listAllExcept = async (id) => {
  const { rows } = await pool.query(
    `SELECT id, name, email
     FROM users
     WHERE id <> $1 AND is_verified = TRUE
     ORDER BY name ASC`,
    [id]
  );
  return rows;
};

module.exports = { createUser, findByEmail, findById, markVerified, listAllExcept };
