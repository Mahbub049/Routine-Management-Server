const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Atlas connection string (replace YOUR_CLUSTER_URL)
mongoose.connect("mongodb+srv://admin:admin123@cluster0.h0zb1dz.mongodb.net/routineDB?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("✅ MongoDB Atlas connected");
}).catch((err) => {
  console.error("❌ MongoDB connection failed:", err);
});

// Routine schema
const routineSchema = new mongoose.Schema({
  day: String,
  time_range: String,
  room: String,
  course_code: String,
  course_title: String,
  faculty_name: String,
  faculty_designation: String,
  faculty_department: String,
  batch: String,
});

const Routine = mongoose.model("Routine", routineSchema);

// Test route
app.get("/ping", (req, res) => res.send("pong"));

app.get("/routines", async (req, res) => {
    try {
      const filters = {};
  
      if (req.query.day) {
        filters.day = req.query.day;
      }
  
      if (req.query.faculty) {
        filters.faculty_name = { $regex: req.query.faculty, $options: "i" };
      }
  
      if (req.query.batch) {
        filters.batch = req.query.batch;
      }
  
      if (req.query.time) {
        filters.time_range = req.query.time;
      }
  
      const routines = await Routine.find(filters);
      res.json(routines);
    } catch (err) {
      console.error("Error:", err);
      res.status(500).json({ message: "Error retrieving filtered routines" });
    }
  });
  
  

// Start server
app.listen(5000, () => {
  console.log("🚀 Server running at http://localhost:5000");
});
