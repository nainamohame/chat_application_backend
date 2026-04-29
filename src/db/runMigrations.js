require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

(async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name       VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const applied = (await client.query("SELECT name FROM _migrations")).rows.map(
      (r) => r.name
    );

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql") || f.endsWith(".js"))
      .sort();

    for (const file of files) {
      if (applied.includes(file)) {
        console.log(`✓ skip ${file}`);
        continue;
      }
      const fullPath = path.join(MIGRATIONS_DIR, file);
      await client.query("BEGIN");
      try {
        if (file.endsWith(".sql")) {
          const sql = fs.readFileSync(fullPath, "utf8");
          await client.query(sql);
        } else {
          const fn = require(fullPath);
          if (typeof fn !== "function") {
            throw new Error(`${file} must export a function (client) => Promise<void>`);
          }
          await fn(client);
        }
        await client.query("INSERT INTO _migrations(name) VALUES($1)", [file]);
        await client.query("COMMIT");
        console.log(`✅ applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("Migrations done.");
    process.exit(0);
  } catch (err) {
    console.error("❌ migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
  }
})();
