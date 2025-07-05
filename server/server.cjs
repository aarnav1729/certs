// server/server.cjs
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const sql = require("mssql");
const session = require("express-session");

// --- MSSQL CONFIGURATION (from your credentials) ---
const dbConfig = {
  user: "SPOT_USER",
  password: "Premier#3801",
  server: "10.0.40.10",
  port: 1433,
  database: "IDSL_PEL",
  options: {
    trustServerCertificate: true,
    encrypt: false,
    connectionTimeout: 60000,
  },
};

// --- APP SETUP ---
const app = express();
app.use(helmet());
app.use(cors({
  origin: "http://localhost:8081ß", // your portal
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("combined"));

// --- SESSION MIDDLEWARE ---
const MemoryStore = session.MemoryStore;
app.use(session({
  secret: process.env.SESSION_SECRET || "replace_this_in_prod",
  store: new MemoryStore(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    domain: "localhost",
    httpOnly: true,
    secure: false, // set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  }
}));

let dbPool;
sql.on('error', err => console.error('MSSQL global error', err));

// --- AUTH MIDDLEWARE ---
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: "Unauthorized" });
  next();
}

// --- LOGIN / LOGOUT ---
app.post("/api/login", (req, res) => {
  const { email, id } = req.body;
  if (!email || !id) return res.status(400).json({ message: "email & id required" });
  req.session.user = { email, id };
  res.json({ message: "Logged into cert-board" });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) console.error(err);
    res.json({ message: "Logged out of cert-board" });
  });
});

// --- CRUD ROUTES ---
app.get("/api/certifications", requireAuth, async (req, res) => {
  try {
    const certsRs = await dbPool.request().query(`
      SELECT 
        id,
        serial_number AS serialNumber,
        project_name AS projectName,
        project_details AS projectDetails,
        testing_laboratory AS testingLaboratory,
        testing_approved_by AS testingApprovedBy,
        status,
        CONVERT(varchar(10), due_date, 126) AS dueDate,
        last_updated_on AS lastUpdatedOn,
        remarks,
        paid_for_by AS paidForBy,
        currency,
        amount,
        supplier_name AS supplierName,
        supplier_amount AS supplierAmount,
        premier_amount AS premierAmount,
        customization_customer_name AS customerName,
        customization_comments AS comments,
        sample_quantity AS sampleQuantity,
        certification_type AS certificationType,
        created_at AS createdAt
      FROM certifications
      ORDER BY serial_number;
    `);

    const results = [];
    for (let row of certsRs.recordset) {
      const id = row.id;
      const fetchList = async (table, col) => {
        const rs = await dbPool.request()
          .input("id", sql.Int, id)
          .query(`SELECT ${col} FROM ${table} WHERE certification_id=@id`);
        return rs.recordset.map(r => r[col]);
      };
      const [productType, materialCategories, productionLine] = await Promise.all([
        fetchList("certification_product_types","product_type"),
        fetchList("certification_material_categories","material_category"),
        fetchList("certification_production_lines","production_line"),
      ]);

      const dueDateHistoryRS = await dbPool.request()
        .input("id", sql.Int, id)
        .query(`
          SELECT 
            previous_date AS previousDate,
            new_date AS newDate,
            changed_at AS changedAt
          FROM due_date_history
          WHERE certification_id=@id
          ORDER BY changed_at
        `);

      const uploadsRS = await dbPool.request()
        .input("id", sql.Int, id)
        .query(`
          SELECT id, name, data, type
          FROM uploads
          WHERE certification_id=@id AND is_invoice=0
        `);

      const invRS = await dbPool.request()
        .input("id", sql.Int, id)
        .query(`
          SELECT id, name, data, type
          FROM uploads
          WHERE certification_id=@id AND is_invoice=1
        `);

      results.push({
        id: id.toString(),
        serialNumber: row.serialNumber,
        projectName: row.projectName,
        projectDetails: row.projectDetails,
        productType,
        materialCategories,
        material: row.projectDetails,
        testingLaboratory: row.testingLaboratory,
        testingApprovedBy: row.testingApprovedBy,
        status: row.status,
        dueDate: row.dueDate,
        dueDateHistory: dueDateHistoryRS.recordset,
        lastUpdatedOn: row.lastUpdatedOn,
        remarks: row.remarks,
        uploads: uploadsRS.recordset,
        paymentInfo: {
          paidForBy: row.paidForBy,
          currency: row.currency,
          amount: row.amount,
          supplierName: row.supplierName,
          supplierAmount: row.supplierAmount,
          premierAmount: row.premierAmount,
          invoiceAttachment: invRS.recordset[0] || null
        },
        sampleQuantity: row.sampleQuantity,
        certificationType: row.certificationType,
        customizationInfo: {
          customerName: row.customerName,
          comments: row.comments
        },
        productionLine,
        createdAt: row.createdAt
      });
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

app.get("/api/certifications/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const certRs = await dbPool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          id,
          serial_number AS serialNumber,
          project_name AS projectName,
          project_details AS projectDetails,
          testing_laboratory AS testingLaboratory,
          testing_approved_by AS testingApprovedBy,
          status,
          CONVERT(varchar(10), due_date, 126) AS dueDate,
          last_updated_on AS lastUpdatedOn,
          remarks,
          paid_for_by AS paidForBy,
          currency,
          amount,
          supplier_name AS supplierName,
          supplier_amount AS supplierAmount,
          premier_amount AS premierAmount,
          customization_customer_name AS customerName,
          customization_comments AS comments,
          sample_quantity AS sampleQuantity,
          certification_type AS certificationType,
          created_at AS createdAt
        FROM certifications
        WHERE id=@id
      `);

    if (!certRs.recordset.length) {
      return res.status(404).json({ message: "Certification not found" });
    }

    const row = certRs.recordset[0];
    const fetchList = async (table, col) => {
      const rs = await dbPool.request()
        .input("id", sql.Int, row.id)
        .query(`SELECT ${col} FROM ${table} WHERE certification_id=@id`);
      return rs.recordset.map(r => r[col]);
    };

    const [
      productType,
      materialCategories,
      productionLine,
      dueDateHistoryRS,
      uploadsRS,
      invRS
    ] = await Promise.all([
      fetchList("certification_product_types","product_type"),
      fetchList("certification_material_categories","material_category"),
      fetchList("certification_production_lines","production_line"),
      dbPool.request().input("id", sql.Int, row.id)
        .query(`
          SELECT 
            previous_date AS previousDate,
            new_date AS newDate,
            changed_at AS changedAt
          FROM due_date_history
          WHERE certification_id=@id
          ORDER BY changed_at
        `),
      dbPool.request().input("id", sql.Int, row.id)
        .query(`
          SELECT id, name, data, type
          FROM uploads
          WHERE certification_id=@id AND is_invoice=0
        `),
      dbPool.request().input("id", sql.Int, row.id)
        .query(`
          SELECT id, name, data, type
          FROM uploads
          WHERE certification_id=@id AND is_invoice=1
        `)
    ]);

    res.json({
      id: row.id.toString(),
      serialNumber: row.serialNumber,
      projectName: row.projectName,
      projectDetails: row.projectDetails,
      productType,
      materialCategories,
      material: row.projectDetails,
      testingLaboratory: row.testingLaboratory,
      testingApprovedBy: row.testingApprovedBy,
      status: row.status,
      dueDate: row.dueDate,
      dueDateHistory: dueDateHistoryRS.recordset,
      lastUpdatedOn: row.lastUpdatedOn,
      remarks: row.remarks,
      uploads: uploadsRS.recordset,
      paymentInfo: {
        paidForBy: row.paidForBy,
        currency: row.currency,
        amount: row.amount,
        supplierName: row.supplierName,
        supplierAmount: row.supplierAmount,
        premierAmount: row.premierAmount,
        invoiceAttachment: invRS.recordset[0] || null
      },
      sampleQuantity: row.sampleQuantity,
      certificationType: row.certificationType,
      customizationInfo: {
        customerName: row.customerName,
        comments: row.comments
      },
      productionLine,
      createdAt: row.createdAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

app.post("/api/certifications", requireAuth, async (req, res) => {
  const tx = new sql.Transaction(dbPool);
  try {
    await tx.begin();
    const r = new sql.Request(tx);
    const {
      projectName,
      projectDetails,
      testingLaboratory,
      testingApprovedBy,
      status,
      dueDate,
      remarks,
      paymentInfo,
      sampleQuantity,
      certificationType,
      customizationInfo
    } = req.body;

    const insMain = await r
      .input("pn", sql.NVarChar, projectName)
      .input("pd", sql.NVarChar, projectDetails)
      .input("tl", sql.NVarChar, testingLaboratory)
      .input("ta", sql.NVarChar, testingApprovedBy)
      .input("st", sql.NVarChar, status)
      .input("dd", sql.Date, dueDate)
      .input("rm", sql.NVarChar, remarks)
      .input("pf", sql.NVarChar, paymentInfo.paidForBy)
      .input("cu", sql.NVarChar, paymentInfo.currency)
      .input("amt", sql.Decimal(18,2), paymentInfo.amount)
      .input("snm", sql.NVarChar, paymentInfo.supplierName)
      .input("samt", sql.Decimal(18,2), paymentInfo.supplierAmount)
      .input("pamt", sql.Decimal(18,2), paymentInfo.premierAmount)
      .input("custnm", sql.NVarChar, customizationInfo?.customerName)
      .input("custcmt", sql.NVarChar, customizationInfo?.comments)
      .input("sq", sql.Int, sampleQuantity)
      .input("ct", sql.NVarChar, certificationType)
      .query(`
        INSERT INTO certifications 
          (project_name, project_details, testing_laboratory, testing_approved_by,
           status, due_date, remarks, paid_for_by, currency, amount,
           supplier_name, supplier_amount, premier_amount,
           customization_customer_name, customization_comments,
           sample_quantity, certification_type)
        OUTPUT INSERTED.id
        VALUES
          (@pn, @pd, @tl, @ta, @st, @dd, @rm, @pf, @cu, @amt,
           @snm, @samt, @pamt, @custnm, @custcmt, @sq, @ct);
      `);

    const certId = insMain.recordset[0].id;

    async function bulkInsert(table, column, arr) {
      if (!Array.isArray(arr)) return;
      for (let v of arr) {
        await new sql.Request(tx)
          .input("id", sql.Int, certId)
          .input("val", sql.NVarChar, v)
          .query(`INSERT INTO ${table}(certification_id, ${column}) VALUES(@id, @val)`);
      }
    }

    await bulkInsert("certification_product_types", "product_type", req.body.productType);
    await bulkInsert("certification_material_categories", "material_category", req.body.materialCategories);
    await bulkInsert("certification_production_lines", "production_line", req.body.productionLine);

    if (Array.isArray(req.body.dueDateHistory)) {
      for (let h of req.body.dueDateHistory) {
        await new sql.Request(tx)
          .input("id", sql.Int, certId)
          .input("pd", sql.Date, h.previousDate)
          .input("nd", sql.Date, h.newDate)
          .input("ca", sql.DateTime2, h.changedAt)
          .query(`
            INSERT INTO due_date_history(certification_id, previous_date, new_date, changed_at)
            VALUES(@id, @pd, @nd, @ca)
          `);
      }
    }

    if (Array.isArray(req.body.uploads)) {
      for (let u of req.body.uploads) {
        await new sql.Request(tx)
          .input("id", sql.Int, certId)
          .input("uid", sql.UniqueIdentifier, u.id)
          .input("nm", sql.NVarChar, u.name)
          .input("dt", sql.NVarChar, u.data)
          .input("tp", sql.NVarChar, u.type)
          .input("inv", sql.Bit, 0)
          .query(`
            INSERT INTO uploads(id, certification_id, name, data, type, is_invoice)
            VALUES(@uid, @id, @nm, @dt, @tp, @inv)
          `);
      }
    }

    if (req.body.paymentInfo.invoiceAttachment) {
      const inv = req.body.paymentInfo.invoiceAttachment;
      await new sql.Request(tx)
        .input("id", sql.Int, certId)
        .input("uid", sql.UniqueIdentifier, inv.id)
        .input("nm", sql.NVarChar, inv.name)
        .input("dt", sql.NVarChar, inv.data)
        .input("tp", sql.NVarChar, inv.type)
        .input("inv", sql.Bit, 1)
        .query(`
          INSERT INTO uploads(id, certification_id, name, data, type, is_invoice)
          VALUES(@uid, @id, @nm, @dt, @tp, @inv)
        `);
    }

    await tx.commit();
    res.status(201).json({ id: certId.toString(), serialNumber: certId });
  } catch (err) {
    await tx.rollback();
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

app.put("/api/certifications/:id", requireAuth, async (req, res) => {
  const tx = new sql.Transaction(dbPool);
  try {
    const id = parseInt(req.params.id, 10);
    await tx.begin();
    const r = new sql.Request(tx);
    const body = req.body;

    await r
      .input("id", sql.Int, id)
      .input("pn", sql.NVarChar, body.projectName)
      .input("pd", sql.NVarChar, body.projectDetails)
      .input("tl", sql.NVarChar, body.testingLaboratory)
      .input("ta", sql.NVarChar, body.testingApprovedBy)
      .input("st", sql.NVarChar, body.status)
      .input("dd", sql.Date, body.dueDate)
      .input("rm", sql.NVarChar, body.remarks)
      .input("pf", sql.NVarChar, body.paymentInfo.paidForBy)
      .input("cu", sql.NVarChar, body.paymentInfo.currency)
      .input("amt", sql.Decimal(18,2), body.paymentInfo.amount)
      .input("snm", sql.NVarChar, body.paymentInfo.supplierName)
      .input("samt", sql.Decimal(18,2), body.paymentInfo.supplierAmount)
      .input("pamt", sql.Decimal(18,2), body.paymentInfo.premierAmount)
      .input("custnm", sql.NVarChar, body.customizationInfo?.customerName)
      .input("custcmt", sql.NVarChar, body.customizationInfo?.comments)
      .input("sq", sql.Int, body.sampleQuantity)
      .input("ct", sql.NVarChar, body.certificationType)
      .query(`
        UPDATE certifications SET
          project_name=@pn,
          project_details=@pd,
          testing_laboratory=@tl,
          testing_approved_by=@ta,
          status=@st,
          due_date=@dd,
          remarks=@rm,
          paid_for_by=@pf,
          currency=@cu,
          amount=@amt,
          supplier_name=@snm,
          supplier_amount=@samt,
          premier_amount=@pamt,
          customization_customer_name=@custnm,
          customization_comments=@custcmt,
          sample_quantity=@sq,
          certification_type=@ct,
          last_updated_on=SYSUTCDATETIME()
        WHERE id=@id
      `);

    async function clearTable(table) {
      await new sql.Request(tx)
        .input("id", sql.Int, id)
        .query(`DELETE FROM ${table} WHERE certification_id=@id`);
    }
    await Promise.all([
      clearTable("certification_product_types"),
      clearTable("certification_material_categories"),
      clearTable("certification_production_lines")
    ]);

    async function bulkInsert(table, column, arr) {
      if (!Array.isArray(arr)) return;
      for (let v of arr) {
        await new sql.Request(tx)
          .input("id", sql.Int, id)
          .input("val", sql.NVarChar, v)
          .query(`INSERT INTO ${table}(certification_id, ${column}) VALUES(@id, @val)`);
      }
    }
    await Promise.all([
      bulkInsert("certification_product_types","product_type",body.productType),
      bulkInsert("certification_material_categories","material_category",body.materialCategories),
      bulkInsert("certification_production_lines","production_line",body.productionLine),
    ]);

    if (Array.isArray(body.dueDateHistory)) {
      for (let h of body.dueDateHistory) {
        await new sql.Request(tx)
          .input("id", sql.Int, id)
          .input("pd", sql.Date, h.previousDate)
          .input("nd", sql.Date, h.newDate)
          .input("ca", sql.DateTime2, h.changedAt)
          .query(`
            INSERT INTO due_date_history(certification_id, previous_date, new_date, changed_at)
            VALUES(@id, @pd, @nd, @ca)
          `);
      }
    }

    await new sql.Request(tx)
      .input("id", sql.Int, id)
      .query(`DELETE FROM uploads WHERE certification_id=@id AND is_invoice=0`);

    if (Array.isArray(body.uploads)) {
      for (let u of body.uploads) {
        await new sql.Request(tx)
          .input("id", sql.Int, id)
          .input("uid", sql.UniqueIdentifier, u.id)
          .input("nm", sql.NVarChar, u.name)
          .input("dt", sql.NVarChar, u.data)
          .input("tp", sql.NVarChar, u.type)
          .input("inv", sql.Bit, 0)
          .query(`
            INSERT INTO uploads(id, certification_id, name, data, type, is_invoice)
            VALUES(@uid, @id, @nm, @dt, @tp, @inv)
          `);
      }
    }

    await new sql.Request(tx)
      .input("id", sql.Int, id)
      .query(`DELETE FROM uploads WHERE certification_id=@id AND is_invoice=1`);

    if (body.paymentInfo.invoiceAttachment) {
      const inv = body.paymentInfo.invoiceAttachment;
      await new sql.Request(tx)
        .input("id", sql.Int, id)
        .input("uid", sql.UniqueIdentifier, inv.id)
        .input("nm", sql.NVarChar, inv.name)
        .input("dt", sql.NVarChar, inv.data)
        .input("tp", sql.NVarChar, inv.type)
        .input("inv", sql.Bit, 1)
        .query(`
          INSERT INTO uploads(id, certification_id, name, data, type, is_invoice)
          VALUES(@uid, @id, @nm, @dt, @tp, @inv)
        `);
    }

    await tx.commit();
    res.json({ message: "Updated" });
  } catch (err) {
    await tx.rollback();
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

app.delete("/api/certifications/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await dbPool.request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM certifications WHERE id=@id`);
    res.json({ message: "Certification deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// 404 & error handler
app.use((_, res) => res.status(404).json({ message: "Route not found" }));
app.use((err, _, res, __) => {
  console.error(err.stack);
  res.status(500).json({ message: "Server Error" });
});

// --- HELPER: initialize database, create sequence + tables if they don't exist ---
async function initDb(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.sequences WHERE name = 'seq_serial')
    BEGIN
      CREATE SEQUENCE seq_serial START WITH 1 INCREMENT BY 1;
    END
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'certifications')
    BEGIN
      CREATE TABLE certifications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        serial_number INT NOT NULL DEFAULT NEXT VALUE FOR seq_serial,
        project_name NVARCHAR(255) NOT NULL,
        project_details NVARCHAR(MAX) NOT NULL DEFAULT '',
        testing_laboratory NVARCHAR(255) NOT NULL,
        testing_approved_by NVARCHAR(255) NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'Not Started Yet',
        due_date DATE NOT NULL,
        last_updated_on DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        remarks NVARCHAR(MAX) NOT NULL DEFAULT '',
        paid_for_by NVARCHAR(50) NOT NULL,
        currency NVARCHAR(10) NOT NULL,
        amount DECIMAL(18,2) NULL,
        supplier_name NVARCHAR(255) NULL,
        supplier_amount DECIMAL(18,2) NULL,
        premier_amount DECIMAL(18,2) NULL,
        customization_customer_name NVARCHAR(255) NULL,
        customization_comments NVARCHAR(MAX) NULL,
        sample_quantity INT NULL,
        certification_type NVARCHAR(50) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'certification_product_types')
    BEGIN
      CREATE TABLE certification_product_types (
        certification_id INT NOT NULL,
        product_type NVARCHAR(255) NOT NULL,
        CONSTRAINT fk_cpt_cert FOREIGN KEY(certification_id) REFERENCES certifications(id) ON DELETE CASCADE
      );
    END
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'certification_material_categories')
    BEGIN
      CREATE TABLE certification_material_categories (
        certification_id INT NOT NULL,
        material_category NVARCHAR(255) NOT NULL,
        CONSTRAINT fk_cmc_cert FOREIGN KEY(certification_id) REFERENCES certifications(id) ON DELETE CASCADE
      );
    END
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'certification_production_lines')
    BEGIN
      CREATE TABLE certification_production_lines (
        certification_id INT NOT NULL,
        production_line NVARCHAR(255) NOT NULL,
        CONSTRAINT fk_cpl_cert FOREIGN KEY(certification_id) REFERENCES certifications(id) ON DELETE CASCADE
      );
    END
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'due_date_history')
    BEGIN
      CREATE TABLE due_date_history (
        certification_id INT NOT NULL,
        previous_date DATE NOT NULL,
        new_date DATE NOT NULL,
        changed_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_ddh_cert FOREIGN KEY(certification_id) REFERENCES certifications(id) ON DELETE CASCADE
      );
    END
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'uploads')
    BEGIN
      CREATE TABLE uploads (
        id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        certification_id INT NOT NULL,
        name NVARCHAR(255) NOT NULL,
        data NVARCHAR(MAX) NOT NULL,
        type NVARCHAR(100) NOT NULL,
        is_invoice BIT NOT NULL DEFAULT 0,
        CONSTRAINT fk_up_cert FOREIGN KEY(certification_id) REFERENCES certifications(id) ON DELETE CASCADE
      );
    END
  `);
}

// --- BOOTSTRAP: connect, init DB, then listen ---
(async () => {
  try {
    dbPool = await new sql.ConnectionPool(dbConfig).connect();
    console.log("🔌 Connected to MSSQL");
    await initDb(dbPool);
    console.log("✅ All tables & sequence are in place");

    const PORT = process.env.PORT || 7777;
    app.listen(PORT, () => console.log(`🚀 Cert-board on http://localhost:${PORT}`));
  } catch (err) {
    console.error("⛔ DB initialization failed", err);
    process.exit(1);
  }
})();