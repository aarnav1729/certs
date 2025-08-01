// alter.cjs
require("dotenv").config();
const mysql = require("mysql2/promise");

(async () => {
  const mysqlConfig = {
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "Singhcottage@1729",
    database: process.env.MYSQL_DB || "INVEST",
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
  };

  let pool;
  try {
    pool = await mysql.createPool(mysqlConfig);
    console.log("🔌 Connected to MySQL");
  } catch (err) {
    console.error("⛔ Could not connect to MySQL:", err.message);
    process.exit(1);
  }

  try {
    await pool.execute(`
      ALTER TABLE certifications
        ADD COLUMN material VARCHAR(255) NOT NULL DEFAULT '';
    `);
    console.log("✅ Column 'material' added to 'certifications' table");
  } catch (err) {
    // ER_DUP_FIELDNAME = 1060: column already exists
    if (err.errno === 1060) {
      console.log("⚠️ Column 'material' already exists, skipping");
    } else {
      console.error("⛔ ALTER TABLE failed:", err.message);
      process.exit(1);
    }
  } finally {
    await pool.end();
    console.log("🔒 Connection closed");
  }
})();
