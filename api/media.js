const express = require('express');
const { MongoClient } = require('mongodb');
const router = express.Router();

let db;
let mediaCollection;

// Initialize MongoDB connection
const initializeDB = async () => {
  if (!db) {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db('bot-v2');
    mediaCollection = db.collection('sei_media');
    console.log('MongoDB connected for media API');
  }
};

// GET /api/media - Get all media
router.get('/', async (req, res) => {
  try {
    await initializeDB();
    const media = await mediaCollection.find({}).toArray();
    res.json({
      success: true,
      data: media,
      count: media.length
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch media'
    });
  }
});

// POST /api/media - Add new media
router.post('/', async (req, res) => {
  try {
    await initializeDB();
    const { url, name, type } = req.body;

    if (!url || !name || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: url, name, type'
      });
    }

    // Check if media already exists
    const existingMedia = await mediaCollection.findOne({ url });
    if (existingMedia) {
      return res.status(409).json({
        success: false,
        error: 'Media already exists'
      });
    }

    const mediaData = {
      url,
      name,
      type,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await mediaCollection.insertOne(mediaData);
    
    res.status(201).json({
      success: true,
      data: { ...mediaData, _id: result.insertedId },
      message: 'Media added successfully'
    });
  } catch (error) {
    console.error('Error adding media:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add media'
    });
  }
});

// DELETE /api/media - Remove media by URL
router.delete('/', async (req, res) => {
  try {
    await initializeDB();
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    const result = await mediaCollection.deleteOne({ url });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Media not found'
      });
    }

    res.json({
      success: true,
      message: 'Media removed successfully'
    });
  } catch (error) {
    console.error('Error removing media:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove media'
    });
  }
});

// GET /api/media/search/:name - Search media by name
router.get('/search/:name', async (req, res) => {
  try {
    await initializeDB();
    const { name } = req.params;
    
    // Search for exact match first, then partial matches
    const exactMatch = await mediaCollection.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (exactMatch) {
      return res.json({
        success: true,
        data: exactMatch,
        type: 'exact'
      });
    }

    const partialMatches = await mediaCollection.find({ 
      name: { $regex: new RegExp(name, 'i') } 
    }).toArray();

    res.json({
      success: true,
      data: partialMatches,
      type: 'partial',
      count: partialMatches.length
    });
  } catch (error) {
    console.error('Error searching media:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search media'
    });
  }
});

// GET /api/media/random - Get random media (with usage tracking)
router.get('/random/:userId', async (req, res) => {
  try {
    await initializeDB();
    const { userId } = req.params;
    
    const allMedia = await mediaCollection.find({}).toArray();
    
    if (allMedia.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No media found'
      });
    }

    // Get user's usage tracking
    const userCollection = db.collection('user_media_usage');
    let userUsage = await userCollection.findOne({ userId });
    
    if (!userUsage) {
      userUsage = { userId, usedUrls: [] };
    }

    // Filter out already used media
    let availableMedia = allMedia.filter(m => !userUsage.usedUrls.includes(m.url));
    
    // If all media has been used, reset the list
    if (availableMedia.length === 0) {
      availableMedia = allMedia;
      userUsage.usedUrls = [];
    }

    // Select random media
    const randomMedia = availableMedia[Math.floor(Math.random() * availableMedia.length)];
    
    // Update usage tracking
    userUsage.usedUrls.push(randomMedia.url);
    await userCollection.replaceOne(
      { userId }, 
      userUsage, 
      { upsert: true }
    );

    res.json({
      success: true,
      data: randomMedia
    });
  } catch (error) {
    console.error('Error getting random media:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get random media'
    });
  }
});

module.exports = router;
