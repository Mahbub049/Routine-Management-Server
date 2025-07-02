const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

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
});

const Routine = mongoose.model("Routine", routineSchema);

// Test route
app.get("/ping", (req, res) => res.send("pong"));

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

// ➕ POST routine (Create)
app.post("/routines", async (req, res) => {
  try {
    const newRoutine = new Routine(req.body);
    await newRoutine.save();
    res.status(201).json(newRoutine);
  } catch (err) {
    console.error("Error adding routine:", err);
    res.status(500).json({ message: "Failed to add routine" });
  }
});

app.put("/routines/:id", async (req, res) => {
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
app.delete("/routines/:id", async (req, res) => {
  try {
    await Routine.findByIdAndDelete(req.params.id);
    res.json({ message: "Routine deleted" });
  } catch (err) {
    console.error("Error deleting routine:", err);
    res.status(500).json({ message: "Failed to delete routine" });
  }
});

// 🚀 Start server
app.listen(5000, () => {
  console.log("🚀 Server running at http://localhost:5000");
});
