const { Pool } = require("pg");
require("dotenv").config();

// Production (Render + Neon): use DATABASE_URL with SSL.
// Local development: use the discrete DB_HOST/DB_USER/... vars.
const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    })
    : new Pool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
    });

module.exports = pool;
