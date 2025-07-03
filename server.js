const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

require("dotenv").config(); // Make sure this is at the top
const jwt = require("jsonwebtoken");
const firebaseAdmin = require("./firebase-admin");

const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const verifyJWT = require("./middleware/verifyJWT");


// MongoDB Atlas connection
mongoose.connect("mongodb+srv://admin:admin123@cluster0.h0zb1dz.mongodb.net/routineDB?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("✅ MongoDB Atlas connected");
}).catch((err) => {
  console.error("❌ MongoDB connection failed:", err);
});

// Updated Routine schema
const routineSchema = new mongoose.Schema({
  day: String,
  time_range: String,
  room: String,
  section: String,
  course_code: String,
  course_title: String,
  faculty_name: String,
  faculty_designation: String,
  faculty_department: String,
  batch: String,
  is_lab: Boolean,
  lab_fixed_time_range: String,

  // 👇 New Fields for Lab with Two Faculties
  faculty_name_2: String,
  faculty_designation_2: String,
  faculty_department_2: String
});


const Routine = mongoose.model("Routine", routineSchema);


// 🔧 Faculty schema
const facultySchema = new mongoose.Schema({
  name: { type: String, required: true },
  designation: { type: String, required: true },
  type: { type: String, enum: ["Internal", "External"], required: true },
  email: { type: String },
  phone: { type: String },
  department: { type: String },
});

const Faculty = mongoose.model("Faculty", facultySchema);

const siteSettingsSchema = new mongoose.Schema({
  semester: { start_month: String, start_year: String, end_month: String, end_year: String },
  batches: [String],
  classrooms: [String],
  time_ranges: [String], // 👈 new
  sections: [String],    // 👈 new
  university_name: String,
  department_name: String,
  term_type: String, // "Trimester" or "Semester"
  logo_url: String
});


const SiteSettings = mongoose.model("SiteSettings", siteSettingsSchema);

// Test route
app.get("/ping", (req, res) => res.send("pong"));

app.post("/api/admin/login", async (req, res) => {
  const { token } = req.body;

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const email = decoded.email;

    // ✅ Use admin email from .env
    if (email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ message: "Unauthorized admin" });
    }

    const jwtToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "2h" });

    res.json({ jwt: jwtToken });
  } catch (error) {
    console.error("Firebase verification failed", error);
    res.status(401).json({ message: "Invalid Firebase token" });
  }
});


// 🔍 GET routines (with filters)
app.get("/routines", async (req, res) => {
  try {
    const filters = {};

    if (req.query.day) filters.day = req.query.day;
    if (req.query.faculty) filters.faculty_name = { $regex: req.query.faculty, $options: "i" };
    if (req.query.batch) filters.batch = req.query.batch;
    if (req.query.time) filters.time_range = req.query.time;

    const routines = await Routine.find(filters);
    res.json(routines);
  } catch (err) {
    console.error("Error retrieving routines:", err);
    res.status(500).json({ message: "Error retrieving filtered routines" });
  }
});

// 🌐 Public GET route for PrintHeader access (no JWT required)
app.get("/public-settings", async (req, res) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) {
      // Optional default settings if not found
      settings = new SiteSettings({
        semester: {
          start_month: "July",
          start_year: "2025",
          end_month: "December",
          end_year: "2025"
        },
        batches: [],
        classrooms: []
      });
      await settings.save(); // Save the default once
    }
    res.json(settings);
  } catch (err) {
    console.error("❌ Failed to load public-settings:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});



app.use(verifyJWT);

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

app.post("/upload/logo", verifyJWT, upload.single("file"), async (req, res) => {
  try {
    const fileBuffer = req.file.buffer;
    const base64 = fileBuffer.toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataURI, {
      folder: "routine/logo"
    });

    const settings = await SiteSettings.findOne();
    settings.logo_url = result.secure_url;
    await settings.save();

    res.json({ url: result.secure_url });
  } catch (err) {
    console.error("Logo upload failed", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ➕ POST routine (Create)
app.post("/routines", verifyJWT, async (req, res) => {
  try {
    const newRoutine = new Routine(req.body);
    await newRoutine.save();
    res.status(201).json(newRoutine);
  } catch (err) {
    console.error("Error adding routine:", err);
    res.status(500).json({ message: "Failed to add routine" });
  }
});

app.put("/routines/:id", verifyJWT, async (req, res) => {
  console.log("🔥 PUT Request Received:", req.params.id, req.body); // 🔥 ADD THIS
  try {
    const updated = await Routine.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    console.error("Error updating routine:", err);
    res.status(500).json({ message: "Failed to update routine" });
  }
});


// ❌ DELETE routine/:id (Delete)
app.delete("/routines/:id", verifyJWT, async (req, res) => {
  try {
    await Routine.findByIdAndDelete(req.params.id);
    res.json({ message: "Routine deleted" });
  } catch (err) {
    console.error("Error deleting routine:", err);
    res.status(500).json({ message: "Failed to delete routine" });
  }
});


// 📥 POST: Add new faculty
app.post("/faculties", verifyJWT, async (req, res) => {
  try {
    const faculty = new Faculty(req.body);
    await faculty.save();
    res.status(201).json(faculty);
  } catch (err) {
    console.error("Error adding faculty:", err);
    res.status(500).json({ message: "Failed to add faculty" });
  }
});

// 📤 GET: Get all faculties (optional filter by type)
app.get("/faculties", verifyJWT, async (req, res) => {
  try {
    const query = {};
    if (req.query.type) {
      query.type = req.query.type; // e.g., Internal or External
    }
    const faculties = await Faculty.find(query);
    res.json(faculties);
  } catch (err) {
    console.error("Error fetching faculties:", err);
    res.status(500).json({ message: "Failed to fetch faculties" });
  }
});

// ✏️ PUT: Update faculty by ID
app.put("/faculties/:id", verifyJWT, async (req, res) => {
  try {
    const updated = await Faculty.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    console.error("Error updating faculty:", err);
    res.status(500).json({ message: "Failed to update faculty" });
  }
});

// ❌ DELETE: Delete faculty by ID
app.delete("/faculties/:id", verifyJWT, async (req, res) => {
  try {
    await Faculty.findByIdAndDelete(req.params.id);
    res.json({ message: "Faculty deleted" });
  } catch (err) {
    console.error("Error deleting faculty:", err);
    res.status(500).json({ message: "Failed to delete faculty" });
  }
});


// GENERAL INFORMATION OF THE SITE
app.get("/settings", verifyJWT, async (req, res) => {
  let settings = await SiteSettings.findOne();
  if (!settings) settings = new SiteSettings({});
  res.json(settings);
});

// 🌐 Public GET route for PrintHeader access (no JWT required


app.put("/settings/semester", verifyJWT, async (req, res) => {
  const { start_month, start_year, end_month, end_year } = req.body;
  let settings = await SiteSettings.findOne();
  if (!settings) settings = new SiteSettings({});
  settings.semester = { start_month, start_year, end_month, end_year };
  await settings.save();
  res.json(settings.semester);
});

app.post("/settings/batches", verifyJWT, async (req, res) => {
  const { batch } = req.body;
  let settings = await SiteSettings.findOne();
  if (!settings) settings = new SiteSettings({ batches: [], classrooms: [] });
  if (!settings.batches.includes(batch)) settings.batches.push(batch);
  await settings.save();
  res.json(settings.batches);
});


app.delete("/settings/batches/:batch", verifyJWT, async (req, res) => {
  let settings = await SiteSettings.findOne();
  settings.batches = settings.batches.filter(b => b !== req.params.batch);
  await settings.save();
  res.json(settings.batches);
});


app.post("/settings/classrooms", verifyJWT, async (req, res) => {
  const { room } = req.body;
  let settings = await SiteSettings.findOne();
  if (!settings) settings = new SiteSettings({ batches: [], classrooms: [] });
  if (!settings.classrooms.includes(room)) settings.classrooms.push(room);
  await settings.save();
  res.json(settings.classrooms);
});


app.delete("/settings/classrooms/:room", verifyJWT, async (req, res) => {
  let settings = await SiteSettings.findOne();
  settings.classrooms = settings.classrooms.filter(r => r !== req.params.room);
  await settings.save();
  res.json(settings.classrooms);
});


// ⚠️ DELETE all routines (Semester End)
app.delete("/routines", verifyJWT, async (req, res) => {
  try {
    await Routine.deleteMany({});
    res.json({ message: "All routines deleted for semester end" });
  } catch (err) {
    console.error("Error deleting all routines:", err);
    res.status(500).json({ message: "Failed to end semester" });
  }
});

// POST/DELETE /settings/time-ranges
app.post("/settings/time-ranges", verifyJWT, async (req, res) => {
  const { time_range } = req.body;
  const settings = await SiteSettings.findOne();
  if (!settings.time_ranges.includes(time_range)) settings.time_ranges.push(time_range);
  await settings.save();
  res.json(settings.time_ranges);
});

app.delete("/settings/time-ranges/:range", verifyJWT, async (req, res) => {
  const settings = await SiteSettings.findOne();
  settings.time_ranges = settings.time_ranges.filter(r => r !== req.params.range);
  await settings.save();
  res.json(settings.time_ranges);
});

// POST/DELETE /settings/sections
app.post("/settings/sections", verifyJWT, async (req, res) => {
  const { section } = req.body;
  const settings = await SiteSettings.findOne();
  if (!settings.sections.includes(section)) settings.sections.push(section);
  await settings.save();
  res.json(settings.sections);
});

app.delete("/settings/sections/:section", verifyJWT, async (req, res) => {
  const settings = await SiteSettings.findOne();
  settings.sections = settings.sections.filter(s => s !== req.params.section);
  await settings.save();
  res.json(settings.sections);
});

// PUT /settings/general
app.put("/settings/general", verifyJWT, async (req, res) => {
  const { university_name, department_name, term_type, logo_url } = req.body;
  const settings = await SiteSettings.findOne();
  settings.university_name = university_name;
  settings.department_name = department_name;
  settings.term_type = term_type;
  settings.logo_url = logo_url;
  await settings.save();
  res.json(settings);
});


// 🚀 Start server
app.listen(5000, () => {
  console.log("🚀 Server running at http://localhost:5000");
});
