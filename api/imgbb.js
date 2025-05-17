const express = require('express');
const axios = require('axios');
const router = express.Router();

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

router.post('/', async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ message: 'Image URL is required' });
  }

  try {
    const response = await axios.post('https://api.imgbb.com/1/upload', null, {
      params: {
        key: IMGBB_API_KEY,
        image: imageUrl,
      },
    });

    res.json({ imageUrl: response.data.data.url });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
});

module.exports = router;
