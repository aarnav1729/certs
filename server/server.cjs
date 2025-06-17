// server/server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// Load configuration
const PORT = process.env.PORT || 7777;
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://aarnavsingh836:Cucumber1729@rr.oldse8x.mongodb.net/certs?retryWrites=true&w=majority&appName=rr";

// Security & parsing middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("combined"));

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// --- Mongoose Schemas and Models ---

const DueDateChangeSchema = new mongoose.Schema(
  {
    previousDate: { type: Date, required: true },
    newDate: { type: Date, required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UploadFileSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    data: { type: String, required: true },
    type: { type: String, required: true },
  },
  { _id: false }
);

const PaymentInfoSchema = new mongoose.Schema(
  {
    paidForBy: {
      type: String,
      enum: ["Premier", "Supplier", "Split"],
      required: true,
    },
    currency: { type: String, enum: ["INR", "USD"], required: true },
    amount: { type: Number },
    supplierName: { type: String },
    supplierAmount: { type: Number },
    premierAmount: { type: Number },
    invoiceAttachment: UploadFileSchema,
  },
  { _id: false }
);

const CustomizationInfoSchema = new mongoose.Schema(
  {
    customerName: { type: String },
    comments: { type: String },
  },
  { _id: false }
);

const CertificationSchema = new mongoose.Schema({
  serialNumber: { type: Number, required: true, unique: true },
  projectName: { type: String, required: true },
  projectDetails: { type: String, default: "" },
  productType: { type: [String], required: true },
  materialCategories: { type: [String], required: true },
  material: { type: String, required: true },
  testingLaboratory: { type: String, required: true },
  testingApprovedBy: { type: String },
  status: {
    type: String,
    enum: ["Not Started Yet", "In Progress", "Completed"],
    default: "Not Started Yet",
  },
  dueDate: { type: Date, required: true },
  dueDateHistory: [DueDateChangeSchema],
  lastUpdatedOn: { type: Date, default: Date.now },
  remarks: { type: String, default: "" },
  uploads: [UploadFileSchema],
  paymentInfo: { type: PaymentInfoSchema, required: true },
  sampleQuantity: { type: Number },
  certificationType: {
    type: String,
    enum: ["Standard", "Customized"],
    required: true,
  },
  customizationInfo: CustomizationInfoSchema,
  productionLine: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// <<< NEW: expose `id` instead of `_id` in all JSON outputs
CertificationSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
  },
});

const Certification = mongoose.model("Certification", CertificationSchema);

// --- Routes ---

// Fetch all certifications
app.get("/api/certifications", async (req, res) => {
  try {
    const certs = await Certification.find().sort({ serialNumber: 1 });
    res.json(certs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// Fetch a single certification by ID
app.get("/api/certifications/:id", async (req, res) => {
  try {
    const cert = await Certification.findById(req.params.id);
    if (!cert) {
      return res.status(404).json({ message: "Certification not found" });
    }
    res.json(cert);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// Create a new certification
app.post("/api/certifications", async (req, res) => {
  try {
    const data = req.body;
    // Auto-increment serialNumber
    const last = await Certification.findOne().sort({ serialNumber: -1 });
    const nextSN = last ? last.serialNumber + 1 : 1;

    const cert = new Certification({ ...data, serialNumber: nextSN });
    await cert.save();
    res.status(201).json(cert);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// Update an existing certification
app.put("/api/certifications/:id", async (req, res) => {
  try {
    const data = { ...req.body, lastUpdatedOn: Date.now() };
    const cert = await Certification.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
      omitUndefined: true,
    });
    if (!cert) {
      return res.status(404).json({ message: "Certification not found" });
    }
    res.json(cert);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// Delete a certification
app.delete("/api/certifications/:id", async (req, res) => {
  try {
    const cert = await Certification.findByIdAndDelete(req.params.id);
    if (!cert) {
      return res.status(404).json({ message: "Certification not found" });
    }
    res.json({ message: "Certification deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// 404 for any other route
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Server Error" });
});

// Start Express
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});