require("dotenv").config();
const pool = require("./db");

(async () => {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ DB connected successfully:", result.rows[0]);
    process.exit(0);
  } catch (error) {
    console.error("❌ DB connection failed:", error.message);
    process.exit(1);
  }
})();
