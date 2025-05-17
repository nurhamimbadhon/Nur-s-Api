const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// uploads directory 
const dir = './uploads';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

const upload = multer({ storage: storage });

// ImgBB upload endpoint
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const formData = new FormData();
    formData.append('image', fs.createReadStream(req.file.path));

    const response = await axios.post(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    // Delete the file after upload
    fs.unlinkSync(req.file.path);

    // Return the ImgBB response
    res.json({
      success: true,
      data: response.data.data
    });
  } catch (error) {
    console.error('ImgBB upload error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to upload image to ImgBB'
    });
  }
});

module.exports = router;
