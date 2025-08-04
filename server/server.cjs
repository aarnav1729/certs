// server/server.cjs

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
const mysql = require("mysql2/promise");
const mssql = require("mssql");

const fs = require("fs");
const path = require("path");
const https = require("https");

const { Client } = require("@microsoft/microsoft-graph-client");
const { ClientSecretCredential } = require("@azure/identity");
require("isomorphic-fetch");

const CLIENT_ID = "3d310826-2173-44e5-b9a2-b21e940b67f7";
const TENANT_ID = "1c3de7f3-f8d1-41d3-8583-2517cf3ba3b1";
const CLIENT_SECRET = "2e78Q~yX92LfwTTOg4EYBjNQrXrZ2z5di1Kvebog";
const SENDER_EMAIL = "spot@premierenergies.com";

const credential = new ClientSecretCredential(
  TENANT_ID,
  CLIENT_ID,
  CLIENT_SECRET
);
const graphClient = Client.initWithMiddleware({
  authProvider: {
    getAccessToken: () =>
      credential
        .getToken("https://graph.microsoft.com/.default")
        .then((t) => t.token),
  },
});

async function sendEmail(to, subject, html) {
  try {
    await graphClient.api(`/users/${SENDER_EMAIL}/sendMail`).post({
      message: {
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: "true",
    });
  } catch (err) {
    console.error("Failed to send email to", to, err);
  }
}

// --- MySQL CONFIGURATION ---
const mysqlConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "Singhcottage@1729",
  database: process.env.MYSQL_DB || "INVEST",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// --- MSSQL CONFIGURATION ---
const mssqlConfig = {
  user: process.env.MSSQL_USER || "SPOT_USER",
  password: process.env.MSSQL_PASSWORD || "Marvik#72@",
  server: process.env.MSSQL_SERVER || "10.0.40.10",
  port: Number(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DB || "certifypro",
  options: {
    trustServerCertificate: true,
    encrypt: false,
    connectionTimeout: 60000,
  },
};
let mssqlPool;

// Create an “init” pool to ensure the database exists, then a real pool
let initPool, pool;
(async () => {
  try {
    initPool = await mysql.createPool({ ...mysqlConfig, database: undefined });
    await initPool.query(
      `CREATE DATABASE IF NOT EXISTS \`${mysqlConfig.database}\`;`
    );
    pool = await mysql.createPool(mysqlConfig);
    console.log("🔌 Connected to MySQL");
    await initDb();
    console.log("✅ All tables & columns are in place");

    // --- parallel MSSQL init ---
    try {
      mssqlPool = await mssql.connect(mssqlConfig);
      console.log("🔌 Connected to MSSQL");
    } catch (err) {
      console.error("⚠️  MSSQL connection failed, continuing MySQL-only:", err);
    }
  } catch (err) {
    console.error("⛔ DB initialization failed", err);
    process.exit(1);
  }
})();

// --- SCHEMA INITIALIZATION ---
async function initDb() {
  // 1. certifications table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS certifications (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      project_name            VARCHAR(255) NOT NULL,
      project_details         TEXT         NOT NULL,
      material VARCHAR(255) NOT NULL DEFAULT '',
      testing_laboratory      VARCHAR(255) NOT NULL,
      testing_approved_by     VARCHAR(255),
      status                  VARCHAR(50)  NOT NULL DEFAULT 'Not Started Yet',
      due_date                DATE         NOT NULL,
      last_updated_on         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      remarks                 TEXT         NOT NULL,
      paid_for_by             VARCHAR(50)  NOT NULL,
      currency                VARCHAR(10)  NOT NULL,
      amount                  DECIMAL(18,2),
      supplier_name           VARCHAR(255),
      supplier_amount         DECIMAL(18,2),
      premier_amount          DECIMAL(18,2),
      customization_customer_name VARCHAR(255),
      customization_comments  TEXT,
      sample_quantity         INT,
      certification_type      VARCHAR(50)  NOT NULL,
      created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. auxiliary tables
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS certification_product_types (
      certification_id INT NOT NULL,
      product_type     VARCHAR(255) NOT NULL,
      INDEX(certification_id),
      FOREIGN KEY(certification_id) REFERENCES certifications(id) ON DELETE CASCADE
    );
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS certification_material_categories (
      certification_id  INT NOT NULL,
      material_category VARCHAR(255) NOT NULL,
      INDEX(certification_id),
      FOREIGN KEY(certification_id) REFERENCES certifications(id) ON DELETE CASCADE
    );
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS certification_production_lines (
      certification_id INT NOT NULL,
      production_line  VARCHAR(255) NOT NULL,
      INDEX(certification_id),
      FOREIGN KEY(certification_id) REFERENCES certifications(id) ON DELETE CASCADE
    );
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS due_date_history (
      certification_id INT NOT NULL,
      previous_date    DATE         NOT NULL,
      new_date         DATE         NOT NULL,
      changed_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX(certification_id),
      FOREIGN KEY(certification_id) REFERENCES certifications(id) ON DELETE CASCADE
    );
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS uploads (
      id                CHAR(36) NOT NULL PRIMARY KEY,
      certification_id  INT      NOT NULL,
      name              VARCHAR(255) NOT NULL,
      data              LONGTEXT NOT NULL,
      type              VARCHAR(100) NOT NULL,
      is_invoice        TINYINT(1) NOT NULL DEFAULT 0,
      INDEX(certification_id),
      FOREIGN KEY(certification_id) REFERENCES certifications(id) ON DELETE CASCADE
    );
  `);

  /// 3. approval-stage columns (drop the IF NOT EXISTS here)
  const approvalCols = [
    `ADD COLUMN technical_head_status  VARCHAR(20)  NOT NULL DEFAULT 'Pending'`,
    `ADD COLUMN technical_head_comment TEXT`,
    `ADD COLUMN technical_head_at      DATETIME`,

    `ADD COLUMN plant_head_status      VARCHAR(20)  NOT NULL DEFAULT 'Pending'`,
    `ADD COLUMN plant_head_comment     TEXT`,
    `ADD COLUMN plant_head_at          DATETIME`,

    `ADD COLUMN director_status        VARCHAR(20)  NOT NULL DEFAULT 'Pending'`,
    `ADD COLUMN director_comment       TEXT`,
    `ADD COLUMN director_at            DATETIME`,

    `ADD COLUMN coo_status             VARCHAR(20)  NOT NULL DEFAULT 'Pending'`,
    `ADD COLUMN coo_comment            TEXT`,
    `ADD COLUMN coo_at                 DATETIME`,
  ];

  for (let stmt of approvalCols) {
    try {
      await pool.execute(`ALTER TABLE certifications ${stmt};`);
    } catch (err) {
      // 1060 = ER_DUP_FIELDNAME (column already exists) → ignore
      if (err.errno !== 1060) throw err;
    }
  }

  // --- Mirror schema into MSSQL if connected ---
  if (mssqlPool) {
    const run = async (sql) => {
      try {
        await mssqlPool.request().batch(sql);
      } catch (_) {
        /* ignore already-exists or syntax errors */
      }
    };

    // 1. certifications
    await run(`
     IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[certifications]') AND type in (N'U'))
     CREATE TABLE dbo.certifications (
       id INT IDENTITY(1,1) PRIMARY KEY,
       project_name            VARCHAR(255) NOT NULL,
       project_details         TEXT         NOT NULL,
       material                VARCHAR(255) NOT NULL DEFAULT '',
       testing_laboratory      VARCHAR(255) NOT NULL,
       testing_approved_by     VARCHAR(255) NULL,
       status                  VARCHAR(50)  NOT NULL DEFAULT 'Not Started Yet',
       due_date                DATE         NOT NULL,
       last_updated_on         DATETIME     NOT NULL DEFAULT GETDATE(),
       remarks                 TEXT         NOT NULL,
       paid_for_by             VARCHAR(50)  NOT NULL,
       currency                VARCHAR(10)  NOT NULL,
       amount                  DECIMAL(18,2) NULL,
       supplier_name           VARCHAR(255) NULL,
       supplier_amount         DECIMAL(18,2) NULL,
       premier_amount          DECIMAL(18,2) NULL,
       customization_customer_name VARCHAR(255) NULL,
       customization_comments  TEXT         NULL,
       sample_quantity         INT          NULL,
       certification_type      VARCHAR(50)  NOT NULL,
       created_at              DATETIME     NOT NULL DEFAULT GETDATE()
     );
   `);

    // 2. certification_product_types
    await run(`
     IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[certification_product_types]') AND type in (N'U'))
     CREATE TABLE dbo.certification_product_types (
       certification_id INT NOT NULL,
       product_type     VARCHAR(255) NOT NULL,
       FOREIGN KEY(certification_id) REFERENCES dbo.certifications(id) ON DELETE CASCADE
     );
   `);

    // 3. certification_material_categories
    await run(`
     IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[certification_material_categories]') AND type in (N'U'))
     CREATE TABLE dbo.certification_material_categories (
       certification_id  INT NOT NULL,
       material_category VARCHAR(255) NOT NULL,
       FOREIGN KEY(certification_id) REFERENCES dbo.certifications(id) ON DELETE CASCADE
     );
   `);

    // 4. certification_production_lines
    await run(`
     IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[certification_production_lines]') AND type in (N'U'))
     CREATE TABLE dbo.certification_production_lines (
       certification_id INT NOT NULL,
       production_line  VARCHAR(255) NOT NULL,
       FOREIGN KEY(certification_id) REFERENCES dbo.certifications(id) ON DELETE CASCADE
     );
   `);

    // 5. due_date_history
    await run(`
     IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[due_date_history]') AND type in (N'U'))
     CREATE TABLE dbo.due_date_history (
       certification_id INT NOT NULL,
       previous_date    DATE         NOT NULL,
       new_date         DATE         NOT NULL,
       changed_at       DATETIME     NOT NULL DEFAULT GETDATE(),
       FOREIGN KEY(certification_id) REFERENCES dbo.certifications(id) ON DELETE CASCADE
     );
   `);

    // 6. uploads
    await run(`
     IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[uploads]') AND type in (N'U'))
     CREATE TABLE dbo.uploads (
       id                CHAR(36) NOT NULL PRIMARY KEY,
       certification_id  INT      NOT NULL,
       name              VARCHAR(255) NOT NULL,
       data              TEXT     NOT NULL,
       type              VARCHAR(100) NOT NULL,
       is_invoice        BIT      NOT NULL DEFAULT 0,
       FOREIGN KEY(certification_id) REFERENCES dbo.certifications(id) ON DELETE CASCADE
     );
   `);
  }
}

// --- APP SETUP ---
const app = express();

// —– Hard-coded users —–
const users = [
  { username: "praful", password: "praful", role: "Requestor", name: "Praful" },
  {
    username: "baskara",
    password: "baskara",
    role: "TechnicalHead",
    name: "Baskara",
  },
  { username: "cmk", password: "cmk", role: "PlantHead", name: "CMK" },
  {
    username: "jasveen",
    password: "jasveen",
    role: "Director",
    name: "Jaasveen",
  },
  { username: "vishnu", password: "vishnu", role: "COO", name: "Vishnu" },
  { username: "aarnav", password: "aarnav", role: "Admin", name: "Aarnav" },
];

// —– MIDDLEWARES —–
app.use(helmet());
app.use(cors({ origin: "http://localhost:8080", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("combined"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "replace_this_in_prod",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 },
  })
);

// —– AUTH GUARD —–
function requireAuth(req, res, next) {
  if (!req.session.user)
    return res.status(401).json({ message: "Unauthorized" });
  next();
}

// —– LOGIN / LOGOUT —–
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password
  );
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  req.session.user = {
    username: user.username,
    role: user.role,
    name: user.name,
  };
  res.json(req.session.user);
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error(err);
    res.json({ message: "Logged out" });
  });
});

// Provide session info to the client so AuthContext can hydrate.
app.get("/api/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  res.json(req.session.user);
});

// —– PROTECT ALL /api ROUTES —–
app.use("/api", requireAuth);

// --- CRUD: LIST ALL CERTIFICATIONS ---
app.get("/api/certifications", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        id          AS serialNumber,
        project_name        AS projectName,
        project_details     AS projectDetails,
        material AS material,
        testing_laboratory  AS testingLaboratory,
        testing_approved_by AS testingApprovedBy,
        status,
        DATE_FORMAT(due_date, '%Y-%m-%d')          AS dueDate,
        last_updated_on                           AS lastUpdatedOn,
        remarks,
        paid_for_by                               AS paidForBy,
        currency,
        amount,
        supplier_name                             AS supplierName,
        supplier_amount                           AS supplierAmount,
        premier_amount                            AS premierAmount,
        customization_customer_name               AS customerName,
        customization_comments                    AS comments,
        sample_quantity                           AS sampleQuantity,
        certification_type                        AS certificationType,
        technical_head_status   AS technicalHeadStatus,
        technical_head_comment  AS technicalHeadComment,
        technical_head_at       AS technicalHeadAt,
        plant_head_status       AS plantHeadStatus,
        plant_head_comment      AS plantHeadComment,
        plant_head_at           AS plantHeadAt,
        director_status         AS directorStatus,
        director_comment        AS directorComment,
        director_at             AS directorAt,
        coo_status              AS cooStatus,
        coo_comment             AS cooComment,
        coo_at                  AS cooAt,
        DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt
      FROM certifications
      ORDER BY id;
    `);

    const results = [];
    for (let row of rows) {
      const id = row.id;
      // fetch arrays
      const [pt] = await pool.query(
        "SELECT product_type FROM certification_product_types WHERE certification_id=?",
        [id]
      );
      const [mc] = await pool.query(
        "SELECT material_category FROM certification_material_categories WHERE certification_id=?",
        [id]
      );
      const [pl] = await pool.query(
        "SELECT production_line FROM certification_production_lines WHERE certification_id=?",
        [id]
      );
      const [dh] = await pool.query(
        `SELECT
           DATE_FORMAT(previous_date, '%Y-%m-%d') AS previousDate,
           DATE_FORMAT(new_date,      '%Y-%m-%d') AS newDate,
           changed_at                 AS changedAt
         FROM due_date_history
         WHERE certification_id=?
         ORDER BY changed_at`,
        [id]
      );
      const [ups] = await pool.query(
        "SELECT id, name, data, type FROM uploads WHERE certification_id=? AND is_invoice=0",
        [id]
      );
      const [inv] = await pool.query(
        "SELECT id, name, data, type FROM uploads WHERE certification_id=? AND is_invoice=1",
        [id]
      );

      results.push({
        ...row,
        productType: pt.map((r) => r.product_type),
        materialCategories: mc.map((r) => r.material_category),
        productionLine: pl.map((r) => r.production_line),
        dueDateHistory: dh,
        uploads: ups,
        paymentInfo: {
          paidForBy: row.paidForBy,
          currency: row.currency,
          amount: row.amount,
          supplierName: row.supplierName,
          supplierAmount: row.supplierAmount,
          premierAmount: row.premierAmount,
          invoiceAttachment: inv[0] || null,
        },
      });
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// --- APPROVAL ENDPOINT WITH EMAIL NOTIFICATIONS ---
app.post("/api/certifications/:id/approve", requireAuth, async (req, res) => {
  try {
    const certId = Number(req.params.id);
    if (Number.isNaN(certId)) {
      return res.status(400).json({ message: "Invalid certification ID" });
    }

    const { action, comment } = req.body;
    // Only these two are allowed
    if (!["Approved", "Rejected"].includes(action)) {
      return res
        .status(400)
        .json({ message: "Action must be 'Approved' or 'Rejected'" });
    }

    const role = req.session.user.role;
    // Map session role to column prefix
    const stageMap = {
      TechnicalHead: "technical_head",
      PlantHead: "plant_head",
      Director: "director",
      COO: "coo",
    };
    const stageKey = stageMap[role];
    if (!stageKey) {
      return res
        .status(403)
        .json({ message: "Your role is not permitted to approve" });
    }

    // Build column names
    const statusCol = `${stageKey}_status`;
    const commentCol = `${stageKey}_comment`;
    const atCol = `${stageKey}_at`;

    // Perform the update
    await pool.execute(
      `UPDATE certifications
         SET ${statusCol} = ?,
             ${commentCol} = ?,
             ${atCol}      = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [action, comment || null, certId]
    );

    // MSSQL update fallback
    if (mssqlPool) {
      try {
        await mssqlPool
          .request()
          .input("action", mssql.VarChar(20), action)
          .input("comment", mssql.Text, comment || null)
          .input("id", mssql.Int, certId).query(`
           UPDATE dbo.certifications
             SET ${statusCol} = @action,
                 ${commentCol} = @comment,
                 ${atCol}      = GETDATE()
           WHERE id = @id
         `);
      } catch (e) {
        console.error("⚠️ MSSQL UPDATE failed:", e);
      }
    }

    // Re-fetch the updated row + all its related arrays
    const [[row]] = await pool.query(
      `SELECT
         id,
         id                         AS serialNumber,
         project_name               AS projectName,
         project_details            AS projectDetails,
         material                   AS material,
         testing_laboratory         AS testingLaboratory,
         testing_approved_by        AS testingApprovedBy,
         status,
         DATE_FORMAT(due_date, '%Y-%m-%d') AS dueDate,
         last_updated_on            AS lastUpdatedOn,
         remarks,
         paid_for_by                AS paidForBy,
         currency,
         amount,
         supplier_name              AS supplierName,
         supplier_amount            AS supplierAmount,
         premier_amount             AS premiereAmount,
         customization_customer_name AS customerName,
         customization_comments     AS comments,
         sample_quantity            AS sampleQuantity,
         certification_type         AS certificationType,
         technical_head_status      AS technicalHeadStatus,
         technical_head_comment     AS technicalHeadComment,
         technical_head_at          AS technicalHeadAt,
         plant_head_status          AS plantHeadStatus,
         plant_head_comment         AS plantHeadComment,
         plant_head_at              AS plantHeadAt,
         director_status            AS directorStatus,
         director_comment           AS directorComment,
         director_at                AS directorAt,
         coo_status                 AS cooStatus,
         coo_comment                AS cooComment,
         coo_at                     AS cooAt,
         DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt
       FROM certifications
       WHERE id = ?`,
      [certId]
    );
    if (!row) {
      return res.status(404).json({ message: "Certification not found" });
    }

    // load all array fields in parallel
    const [[pt], [mc], [pl], [dh], [ups], [inv]] = await Promise.all([
      pool.query(
        `SELECT product_type FROM certification_product_types WHERE certification_id=?`,
        [certId]
      ),
      pool.query(
        `SELECT material_category FROM certification_material_categories WHERE certification_id=?`,
        [certId]
      ),
      pool.query(
        `SELECT production_line FROM certification_production_lines WHERE certification_id=?`,
        [certId]
      ),
      pool.query(
        `SELECT
           DATE_FORMAT(previous_date, '%Y-%m-%d') AS previousDate,
           DATE_FORMAT(new_date,      '%Y-%m-%d') AS newDate,
           changed_at                 AS changedAt
         FROM due_date_history
         WHERE certification_id=?
         ORDER BY changed_at`,
        [certId]
      ),
      pool.query(
        `SELECT id, name, data, type
         FROM uploads
         WHERE certification_id=? AND is_invoice=0`,
        [certId]
      ),
      pool.query(
        `SELECT id, name, data, type
         FROM uploads
         WHERE certification_id=? AND is_invoice=1`,
        [certId]
      ),
    ]);

    // assemble full object
    const updatedCert = {
      ...row,
      productType: pt.map((r) => r.product_type),
      materialCategories: mc.map((r) => r.material_category),
      productionLine: pl.map((r) => r.production_line),
      dueDateHistory: dh,
      uploads: ups,
      paymentInfo: {
        paidForBy: row.paidForBy,
        currency: row.currency,
        amount: row.amount,
        supplierName: row.supplierName,
        supplierAmount: row.supplierAmount,
        premierAmount: row.premierAmount,
        invoiceAttachment: inv[0] || null,
      },
    };

    // Now send notification email
    let to;
    let subject;
    let html;

    const headerBanner = `
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0078D4; padding:20px 0;">
    <tr>
      <td align="center">
        <h1 style="color:#fff; margin:0; font-size:24px;">✉️ Certification Update</h1>
      </td>
    </tr>
  </table>
`;

    const detailsTable = (id, name, due) => `
  <table cellpadding="10" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; background-color:#fff; margin-top:15px;">
    <tr style="background-color:#0078D4; color:#fff;">
      <th align="left">Field</th><th align="left">Value</th>
    </tr>
    <tr><td><strong>ID</strong></td><td>${id}</td></tr>
    <tr style="background-color:#f4f4f4;"><td><strong>Project Name</strong></td><td>${name}</td></tr>
    <tr><td><strong>Due Date</strong></td><td>${due}</td></tr>
  </table>
`;

    if (action === "Rejected") {
      // 🎯 Notify the Requestor on any rejection
      to = "aarnav.singh@premierenergies.com";
      subject = `Certification Request #${certId} Rejected by ${req.session.user.name}`;
      html = `
    <div style="font-family:Arial,sans-serif; color:#333; line-height:1.4;">
      ${headerBanner}
      <div style="padding:20px; background-color:#f9f9f9; max-width:600px; margin:0 auto;">
        <p style="font-size:16px;">Hello <strong>Praful</strong>,</p>
        <p style="font-size:14px;">
          Your certification request <strong>#${certId}</strong> (${
        row.projectName
      }) has been <span style="color:#D32F2F;font-weight:bold;">rejected</span> by <strong>${
        req.session.user.name
      }</strong>.
        </p>
        <p style="font-size:14px;"><strong>Comments:</strong> ${
          comment || "No comment provided."
        }</p>
        ${detailsTable(certId, row.projectName, row.dueDate)}
        <p style="font-size:14px; margin-top:20px;">Please address the comments and resubmit if appropriate: <a href="https://certifypro.premierenergies.com:12443/" style="color:#0078D4; text-decoration:none;">Create New Request</a></p>
        <p style="font-size:14px; margin-bottom:30px;">We’re here to help if you need any assistance.</p>
        <p style="font-size:14px; margin:0;">
          Thanks &amp; Regards,<br/>
          Team CertifyPro
        </p>
      </div>
    </div>
  `;
    } else {
      // ✅ Approved → notify the next stage
      switch (role) {
        case "TechnicalHead":
          to = "aarnav.singh@premierenergies.com";
          subject = `Certification Request #${certId} Approved by Technical Head`;
          html = `
        <div style="font-family:Arial,sans-serif; color:#333; line-height:1.4;">
          ${headerBanner}
          <div style="padding:20px; background-color:#f9f9f9; max-width:600px; margin:0 auto;">
            <p style="font-size:16px;">Hello <strong>Chandramauli Sir</strong>,</p>
            <p style="font-size:14px;">
              Certification request <strong>#${certId}</strong> (${
            row.projectName
          }) has been <span style="color:#388E3C;font-weight:bold;">approved</span> by <strong>Baskara Sir</strong>.
            </p>
            ${detailsTable(certId, row.projectName, row.dueDate)}
            <p style="font-size:14px; margin-top:20px;">Please review it at your earliest convenience.</p>
            <p style="font-size:14px; margin-bottom:30px;">Your prompt action is appreciated: <a href="https://certifypro.premierenergies.com:12443/" style="color:#0078D4; text-decoration:none;">View Request</a></p>
            <p style="font-size:14px; margin:0;">
              Thanks &amp; Regards,<br/>
              Team CertifyPro
            </p>
          </div>
        </div>
      `;
          break;

        case "PlantHead":
          to = "aarnav.singh@premierenergies.com";
          subject = `Certification Request #${certId} Approved by Plant Head`;
          html = `
        <div style="font-family:Arial,sans-serif; color:#333; line-height:1.4;">
          ${headerBanner}
          <div style="padding:20px; background-color:#f9f9f9; max-width:600px; margin:0 auto;">
            <p style="font-size:16px;">Hello <strong>Jasveen Ma'am</strong>,</p>
            <p style="font-size:14px;">
              Certification request <strong>#${certId}</strong> (${
            row.projectName
          }) has been <span style="color:#388E3C;font-weight:bold;">approved</span> by <strong>Chandramauli Sir</strong>.
            </p>
            ${detailsTable(certId, row.projectName, row.dueDate)}
            <p style="font-size:14px; margin-top:20px;">Please review it at your earliest convenience.</p>
            <p style="font-size:14px; margin-bottom:30px;">Your prompt action is appreciated: <a href="https://certifypro.premierenergies.com:12443/" style="color:#0078D4; text-decoration:none;">View Request</a></p>
            <p style="font-size:14px; margin:0;">
              Thanks &amp; Regards,<br/>
              Team CertifyPro
            </p>
          </div>
        </div>
      `;
          break;

        case "Director":
          to = "aarnav.singh@premierenergies.com";
          subject = `Certification Request #${certId} Approved by Director`;
          html = `
        <div style="font-family:Arial,sans-serif; color:#333; line-height:1.4;">
          ${headerBanner}
          <div style="padding:20px; background-color:#f9f9f9; max-width:600px; margin:0 auto;">
            <p style="font-size:16px;">Hello <strong>Vishnu Sir</strong>,</p>
            <p style="font-size:14px;">
              Certification request <strong>#${certId}</strong> (${
            row.projectName
          }) has been <span style="color:#388E3C;font-weight:bold;">approved</span> by <strong>Jasveen Ma’am</strong>.
            </p>
            ${detailsTable(certId, row.projectName, row.dueDate)}
            <p style="font-size:14px; margin-top:20px;">Please review it at your earliest convenience.</p>
            <p style="font-size:14px; margin-bottom:30px;">Your prompt action is appreciated: <a href="https://certifypro.premierenergies.com:12443/" style="color:#0078D4; text-decoration:none;">View Request</a></p>
            <p style="font-size:14px; margin:0;">
              Thanks &amp; Regards,<br/>
              Team CertifyPro
            </p>
          </div>
        </div>
      `;
          break;

        case "COO":
          to = "aarnav.singh@premierenergies.com";
          subject = `Certification Request #${certId} Fully Approved`;
          html = `
        <div style="font-family:Arial,sans-serif; color:#333; line-height:1.4;">
          ${headerBanner}
          <div style="padding:20px; background-color:#f9f9f9; max-width:600px; margin:0 auto;">
            <p style="font-size:16px;">Hello <strong>Praful</strong>,</p>
            <p style="font-size:14px;">
              Your certification request <strong>#${certId}</strong> (${
            row.projectName
          }) has been <span style="color:#388E3C;font-weight:bold;">approved</span> by <strong>Vishnu Sir (COO)</strong>. Congratulations – it is now fully approved!
            </p>
            ${detailsTable(certId, row.projectName, row.dueDate)}
            <p style="font-size:14px; margin-top:20px;">You may now proceed to the next steps.</p>
            <p style="font-size:14px; margin-bottom:30px;">Thank you for your collaboration.</p>
            <p style="font-size:14px; margin:0;">
              Thanks &amp; Regards,<br/>
              Team CertifyPro
            </p>
          </div>
        </div>
      `;
          break;
      }
    }
    // send the email
    await sendEmail(to, subject, html);

    // finally, return the updated certification object
    return res.json(updatedCert);
  } catch (err) {
    console.error("Approval endpoint error:", err);
    return res.status(500).json({ message: "Server Error" });
  }
});

// --- GET ONE ---
app.get("/api/certifications/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [[row]] = await pool.query(
      `SELECT
         *
       FROM certifications
       WHERE id=?`,
      [id]
    );
    if (!row) return res.status(404).json({ message: "Not found" });

    // fetch arrays as above
    const [pt] = await pool.query(
      "SELECT product_type FROM certification_product_types WHERE certification_id=?",
      [id]
    );
    const [mc] = await pool.query(
      "SELECT material_category FROM certification_material_categories WHERE certification_id=?",
      [id]
    );
    const [pl] = await pool.query(
      "SELECT production_line FROM certification_production_lines WHERE certification_id=?",
      [id]
    );
    const [dh] = await pool.query(
      `SELECT
         DATE_FORMAT(previous_date, '%Y-%m-%d') AS previousDate,
         DATE_FORMAT(new_date,      '%Y-%m-%d') AS newDate,
         changed_at                 AS changedAt
       FROM due_date_history
       WHERE certification_id=?
       ORDER BY changed_at`,
      [id]
    );
    const [ups] = await pool.query(
      "SELECT id, name, data, type FROM uploads WHERE certification_id=? AND is_invoice=0",
      [id]
    );
    const [inv] = await pool.query(
      "SELECT id, name, data, type FROM uploads WHERE certification_id=? AND is_invoice=1",
      [id]
    );

    res.json({
      ...row,
      serialNumber: row.id,
      dueDate: row.due_date.toISOString().slice(0, 10),
      createdAt: row.created_at.toISOString(),
      lastUpdatedOn: row.last_updated_on,
      productType: pt.map((r) => r.product_type),
      materialCategories: mc.map((r) => r.material_category),
      productionLine: pl.map((r) => r.production_line),
      dueDateHistory: dh,
      uploads: ups,
      paymentInfo: {
        paidForBy: row.paid_for_by,
        currency: row.currency,
        amount: row.amount,
        supplierName: row.supplier_name,
        supplierAmount: row.supplier_amount,
        premierAmount: row.premier_amount,
        invoiceAttachment: inv[0] || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// --- CREATE ---
app.post("/api/certifications", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Destructure incoming data
    const {
      projectName,
      projectDetails,
      material,
      testingLaboratory,
      testingApprovedBy,
      status,
      dueDate,
      remarks,
      paymentInfo,
      sampleQuantity,
      certificationType,
      customizationInfo,
      productType,
      materialCategories,
      productionLine,
      dueDateHistory,
      uploads,
    } = req.body;

    // Validate required fields
    if (
      !projectName ||
      !material ||
      !testingLaboratory ||
      !status ||
      !dueDate ||
      !Array.isArray(productType) ||
      productType.length === 0 ||
      !Array.isArray(materialCategories) ||
      materialCategories.length === 0
    ) {
      await conn.rollback();
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Convert undefined → null for optional columns
    const approvedByVal = testingApprovedBy ?? null;
    const remarksVal = remarks ?? "";
    const paidForByVal = paymentInfo?.paidForBy ?? null;
    const currencyVal = paymentInfo?.currency ?? null;
    const amountVal = paymentInfo?.amount ?? null;
    const supplierNameVal = paymentInfo?.supplierName ?? null;
    const supplierAmountVal = paymentInfo?.supplierAmount ?? null;
    const premierAmountVal = paymentInfo?.premierAmount ?? null;
    const invoiceAttachment = paymentInfo?.invoiceAttachment ?? null;
    const customerNameVal = customizationInfo?.customerName ?? null;
    const customerCommentsVal = customizationInfo?.comments ?? null;
    const sampleQuantityVal = sampleQuantity ?? null;

    // Insert main certification record
    const [result] = await conn.execute(
      `INSERT INTO certifications
          (project_name,
           project_details,
           material,
           testing_laboratory,
           testing_approved_by,
           status,
           due_date,
           remarks,
           paid_for_by,
           currency,
           amount,
           supplier_name,
           supplier_amount,
           premier_amount,
           customization_customer_name,
           customization_comments,
           sample_quantity,
           certification_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectName,
        projectDetails ?? "",
        material,
        testingLaboratory,
        approvedByVal,
        status,
        dueDate,
        remarksVal,
        paidForByVal,
        currencyVal,
        amountVal,
        supplierNameVal,
        supplierAmountVal,
        premierAmountVal,
        customerNameVal,
        customerCommentsVal,
        sampleQuantityVal,
        certificationType,
      ]
    );
    const certId = result.insertId;

    // MSSQL fallback for main INSERT
    if (mssqlPool) {
      try {
        await mssqlPool
          .request()
          .input("projectName", mssql.VarChar(255), projectName)
          .input("projectDetails", mssql.Text, projectDetails ?? "")
          .input("material", mssql.VarChar(255), material)
          .input("testing_laboratory", mssql.VarChar(255), testingLaboratory)
          .input("testing_approved_by", mssql.VarChar(255), approvedByVal)
          .input("status", mssql.VarChar(50), status)
          .input("due_date", mssql.Date, dueDate)
          .input("remarks", mssql.Text, remarksVal)
          .input("paid_for_by", mssql.VarChar(50), paidForByVal)
          .input("currency", mssql.VarChar(10), currencyVal)
          .input("amount", mssql.Decimal(18, 2), amountVal)
          .input("supplier_name", mssql.VarChar(255), supplierNameVal)
          .input("supplier_amount", mssql.Decimal(18, 2), supplierAmountVal)
          .input("premier_amount", mssql.Decimal(18, 2), premierAmountVal)
          .input(
            "customization_customer_name",
            mssql.VarChar(255),
            customerNameVal
          )
          .input("customization_comments", mssql.Text, customerCommentsVal)
          .input("sample_quantity", mssql.Int, sampleQuantityVal)
          .input("certification_type", mssql.VarChar(50), certificationType)
          .query(`
                INSERT INTO dbo.certifications
                  (project_name, project_details, material, testing_laboratory,
                   testing_approved_by, status, due_date, remarks,
                   paid_for_by, currency, amount, supplier_name,
                   supplier_amount, premier_amount,
                   customization_customer_name, customization_comments,
                   sample_quantity, certification_type)
                VALUES
                  (@projectName,@projectDetails,@material,@testing_laboratory,
                   @testing_approved_by,@status,@due_date,@remarks,
                   @paid_for_by,@currency,@amount,@supplier_name,
                   @supplier_amount,@premier_amount,
                   @customization_customer_name,@customization_comments,
                   @sample_quantity,@certification_type);
              `);
      } catch (e) {
        console.error("⚠️ MSSQL INSERT certifications failed:", e);
      }
    }

    // Helper to bulk-insert into auxiliary tables
    const bulkInsert = async (table, column, arr) => {
      if (!Array.isArray(arr)) return;
      for (const value of arr) {
        await conn.execute(
          `INSERT INTO ${table} (certification_id, ${column}) VALUES (?, ?)`,
          [certId, value]
        );
        // MSSQL fallback
        if (mssqlPool) {
          try {
            await mssqlPool
              .request()
              .input("id", mssql.Int, certId)
              .input("val", mssql.VarChar(255), value).query(`
                INSERT INTO dbo.${table}
                  (certification_id, ${column})
                VALUES (@id, @val);
              `);
          } catch (_) {}
        }
      }
    };

    // Insert product types, material categories, production lines
    await bulkInsert(
      "certification_product_types",
      "product_type",
      productType
    );
    await bulkInsert(
      "certification_material_categories",
      "material_category",
      materialCategories
    );
    await bulkInsert(
      "certification_production_lines",
      "production_line",
      productionLine
    );

    // Insert due-date history entries
    if (Array.isArray(dueDateHistory)) {
      for (const h of dueDateHistory) {
        await conn.execute(
          `INSERT INTO due_date_history
               (certification_id, previous_date, new_date, changed_at)
             VALUES (?, ?, ?, ?)`,
          [certId, h.previousDate, h.newDate, h.changedAt]
        );
        if (mssqlPool) {
          try {
            await mssqlPool
              .request()
              .input("id", mssql.Int, certId)
              .input("prev", mssql.Date, h.previousDate)
              .input("newd", mssql.Date, h.newDate)
              .input("chg", mssql.DateTime, h.changedAt).query(`
                INSERT INTO dbo.due_date_history
                  (certification_id, previous_date, new_date, changed_at)
                VALUES
                  (@id, @prev, @newd, @chg);
              `);
          } catch (_) {}
        }
      }
    }

    // Insert non-invoice uploads
    if (Array.isArray(uploads)) {
      for (const file of uploads) {
        await conn.execute(
          `INSERT INTO uploads
               (id, certification_id, name, data, type, is_invoice)
             VALUES (?, ?, ?, ?, ?, 0)`,
          [file.id, certId, file.name, file.data, file.type]
        );
        if (mssqlPool) {
          try {
            await mssqlPool
              .request()
              .input("id", mssql.Char(36), file.id)
              .input("cert", mssql.Int, certId)
              .input("nm", mssql.VarChar(255), file.name)
              .input("dt", mssql.Text, file.data)
              .input("tp", mssql.VarChar(100), file.type).query(`
                INSERT INTO dbo.uploads
                  (id, certification_id, name, data, type, is_invoice)
                VALUES
                  (@id, @cert, @nm, @dt, @tp, 0);
              `);
          } catch (_) {}
        }
      }
    }

    // Insert invoice attachment (if any)
    if (invoiceAttachment) {
      await conn.execute(
        `INSERT INTO uploads
             (id, certification_id, name, data, type, is_invoice)
           VALUES (?, ?, ?, ?, ?, 1)`,
        [
          invoiceAttachment.id,
          certId,
          invoiceAttachment.name,
          invoiceAttachment.data,
          invoiceAttachment.type,
        ]
      );
      if (mssqlPool) {
        try {
          await mssqlPool
            .request()
            .input("id", mssql.Char(36), invoiceAttachment.id)
            .input("cert", mssql.Int, certId)
            .input("nm", mssql.VarChar(255), invoiceAttachment.name)
            .input("dt", mssql.Text, invoiceAttachment.data)
            .input("tp", mssql.VarChar(100), invoiceAttachment.type).query(`
              INSERT INTO dbo.uploads
                (id, certification_id, name, data, type, is_invoice)
              VALUES
                (@id, @cert, @nm, @dt, @tp, 1);
            `);
        } catch (_) {}
      }
    }

    // Commit transaction
    await conn.commit();

    // Send email to Technical Head (Baskara)
    const newReqHtml = `
  <div style="font-family:Arial, sans-serif; color:#333; line-height:1.4;">
    <!-- Header Banner -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0078D4; padding:20px 0;">
      <tr>
        <td align="center">
          <h1 style="color:#fff; margin:0; font-size:24px;">🆕 New Certification Request</h1>
          <p style="color:#e0e0e0; margin:5px 0 0; font-size:14px;">
            A fresh request is awaiting your review
          </p>
        </td>
      </tr>
    </table>

    <!-- Body Content -->
    <div style="padding:20px; max-width:600px; margin:0 auto; background-color:#f9f9f9;">
      <p style="font-size:16px; margin-bottom:10px;">
        Hello <strong>Baskara Sir</strong>,
      </p>
      <p style="font-size:14px; margin-bottom:20px;">
        A new certification request has been submitted by <strong>Praful</strong>. Below are the details:
      </p>

      <!-- Details Table -->
      <table
        cellpadding="10"
        cellspacing="0"
        border="1"
        style="border-collapse:collapse; width:100%; background-color:#fff;"
      >
        <tr style="background-color:#0078D4; color:#fff;">
          <th align="left">Field</th>
          <th align="left">Value</th>
        </tr>
        <tr>
          <td><strong>ID</strong></td>
          <td>${certId}</td>
        </tr>
        <tr style="background-color:#f4f4f4;">
          <td><strong>Project Name</strong></td>
          <td>${projectName}</td>
        </tr>
        <tr>
          <td><strong>Due Date</strong></td>
          <td>${dueDate}</td>
        </tr>
      </table>

      <p style="font-size:14px; margin:20px 0 10px;">
        Please review the request at your earliest convenience to ensure timely processing.
      </p>
      <p style="font-size:14px; margin:0 0 30px;">
        Looking forward to your prompt action: <a href="https://certifypro.premierenergies.com:12443/" style="color:#0078D4; text-decoration:none;">View Request</a>
      </p>

      <!-- Sign-off -->
      <p style="font-size:14px; margin:0;">
        Thanks &amp; Regards,<br/>
        Team CertifyPro
      </p>
    </div>
  </div>
`;

    await sendEmail(
      "aarnav.singh@premierenergies.com",
      `New Certification Request #${certId}`,
      newReqHtml
    );

    return res.status(201).json({ id: String(certId), serialNumber: certId });
  } catch (err) {
    // Roll back on error
    await conn.rollback();
    console.error("POST /api/certifications error:", err);
    return res.status(500).json({ message: "Server Error" });
  } finally {
    conn.release();
  }
});

// --- UPDATE ---
app.put("/api/certifications/:id", async (req, res) => {
  const certId = Number(req.params.id);
  const conn = await pool.getConnection();
  const b = req.body; // shortcut to request body

  try {
    // Start transaction
    await conn.beginTransaction();

    // 1) Update main certification fields (leave approval columns intact)
    await conn.execute(
      `UPDATE certifications SET
         project_name                = ?,
         project_details             = ?,
         material                    = ?,
         testing_laboratory          = ?,
         testing_approved_by         = ?,
         status                      = ?,
         due_date                    = ?,
         remarks                     = ?,
         paid_for_by                 = ?,
         currency                    = ?,
         amount                      = ?,
         supplier_name               = ?,
         supplier_amount             = ?,
         premier_amount              = ?,
         customization_customer_name = ?,
         customization_comments      = ?,
         sample_quantity             = ?,
         certification_type          = ?
       WHERE id = ?`,
      [
        b.projectName,
        b.projectDetails,
        b.material,
        b.testingLaboratory,
        b.testingApprovedBy ?? null,
        b.status,
        b.dueDate,
        b.remarks ?? null,
        b.paymentInfo?.paidForBy ?? null,
        b.paymentInfo?.currency ?? null,
        b.paymentInfo?.amount ?? null,
        b.paymentInfo?.supplierName ?? null,
        b.paymentInfo?.supplierAmount ?? null,
        b.paymentInfo?.premierAmount ?? null,
        b.customizationInfo?.customerName ?? null,
        b.customizationInfo?.comments ?? null,
        b.sampleQuantity ?? null,
        b.certificationType,
        certId,
      ]
    );

    // MSSQL fallback for main UPDATE
    if (mssqlPool) {
      try {
        const reqMs = mssqlPool
          .request()
          .input("projectName", mssql.VarChar(255), b.projectName)
          .input("projectDetails", mssql.Text, b.projectDetails)
          .input("material", mssql.VarChar(255), b.material)
          .input("testing_laboratory", mssql.VarChar(255), b.testingLaboratory)
          .input(
            "testing_approved_by",
            mssql.VarChar(255),
            b.testingApprovedBy ?? null
          )
          .input("status", mssql.VarChar(50), b.status)
          .input("due_date", mssql.Date, b.dueDate)
          .input("remarks", mssql.Text, b.remarks ?? null)
          .input(
            "paid_for_by",
            mssql.VarChar(50),
            b.paymentInfo?.paidForBy ?? null
          )
          .input("currency", mssql.VarChar(10), b.paymentInfo?.currency ?? null)
          .input("amount", mssql.Decimal(18, 2), b.paymentInfo?.amount ?? null)
          .input(
            "supplier_name",
            mssql.VarChar(255),
            b.paymentInfo?.supplierName ?? null
          )
          .input(
            "supplier_amount",
            mssql.Decimal(18, 2),
            b.paymentInfo?.supplierAmount ?? null
          )
          .input(
            "premier_amount",
            mssql.Decimal(18, 2),
            b.paymentInfo?.premierAmount ?? null
          )
          .input(
            "customization_customer_name",
            mssql.VarChar(255),
            b.customizationInfo?.customerName ?? null
          )
          .input(
            "customization_comments",
            mssql.Text,
            b.customizationInfo?.comments ?? null
          )
          .input("sample_quantity", mssql.Int, b.sampleQuantity ?? null)
          .input("certification_type", mssql.VarChar(50), b.certificationType)
          .input("id", mssql.Int, certId);
        await reqMs.query(`
          UPDATE dbo.certifications SET
            project_name                = @projectName,
            project_details             = @projectDetails,
            material                    = @material,
            testing_laboratory          = @testing_laboratory,
            testing_approved_by         = @testing_approved_by,
            status                      = @status,
            due_date                    = @due_date,
            remarks                     = @remarks,
            paid_for_by                 = @paid_for_by,
            currency                    = @currency,
            amount                      = @amount,
            supplier_name               = @supplier_name,
            supplier_amount             = @supplier_amount,
            premier_amount              = @premier_amount,
            customization_customer_name = @customization_customer_name,
            customization_comments      = @customization_comments,
            sample_quantity             = @sample_quantity,
            certification_type          = @certification_type
          WHERE id = @id;
        `);
      } catch (e) {
        console.error("⚠️ MSSQL UPDATE certifications failed:", e);
      }
    }

    // 2) Clear and re-insert all to-many fields
    for (let tbl of [
      "certification_product_types",
      "certification_material_categories",
      "certification_production_lines",
    ]) {
      await conn.execute(`DELETE FROM ${tbl} WHERE certification_id = ?`, [
        certId,
      ]);
      if (mssqlPool) {
        try {
          await mssqlPool
            .request()
            .input("id", mssql.Int, certId)
            .query(`DELETE FROM dbo.${tbl} WHERE certification_id = @id;`);
        } catch (_) {}
      }
    }
    const bulkInsert2 = async (table, column, arr) => {
      if (!Array.isArray(arr)) return;
      for (let v of arr) {
        await conn.execute(
          `INSERT INTO ${table} (certification_id, ${column}) VALUES (?, ?)`,
          [certId, v]
        );
        if (mssqlPool) {
          try {
            await mssqlPool
              .request()
              .input("id", mssql.Int, certId)
              .input("val", mssql.VarChar(255), v).query(`
                INSERT INTO dbo.${table}
                  (certification_id, ${column})
                VALUES (@id, @val);
              `);
          } catch (_) {}
        }
      }
    };
    await bulkInsert2(
      "certification_product_types",
      "product_type",
      b.productType
    );
    await bulkInsert2(
      "certification_material_categories",
      "material_category",
      b.materialCategories
    );
    await bulkInsert2(
      "certification_production_lines",
      "production_line",
      b.productionLine
    );

    // 3) Insert any new due-date history entries
    if (Array.isArray(b.dueDateHistory)) {
      for (let h of b.dueDateHistory) {
        const formattedChangedAt = new Date(h.changedAt)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");
        await conn.execute(
          `INSERT INTO due_date_history
             (certification_id, previous_date, new_date, changed_at)
           VALUES (?, ?, ?, ?)`,
          [certId, h.previousDate, h.newDate, formattedChangedAt]
        );
        if (mssqlPool) {
          try {
            await mssqlPool
              .request()
              .input("id", mssql.Int, certId)
              .input("prev", mssql.Date, h.previousDate)
              .input("newd", mssql.Date, h.newDate)
              .input("chg", mssql.DateTime, formattedChangedAt).query(`
                INSERT INTO dbo.due_date_history
                  (certification_id, previous_date, new_date, changed_at)
                VALUES
                  (@id, @prev, @newd, @chg);
              `);
          } catch (_) {}
        }
      }
    }

    // 4) Replace non-invoice uploads
    await conn.execute(
      `DELETE FROM uploads WHERE certification_id = ? AND is_invoice = 0`,
      [certId]
    );
    if (mssqlPool) {
      try {
        await mssqlPool
          .request()
          .input("id", mssql.Int, certId)
          .query(
            "DELETE FROM dbo.uploads WHERE certification_id = @id AND is_invoice = 0;"
          );
      } catch (_) {}
    }
    if (Array.isArray(b.uploads)) {
      for (let u of b.uploads) {
        await conn.execute(
          `INSERT INTO uploads
             (id, certification_id, name, data, type, is_invoice)
           VALUES (?, ?, ?, ?, ?, 0)`,
          [u.id, certId, u.name, u.data, u.type]
        );
        if (mssqlPool) {
          try {
            await mssqlPool
              .request()
              .input("id", mssql.Char(36), u.id)
              .input("cert", mssql.Int, certId)
              .input("nm", mssql.VarChar(255), u.name)
              .input("dt", mssql.Text, u.data)
              .input("tp", mssql.VarChar(100), u.type).query(`
                INSERT INTO dbo.uploads
                  (id, certification_id, name, data, type, is_invoice)
                VALUES
                  (@id, @cert, @nm, @dt, @tp, 0);
              `);
          } catch (_) {}
        }
      }
    }

    // 5) Replace invoice attachment
    await conn.execute(
      `DELETE FROM uploads WHERE certification_id = ? AND is_invoice = 1`,
      [certId]
    );
    if (mssqlPool) {
      try {
        await mssqlPool
          .request()
          .input("id", mssql.Int, certId)
          .query(
            "DELETE FROM dbo.uploads WHERE certification_id = @id AND is_invoice = 1;"
          );
      } catch (_) {}
    }
    if (b.paymentInfo?.invoiceAttachment) {
      const inv = b.paymentInfo.invoiceAttachment;
      await conn.execute(
        `INSERT INTO uploads
           (id, certification_id, name, data, type, is_invoice)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [inv.id, certId, inv.name, inv.data, inv.type]
      );
      if (mssqlPool) {
        try {
          await mssqlPool
            .request()
            .input("id", mssql.Char(36), inv.id)
            .input("cert", mssql.Int, certId)
            .input("nm", mssql.VarChar(255), inv.name)
            .input("dt", mssql.Text, inv.data)
            .input("tp", mssql.VarChar(100), inv.type).query(`
              INSERT INTO dbo.uploads
                (id, certification_id, name, data, type, is_invoice)
              VALUES
                (@id, @cert, @nm, @dt, @tp, 1);
            `);
        } catch (_) {}
      }
    }

    // Commit transaction
    await conn.commit();

    res.json({ message: "Updated" });
  } catch (err) {
    // Roll back on error
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  } finally {
    conn.release();
  }
});

// --- DELETE ---
app.delete("/api/certifications/:id", async (req, res) => {
  try {
    const certId = Number(req.params.id);
    await pool.execute(`DELETE FROM certifications WHERE id=?`, [certId]);
    if (mssqlPool) {
      try {
        await mssqlPool
          .request()
          .input("id", mssql.Int, certId)
          .query("DELETE FROM dbo.certifications WHERE id = @id;");
      } catch (_) {}
    }
    res.json({ message: "Certification deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ── Static SPA Serve ───────────────────────────────────────────────
const distDir = path.join(__dirname, "dist");
const indexHtml = path.join(distDir, "index.html");
app.use(express.static(distDir));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(indexHtml);
});

// 404 & Error Handlers
app.use((_, res) => res.status(404).json({ message: "Route not found" }));
app.use((err, _, res, __) => {
  console.error(err.stack);
  res.status(500).json({ message: "Server Error" });
});


// --- START HTTPS SERVER ---
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, "certs", "mydomain.key"), "utf8"),
  cert: fs.readFileSync(
    path.join(__dirname, "certs", "d466aacf3db3f299.crt"),
    "utf8"
  ),
  ca: fs.readFileSync(
    path.join(__dirname, "certs", "gd_bundle-g2-g1.crt"),
    "utf8"
  ),
};

const PORT = Number(process.env.PORT) || 12443;
const HOST = process.env.HOST || "0.0.0.0";

https.createServer(httpsOptions, app).listen(PORT, HOST, () => {
  console.log(
    `🔒 HTTPS Server ready → https://${
      HOST === "0.0.0.0" ? "localhost" : HOST
    }:${PORT}`
  );
});
