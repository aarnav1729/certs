require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
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

// single helper to run queries
async function runQuery(text, inputs = {}) {
  const req = mssqlPool.request();
  for (let [name, { type, value }] of Object.entries(inputs)) {
    req.input(name, type, value);
  }
  const result = await req.query(text);
  return result.recordset;
}

(async () => {
  try {
    mssqlPool = await mssql.connect(mssqlConfig);
    console.log("🔌 Connected to MSSQL");
    // optionally: call an initMssqlSchema() here if you need to ensure tables exist
  } catch (err) {
    console.error("⛔ MSSQL connection failed", err);
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
  {
    username: "praful",
    password: "praful",
    role: "Requestor",
    name: "Praful Bharadwaj",
    email: "praful.bharadwaj@premierenergies.com",
  },
  {
    username: "baskara",
    password: "baskara",
    role: "TechnicalHead",
    name: "Baskara Pandian T",
    email: "mansa.m@premierenergies.com",
  },
  {
    username: "cmk",
    password: "cmk",
    role: "PlantHead",
    name: "Chandra Mauli Kumar",
    email: "saisathvika.v@premierenergies.com",
  },
  {
    username: "jasveen",
    password: "jasveen",
    role: "Director",
    name: "Jasveen Saluja",
    email: "ashwin.lakra@premierenergies.com",
  },
  {
    username: "vishnu",
    password: "vishnu",
    role: "COO",
    name: "Vishnu Hazari",
    email: "madhur.kakade@premierenergies.com",
  },
  {
    username: "aarnav",
    password: "aarnav",
    role: "Admin",
    name: "Aarnav Singh",
    email: "aarnav.singh@premierenergies.com",
  },
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
    // secure: true → only send over HTTPS
    // sameSite: 'none' → allow cross-site if you ever need it
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// --- STATIC SPA serve (move this *above* any app.use('/api', …) calls) ---
const distDir = path.join(__dirname, "dist");
const indexHtml = path.join(distDir, "index.html");

app.use(express.static(distDir));

// anything *not* beginning with /api → serve index.html
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(indexHtml);
});

// ── In-Memory OTP Store & Routes ─────────────────────────────────────────
const otps = {}; // { [email]: { code, expiresAt, user } }

// Send OTP
// Send OTP
app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body;

  // 0) restrict to allowed users
  const user = users.find((u) => u.email === email);
  if (!user) {
    return res.status(403).json({
      message:
        "You are not currently in the verified users list—please contact IT to gain access.",
    });
  }

  try {
    // 1) generate OTP & expiry
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    otps[email] = { code, expiresAt, user };

    // 2) build branded email
    const subject = "Your Premier Energies One-Time Password";
    const html = `
      <div style="font-family:Arial, sans-serif; color:#333; line-height:1.5; max-width:600px; margin:auto;">
        <h2 style="color:#0078D4; margin-bottom:0.5em;">Welcome to CertifyPro</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Your one-time password (OTP) is:</p>
        <p style="font-size:24px; font-weight:bold; color:#0078D4; margin:0.5em 0;">${code}</p>
        <p>This code <strong>expires in 5 minutes</strong>.</p>
        <hr style="border:none; border-top:1px solid #eee; margin:2em 0;">
        <p style="font-size:12px; color:#777;">
          If you didn’t request this, simply ignore this email.<br>
          Need help? Contact <a href="mailto:support@premierenergies.com">support</a>.
        </p>
        <p style="margin-top:1.5em;">Regards,<br/><strong>Team Premier Energies</strong></p>
      </div>`;

    // 3) send
    await sendEmail(email, subject, html);

    // 4) respond
    return res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("send-otp error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Verify OTP & establish session
app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  const entry = otps[email];
  if (!entry) return res.status(400).json({ message: "No OTP requested" });
  if (Date.now() > entry.expiresAt) {
    delete otps[email];
    return res.status(400).json({ message: "OTP expired" });
  }
  if (otp !== entry.code)
    return res.status(400).json({ message: "Invalid OTP" });

  req.session.user = {
    username: entry.user.username,
    role: entry.user.role,
    name: entry.user.name,
  };
  delete otps[email];
  res.json(req.session.user);
});
// ── End OTP block ───────────────────────────────────────────────────────

// —– AUTH GUARD —–
function requireAuth(req, res, next) {
  if (!req.session.user)
    return res.status(401).json({ message: "Unauthorized" });
  next();
}

// —– LOGIN / LOGOUT (legacy, still works) —–
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
app.get("/api/me", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ message: "Unauthorized" });
  res.json(req.session.user);
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
    // ── load all certifications using our MSSQL helper ──
    const rows = await runQuery(`
      SELECT
        id,
        id                         AS serialNumber,
        project_name               AS projectName,
        project_details            AS projectDetails,
        material,
        testing_laboratory         AS testingLaboratory,
        testing_approved_by        AS testingApprovedBy,
        status,
        CONVERT(varchar(10), due_date, 120)          AS dueDate,
        last_updated_on                              AS lastUpdatedOn,
        remarks,
        paid_for_by                                  AS paidForBy,
        currency,
        amount,
        supplier_name                                AS supplierName,
        supplier_amount                              AS supplierAmount,
        premier_amount                               AS premierAmount,
        customization_customer_name                  AS customerName,
        customization_comments                       AS comments,
        sample_quantity                              AS sampleQuantity,
        certification_type                           AS certificationType,
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
        CONVERT(varchar(24), created_at, 126)        AS createdAt
      FROM dbo.certifications
      ORDER BY id;
    `);

    const results = [];

    for (const row of rows) {
      const id = row.id;

      // fetch product types
      const pt = await runQuery(
        `SELECT product_type 
           FROM dbo.certification_product_types 
          WHERE certification_id = @id`,
        { id: { type: mssql.Int, value: id } }
      );

      // fetch material categories
      const mc = await runQuery(
        `SELECT material_category 
           FROM dbo.certification_material_categories 
          WHERE certification_id = @id`,
        { id: { type: mssql.Int, value: id } }
      );

      // fetch production lines
      const pl = await runQuery(
        `SELECT production_line 
           FROM dbo.certification_production_lines 
          WHERE certification_id = @id`,
        { id: { type: mssql.Int, value: id } }
      );

      // fetch due date history
      const dh = await runQuery(
        `SELECT
           CONVERT(varchar(10), previous_date, 120) AS previousDate,
           CONVERT(varchar(10), new_date, 120)      AS newDate,
           changed_at                              AS changedAt
         FROM dbo.due_date_history
         WHERE certification_id = @id
         ORDER BY changed_at ASC`,
        { id: { type: mssql.Int, value: id } }
      );

      // fetch uploads (non-invoice)
      const ups = await runQuery(
        `SELECT id, name, data, type
           FROM dbo.uploads
          WHERE certification_id = @id
            AND is_invoice = 0`,
        { id: { type: mssql.Int, value: id } }
      );

      // fetch invoice attachment
      const inv = await runQuery(
        `SELECT id, name, data, type
           FROM dbo.uploads
          WHERE certification_id = @id
            AND is_invoice = 1`,
        { id: { type: mssql.Int, value: id } }
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
    console.error("GET /api/certifications error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// --- APPROVAL ENDPOINT WITH EMAIL NOTIFICATIONS ---
app.post("/api/certifications/:id/approve", requireAuth, async (req, res) => {
  try {
    // 1) Validate & parse certification ID
    const certId = parseInt(req.params.id, 10);
    if (isNaN(certId)) {
      return res.status(400).json({ message: "Invalid certification ID" });
    }

    // ——— NEW: fetch current stage statuses ———
    const [existing] = await runQuery(
      `SELECT technical_head_status, plant_head_status, director_status, coo_status, status
         FROM dbo.certifications
        WHERE id = @id;`,
      { id: { type: mssql.Int, value: certId } }
    );
    // if *any* stage is already Rejected, block
    if (
      existing.technical_head_status === "Rejected" ||
      existing.plant_head_status === "Rejected" ||
      existing.director_status === "Rejected" ||
      existing.coo_status === "Rejected"
    ) {
      return res.status(400).json({
        message:
          "This request has already been rejected and cannot be approved.",
      });
    }

    // 2) Validate action
    const { action, comment } = req.body;
    if (!["Approved", "Rejected"].includes(action)) {
      return res
        .status(400)
        .json({ message: "Action must be 'Approved' or 'Rejected'" });
    }

    // 3) Determine stage based on user role
    const role = req.session.user.role;
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

    const statusCol = `${stageKey}_status`;
    const commentCol = `${stageKey}_comment`;
    const atCol = `${stageKey}_at`;

    // 4) Update this stage—and if it's a rejection, also flip the top‐level status
    await runQuery(
      `
          UPDATE dbo.certifications
             SET ${statusCol} = @action,
                 ${commentCol} = @comment,
                 ${atCol}      = GETDATE()
             ${action === "Rejected" ? ", status = 'Rejected'" : ""}
           WHERE id = @id;
          `,
      {
        action: { type: mssql.VarChar(20), value: action },
        comment: { type: mssql.Text, value: comment || null },
        id: { type: mssql.Int, value: certId },
      }
    );

    // 5) Re-fetch the updated certification
    const rows = await runQuery(
      `
      SELECT
        id,
        id                         AS serialNumber,
        project_name               AS projectName,
        project_details            AS projectDetails,
        material,
        testing_laboratory         AS testingLaboratory,
        testing_approved_by        AS testingApprovedBy,
        status,
        CONVERT(varchar(10), due_date, 120)    AS dueDate,
        last_updated_on                        AS lastUpdatedOn,
        remarks,
        paid_for_by                            AS paidForBy,
        currency,
        amount,
        supplier_name                          AS supplierName,
        supplier_amount                        AS supplierAmount,
        premier_amount                         AS premierAmount,
        customization_customer_name            AS customerName,
        customization_comments                 AS comments,
        sample_quantity                        AS sampleQuantity,
        certification_type                     AS certificationType,
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
        CONVERT(varchar(24), created_at, 126) AS createdAt
      FROM dbo.certifications
      WHERE id = @id;
      `,
      { id: { type: mssql.Int, value: certId } }
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Certification not found" });
    }
    const row = rows[0];

    // 6) Fetch related arrays in parallel
    const [
      productTypes,
      materialCategories,
      productionLines,
      dueDateHistory,
      uploads,
      invoiceRows,
    ] = await Promise.all([
      runQuery(
        `SELECT product_type FROM dbo.certification_product_types WHERE certification_id = @id;`,
        { id: { type: mssql.Int, value: certId } }
      ),
      runQuery(
        `SELECT material_category FROM dbo.certification_material_categories WHERE certification_id = @id;`,
        { id: { type: mssql.Int, value: certId } }
      ),
      runQuery(
        `SELECT production_line FROM dbo.certification_production_lines WHERE certification_id = @id;`,
        { id: { type: mssql.Int, value: certId } }
      ),
      runQuery(
        `
        SELECT
          CONVERT(varchar(10), previous_date, 120) AS previousDate,
          CONVERT(varchar(10), new_date,      120) AS newDate,
          changed_at                              AS changedAt
        FROM dbo.due_date_history
        WHERE certification_id = @id
        ORDER BY changed_at ASC;
        `,
        { id: { type: mssql.Int, value: certId } }
      ),
      runQuery(
        `SELECT id, name, data, type FROM dbo.uploads WHERE certification_id = @id AND is_invoice = 0;`,
        { id: { type: mssql.Int, value: certId } }
      ),
      runQuery(
        `SELECT id, name, data, type FROM dbo.uploads WHERE certification_id = @id AND is_invoice = 1;`,
        { id: { type: mssql.Int, value: certId } }
      ),
    ]);

    // 7) Assemble the full updated certification object
    const updatedCert = {
      ...row,
      productType: productTypes.map((r) => r.product_type),
      materialCategories: materialCategories.map((r) => r.material_category),
      productionLine: productionLines.map((r) => r.production_line),
      dueDateHistory,
      uploads,
      paymentInfo: {
        paidForBy: row.paidForBy,
        currency: row.currency,
        amount: row.amount,
        supplierName: row.supplierName,
        supplierAmount: row.supplierAmount,
        premierAmount: row.premierAmount,
        invoiceAttachment: invoiceRows[0] || null,
      },
    };

    // 8) Build notification email
    const headerBanner = `
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0078D4; padding:20px 0;">
  <tr><td align="center">
    <h1 style="color:#fff; margin:0; font-size:24px;">✉️ Certification Update</h1>
  </td></tr>
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

    let to, subject, html;

    if (action === "Rejected") {
      // Notify requestor on rejection
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
      }) has been
      <span style="color:#D32F2F; font-weight:bold;">rejected</span> by
      <strong>${req.session.user.name}</strong>.
    </p>
    <p style="font-size:14px;"><strong>Comments:</strong> ${
      comment || "No comment provided."
    }</p>
    ${detailsTable(certId, row.projectName, row.dueDate)}
    <p style="font-size:14px; margin-top:20px;">
      Please address the comments and resubmit if appropriate:
      <a href="https://certifypro.premierenergies.com:12443/" style="color:#0078D4; text-decoration:none;">Create New Request</a>
    </p>
    <p style="font-size:14px; margin-bottom:30px;">We’re here to help if you need any assistance.</p>
    <p style="font-size:14px; margin:0;">
      Thanks &amp; Regards,<br/>
      Team CertifyPro
    </p>
  </div>
</div>
`;
    } else {
      // Approved → notify next stage or final
      switch (role) {
        case "TechnicalHead":
          to = "aarnav.singh@premierenergies.com";
          subject = `Certification Request #${certId} Approved by Technical Head`;
          html = `
<div style="font-family:Arial,sans-serif;color:#333;line-height:1.4;">
  ${headerBanner}
  <div style="padding:20px;background-color:#f9f9f9;max-width:600px;margin:0 auto;">
    <p style="font-size:16px;">Hello <strong>Chandramauli Sir</strong>,</p>
    <p style="font-size:14px;">
      Certification request <strong>#${certId}</strong> (${row.projectName})
      has been <span style="color:#388E3C;font-weight:bold;">approved</span> by
      <strong>Baskara Sir</strong>.
    </p>
    ${detailsTable(certId, row.projectName, row.dueDate)}
    <p style="font-size:14px;margin-top:20px;">
      Please review it at your earliest convenience.
    </p>
    <p style="font-size:14px;margin-bottom:30px;">
      Your prompt action is appreciated:
      <a href="https://certifypro.premierenergies.com:12443/" style="color:#0078D4;text-decoration:none;">View Request</a>
    </p>
    <p style="font-size:14px;margin:0;">
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
<div style="font-family:Arial,sans-serif;color:#333;line-height:1.4;">
  ${headerBanner}
  <div style="padding:20px;background-color:#f9f9f9;max-width:600px;margin:0 auto;">
    <p style="font-size:16px;">Hello <strong>Jasveen Ma'am</strong>,</p>
    <p style="font-size:14px;">
      Certification request <strong>#${certId}</strong> (${row.projectName})
      has been <span style="color:#388E3C;font-weight:bold;">approved</span> by
      <strong>Chandramauli Sir</strong>.
    </p>
    ${detailsTable(certId, row.projectName, row.dueDate)}
    <p style="font-size:14px;margin-top:20px;">
      Please review it at your earliest convenience.
    </p>
    <p style="font-size:14px;margin-bottom:30px;">
      Your prompt action is appreciated:
      <a href="https://certifypro.premierenergies.com:12443/" style="color:#0078D4;text-decoration:none;">View Request</a>
    </p>
    <p style="font-size:14px;margin:0;">
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
<div style="font-family:Arial,sans-serif;color:#333;line-height:1.4;">
  ${headerBanner}
  <div style="padding:20px;background-color:#f9f9f9;max-width:600px;margin:0 auto;">
    <p style="font-size:16px;">Hello <strong>Vishnu Sir</strong>,</p>
    <p style="font-size:14px;">
      Certification request <strong>#${certId}</strong> (${row.projectName})
      has been <span style="color:#388E3C;font-weight:bold;">approved</span> by
      <strong>Jasveen Ma’am</strong>.
    </p>
    ${detailsTable(certId, row.projectName, row.dueDate)}
    <p style="font-size:14px;margin-top:20px;">
      Please review it at your earliest convenience.
    </p>
    <p style="font-size:14px;margin-bottom:30px;">
      Your prompt action is appreciated:
      <a href="https://certifypro.premierenergies.com:12443/" style="color:#0078D4;text-decoration:none;">View Request</a>
    </p>
    <p style="font-size:14px;margin:0;">
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
<div style="font-family:Arial,sans-serif;color:#333;line-height:1.4;">
  ${headerBanner}
  <div style="padding:20px;background-color:#f9f9f9;max-width:600px;margin:0 auto;">
    <p style="font-size:16px;">Hello <strong>Praful</strong>,</p>
    <p style="font-size:14px;">
      Your certification request <strong>#${certId}</strong> (${
            row.projectName
          })
      has been <span style="color:#388E3C;font-weight:bold;">approved</span> by
      <strong>Vishnu Sir (COO)</strong>. Congratulations – it is now fully approved!
    </p>
    ${detailsTable(certId, row.projectName, row.dueDate)}
    <p style="font-size:14px;margin-top:20px;">
      You may now proceed to the next steps.
    </p>
    <p style="font-size:14px;margin-bottom:30px;">
      Thank you for your collaboration.
    </p>
    <p style="font-size:14px;margin:0;">
      Thanks &amp; Regards,<br/>
      Team CertifyPro
    </p>
  </div>
</div>
`;
          break;
      }
    }

    // 9) Send the notification email
    await sendEmail(to, subject, html);

    // 10) Return the updated certification
    return res.json(updatedCert);
  } catch (err) {
    console.error("Approval endpoint error:", err);
    return res.status(500).json({ message: "Server Error" });
  }
});

// --- GET ONE ---
app.get("/api/certifications/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid certification ID" });
    }

    // ── load the main certification record ──
    const rows = await runQuery(
      `
        SELECT
          id,
          id                         AS serialNumber,
          project_name               AS projectName,
          project_details            AS projectDetails,
          material,
          testing_laboratory         AS testingLaboratory,
          testing_approved_by        AS testingApprovedBy,
          status,
          CONVERT(varchar(10), due_date, 120)         AS dueDate,
          last_updated_on                             AS lastUpdatedOn,
          remarks,
          paid_for_by                                 AS paidForBy,
          currency,
          amount,
          supplier_name                               AS supplierName,
          supplier_amount                             AS supplierAmount,
          premier_amount                              AS premierAmount,
          customization_customer_name                 AS customerName,
          customization_comments                      AS comments,
          sample_quantity                             AS sampleQuantity,
          certification_type                          AS certificationType,
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
          CONVERT(varchar(24), created_at, 126)       AS createdAt
        FROM dbo.certifications
        WHERE id = @id;
      `,
      { id: { type: mssql.Int, value: id } }
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Certification not found" });
    }
    const row = rows[0];

    // ── fetch related arrays ──
    const productTypes = await runQuery(
      `SELECT product_type FROM dbo.certification_product_types WHERE certification_id = @id;`,
      { id: { type: mssql.Int, value: id } }
    );
    const materialCategories = await runQuery(
      `SELECT material_category FROM dbo.certification_material_categories WHERE certification_id = @id;`,
      { id: { type: mssql.Int, value: id } }
    );
    const productionLines = await runQuery(
      `SELECT production_line FROM dbo.certification_production_lines WHERE certification_id = @id;`,
      { id: { type: mssql.Int, value: id } }
    );
    const dueDateHistory = await runQuery(
      `
        SELECT
          CONVERT(varchar(10), previous_date, 120) AS previousDate,
          CONVERT(varchar(10), new_date, 120)      AS newDate,
          changed_at                              AS changedAt
        FROM dbo.due_date_history
        WHERE certification_id = @id
        ORDER BY changed_at ASC;
      `,
      { id: { type: mssql.Int, value: id } }
    );
    const uploads = await runQuery(
      `
        SELECT id, name, data, type
        FROM dbo.uploads
        WHERE certification_id = @id
          AND is_invoice = 0;
      `,
      { id: { type: mssql.Int, value: id } }
    );
    const invoiceRows = await runQuery(
      `
        SELECT id, name, data, type
        FROM dbo.uploads
        WHERE certification_id = @id
          AND is_invoice = 1;
      `,
      { id: { type: mssql.Int, value: id } }
    );

    // ── assemble and return ──
    res.json({
      ...row,
      productType: productTypes.map((r) => r.product_type),
      materialCategories: materialCategories.map((r) => r.material_category),
      productionLine: productionLines.map((r) => r.production_line),
      dueDateHistory,
      uploads,
      paymentInfo: {
        paidForBy: row.paidForBy,
        currency: row.currency,
        amount: row.amount,
        supplierName: row.supplierName,
        supplierAmount: row.supplierAmount,
        premierAmount: row.premierAmount,
        invoiceAttachment: invoiceRows[0] || null,
      },
    });
  } catch (err) {
    console.error("GET /api/certifications/:id error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// --- CREATE ---
app.post("/api/certifications", async (req, res) => {
  let transaction;
  try {
    // 1) Destructure & validate body
    const {
      projectName,
      projectDetails = "",
      material,
      testingLaboratory,
      testingApprovedBy = null,
      status,
      dueDate,
      remarks = "",
      paymentInfo = {},
      sampleQuantity = null,
      certificationType,
      customizationInfo = {},
      productType = [],
      materialCategories = [],
      productionLine = [],
      dueDateHistory = [],
      uploads = [],
    } = req.body;

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
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 2) Start MSSQL transaction
    transaction = new mssql.Transaction(mssqlPool);
    await transaction.begin();

    // 3) Insert main certification record and get new ID
    const insertReq = new mssql.Request(transaction);
    insertReq
      .input("projectName", mssql.VarChar(255), projectName)
      .input("projectDetails", mssql.Text, projectDetails)
      .input("material", mssql.VarChar(255), material)
      .input("testingLaboratory", mssql.VarChar(255), testingLaboratory)
      .input("testingApprovedBy", mssql.VarChar(255), testingApprovedBy)
      .input("status", mssql.VarChar(50), status)
      .input("dueDate", mssql.Date, dueDate)
      .input("remarks", mssql.Text, remarks)
      .input("paidForBy", mssql.VarChar(50), paymentInfo.paidForBy ?? null)
      .input("currency", mssql.VarChar(10), paymentInfo.currency ?? null)
      .input("amount", mssql.Decimal(18, 2), paymentInfo.amount ?? null)
      .input(
        "supplierName",
        mssql.VarChar(255),
        paymentInfo.supplierName ?? null
      )
      .input(
        "supplierAmount",
        mssql.Decimal(18, 2),
        paymentInfo.supplierAmount ?? null
      )
      .input(
        "premierAmount",
        mssql.Decimal(18, 2),
        paymentInfo.premierAmount ?? null
      )
      .input(
        "customerName",
        mssql.VarChar(255),
        customizationInfo.customerName ?? null
      )
      .input("customerComments", mssql.Text, customizationInfo.comments ?? null)
      .input("sampleQuantity", mssql.Int, sampleQuantity)
      .input("certificationType", mssql.VarChar(50), certificationType);

    const insertResult = await insertReq.query(`
      INSERT INTO dbo.certifications
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
      OUTPUT INSERTED.id AS id
      VALUES
        (@projectName,
         @projectDetails,
         @material,
         @testingLaboratory,
         @testingApprovedBy,
         @status,
         @dueDate,
         @remarks,
         @paidForBy,
         @currency,
         @amount,
         @supplierName,
         @supplierAmount,
         @premierAmount,
         @customerName,
         @customerComments,
         @sampleQuantity,
         @certificationType);
    `);

    const certId = insertResult.recordset[0].id;

    // 4) Helper to bulk-insert into child tables, using a fresh Request each time
    const bulkInsert = async (table, column, arr) => {
      for (const val of arr) {
        const req = new mssql.Request(transaction);
        req
          .input("cid", mssql.Int, certId)
          .input("val", mssql.VarChar(255), val);
        await req.query(`
          INSERT INTO dbo.${table}
            (certification_id, ${column})
          VALUES
            (@cid, @val);
        `);
      }
    };

    // 5) Insert product types, categories, production lines
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

    // 6) Insert due-date history entries
    for (const h of dueDateHistory) {
      const req = new mssql.Request(transaction);
      req
        .input("cid", mssql.Int, certId)
        .input("prevDate", mssql.Date, h.previousDate)
        .input("newDate", mssql.Date, h.newDate)
        .input("chgAt", mssql.DateTime, new Date(h.changedAt));
      await req.query(`
        INSERT INTO dbo.due_date_history
          (certification_id, previous_date, new_date, changed_at)
        VALUES
          (@cid, @prevDate, @newDate, @chgAt);
      `);
    }

    // 7) Insert non-invoice uploads
    for (const file of uploads) {
      const req = new mssql.Request(transaction);
      req
        .input("fid", mssql.Char(36), file.id)
        .input("cid", mssql.Int, certId)
        .input("fname", mssql.VarChar(255), file.name)
        .input("fdata", mssql.Text, file.data)
        .input("ftype", mssql.VarChar(100), file.type);
      await req.query(`
        INSERT INTO dbo.uploads
          (id, certification_id, name, data, type, is_invoice)
        VALUES
          (@fid, @cid, @fname, @fdata, @ftype, 0);
      `);
    }

    // 8) Insert invoice attachment (if provided)
    if (paymentInfo.invoiceAttachment) {
      const inv = paymentInfo.invoiceAttachment;
      const req = new mssql.Request(transaction);
      req
        .input("fid", mssql.Char(36), inv.id)
        .input("cid", mssql.Int, certId)
        .input("fname", mssql.VarChar(255), inv.name)
        .input("fdata", mssql.Text, inv.data)
        .input("ftype", mssql.VarChar(100), inv.type);
      await req.query(`
        INSERT INTO dbo.uploads
          (id, certification_id, name, data, type, is_invoice)
        VALUES
          (@fid, @cid, @fname, @fdata, @ftype, 1);
      `);
    }

    // 9) Commit transaction
    await transaction.commit();

    // 10) Send notification email to Technical Head
    const newReqHtml = `
<div style="font-family:Arial,sans-serif;color:#333;line-height:1.4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0078D4;padding:20px 0;">
    <tr><td align="center">
      <h1 style="color:#fff;margin:0;font-size:24px;">🆕 New Certification Request</h1>
      <p style="color:#e0e0e0;margin:5px 0 0;font-size:14px;">A fresh request is awaiting your review</p>
    </td></tr>
  </table>
  <div style="padding:20px;max-width:600px;margin:0 auto;background-color:#f9f9f9;">
    <p style="font-size:16px;margin-bottom:10px;">Hello <strong>Baskara Sir</strong>,</p>
    <p style="font-size:14px;margin-bottom:20px;">
      A new certification request has been submitted by <strong>Praful</strong>. Below are the details:
    </p>
    <table cellpadding="10" cellspacing="0" border="1" style="border-collapse:collapse;width:100%;background-color:#fff;">
      <tr style="background-color:#0078D4;color:#fff;">
        <th align="left">Field</th>
        <th align="left">Value</th>
      </tr>
      <tr><td><strong>ID</strong></td><td>${certId}</td></tr>
      <tr style="background-color:#f4f4f4;"><td><strong>Project Name</strong></td><td>${projectName}</td></tr>
      <tr><td><strong>Due Date</strong></td><td>${dueDate}</td></tr>
    </table>
    <p style="font-size:14px;margin:20px 0 10px;">
      Please review the request at your earliest convenience to ensure timely processing.
    </p>
    <p style="font-size:14px;margin:0 0 30px;">
      Looking forward to your prompt action: <a href="https://certifypro.premierenergies.com:12443/" style="color:#0078D4;text-decoration:none;">View Request</a>
    </p>
    <p style="font-size:14px;margin:0;">Thanks &amp; Regards,<br/>Team CertifyPro</p>
  </div>
</div>`;
    await sendEmail(
      "aarnav.singh@premierenergies.com",
      `New Certification Request #${certId}`,
      newReqHtml
    );

    // 11) Respond
    return res.status(201).json({ id: String(certId), serialNumber: certId });
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error("POST /api/certifications error:", err);
    return res.status(500).json({ message: "Server Error" });
  }
});

// --- UPDATE ---
app.put("/api/certifications/:id", async (req, res) => {
  let transaction;
  try {
    // 1) Validate & parse certification ID
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid certification ID" });
    }

    // 2) Destructure request body
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
      productType = [],
      materialCategories = [],
      productionLine = [],
      dueDateHistory = [],
      uploads = [],
    } = req.body;

    // 3) Begin MSSQL transaction
    transaction = new mssql.Transaction(mssqlPool);
    await transaction.begin();
    const txReq = new mssql.Request(transaction);

    // 4) Update main certification record
    txReq
      .input("id", mssql.Int, id)
      .input("projectName", mssql.VarChar(255), projectName)
      .input("projectDetails", mssql.Text, projectDetails ?? "")
      .input("material", mssql.VarChar(255), material)
      .input("testingLaboratory", mssql.VarChar(255), testingLaboratory)
      .input("testingApprovedBy", mssql.VarChar(255), testingApprovedBy ?? null)
      .input("status", mssql.VarChar(50), status)
      .input("dueDate", mssql.Date, dueDate)
      .input("remarks", mssql.Text, remarks ?? "")
      .input("paidForBy", mssql.VarChar(50), paymentInfo?.paidForBy ?? null)
      .input("currency", mssql.VarChar(10), paymentInfo?.currency ?? null)
      .input("amount", mssql.Decimal(18, 2), paymentInfo?.amount ?? null)
      .input(
        "supplierName",
        mssql.VarChar(255),
        paymentInfo?.supplierName ?? null
      )
      .input(
        "supplierAmount",
        mssql.Decimal(18, 2),
        paymentInfo?.supplierAmount ?? null
      )
      .input(
        "premierAmount",
        mssql.Decimal(18, 2),
        paymentInfo?.premierAmount ?? null
      )
      .input(
        "customerName",
        mssql.VarChar(255),
        customizationInfo?.customerName ?? null
      )
      .input(
        "customerComments",
        mssql.Text,
        customizationInfo?.comments ?? null
      )
      .input("sampleQuantity", mssql.Int, sampleQuantity ?? null)
      .input("certificationType", mssql.VarChar(50), certificationType);

    await txReq.query(`
      UPDATE dbo.certifications
         SET project_name                = @projectName,
             project_details             = @projectDetails,
             material                    = @material,
             testing_laboratory          = @testingLaboratory,
             testing_approved_by         = @testingApprovedBy,
             status                      = @status,
             due_date                    = @dueDate,
             remarks                     = @remarks,
             paid_for_by                 = @paidForBy,
             currency                    = @currency,
             amount                      = @amount,
             supplier_name               = @supplierName,
             supplier_amount             = @supplierAmount,
             premier_amount              = @premierAmount,
             customization_customer_name = @customerName,
             customization_comments      = @customerComments,
             sample_quantity             = @sampleQuantity,
             certification_type          = @certificationType
       WHERE id = @id;
    `);

    // 5) Clear & re-insert product types
    await txReq.query(
      `DELETE FROM dbo.certification_product_types WHERE certification_id = @id;`
    );
    for (const pt of productType) {
      await txReq.input("ptVal", mssql.VarChar(255), pt).query(`
          INSERT INTO dbo.certification_product_types
            (certification_id, product_type)
          VALUES
            (@id, @ptVal);
        `);
    }

    // 6) Clear & re-insert material categories
    await txReq.query(
      `DELETE FROM dbo.certification_material_categories WHERE certification_id = @id;`
    );
    for (const mc of materialCategories) {
      await txReq.input("mcVal", mssql.VarChar(255), mc).query(`
          INSERT INTO dbo.certification_material_categories
            (certification_id, material_category)
          VALUES
            (@id, @mcVal);
        `);
    }

    // 7) Clear & re-insert production lines
    await txReq.query(
      `DELETE FROM dbo.certification_production_lines WHERE certification_id = @id;`
    );
    for (const pl of productionLine) {
      await txReq.input("plVal", mssql.VarChar(255), pl).query(`
          INSERT INTO dbo.certification_production_lines
            (certification_id, production_line)
          VALUES
            (@id, @plVal);
        `);
    }

    // 8) Insert new due-date history entries
    for (const h of dueDateHistory) {
      await txReq
        .input("prevDate", mssql.Date, h.previousDate)
        .input("newDate", mssql.Date, h.newDate)
        .input("chgAt", mssql.DateTime, new Date(h.changedAt)).query(`
          INSERT INTO dbo.due_date_history
            (certification_id, previous_date, new_date, changed_at)
          VALUES
            (@id, @prevDate, @newDate, @chgAt);
        `);
    }

    // 9) Replace non-invoice uploads
    await txReq.query(
      `DELETE FROM dbo.uploads WHERE certification_id = @id AND is_invoice = 0;`
    );
    for (const u of uploads) {
      await txReq
        .input("fileId", mssql.Char(36), u.id)
        .input("fileName", mssql.VarChar(255), u.name)
        .input("fileData", mssql.Text, u.data)
        .input("fileType", mssql.VarChar(100), u.type).query(`
          INSERT INTO dbo.uploads
            (id, certification_id, name, data, type, is_invoice)
          VALUES
            (@fileId, @id, @fileName, @fileData, @fileType, 0);
        `);
    }

    // 10) Replace invoice attachment (if provided)
    await txReq.query(
      `DELETE FROM dbo.uploads WHERE certification_id = @id AND is_invoice = 1;`
    );
    if (paymentInfo?.invoiceAttachment) {
      const inv = paymentInfo.invoiceAttachment;
      await txReq
        .input("invId", mssql.Char(36), inv.id)
        .input("invName", mssql.VarChar(255), inv.name)
        .input("invData", mssql.Text, inv.data)
        .input("invType", mssql.VarChar(100), inv.type).query(`
          INSERT INTO dbo.uploads
            (id, certification_id, name, data, type, is_invoice)
          VALUES
            (@invId, @id, @invName, @invData, @invType, 1);
        `);
    }

    // 11) Commit transaction
    await transaction.commit();
    res.json({ message: "Certification updated successfully" });
  } catch (err) {
    // Roll back on error
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (_) {}
    }
    console.error("PUT /api/certifications/:id error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// --- DELETE ---
app.delete("/api/certifications/:id", async (req, res) => {
  try {
    // 1) validate and parse the ID
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid certification ID" });
    }

    // 2) delete the certification (cascades will clean up related rows)
    await runQuery(`DELETE FROM dbo.certifications WHERE id = @id;`, {
      id: { type: mssql.Int, value: id },
    });

    // 3) respond
    res.json({ message: "Certification deleted" });
  } catch (err) {
    console.error("DELETE /api/certifications/:id error:", err);
    res.status(500).json({ message: "Server Error" });
  }
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
