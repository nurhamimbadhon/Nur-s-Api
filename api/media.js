const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const axios = require("axios");

// MongoDB schema
const MediaSchema = new mongoose.Schema({
  name: String,
  type: String,
  url: String,
  createdAt: { type: Date, default: Date.now }
});
const Media = mongoose.model("Media", MediaSchema);

// POST /api/media
router.post("/", async (req, res) => {
  try {
    const { name, type, image } = req.body;
    if (!name || !type || !image) {
      return res.status(400).json({ success: false, message: "Missing name/type/image" });
    }

    // Upload to Imgur API
    const upload = await axios.post("https://nur-s-api.onrender.com/Nurimg", { image });

    if (!upload.data.success) {
      return res.status(500).json({ success: false, message: "Imgur upload failed" });
    }

    const imgUrl = upload.data.data.url;

    // Save to MongoDB
    const saved = await Media.create({ name, type, url: imgUrl });
    res.json({ success: true, data: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/media
router.get("/", async (req, res) => {
  try {
    const media = await Media.find().sort({ createdAt: -1 });
    res.json({ success: true, data: media });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch media" });
  }
});

// GET /api/media/:name
router.get("/:name", async (req, res) => {
  try {
    const name = req.params.name.toLowerCase();
    const media = await Media.findOne({ name: new RegExp(`^${name}$`, "i") });
    if (!media) return res.status(404).json({ success: false, message: "Media not found" });
    res.json({ success: true, data: media });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch media" });
  }
});

module.exports = router;
