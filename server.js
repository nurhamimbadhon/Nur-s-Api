const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const cors = require('cors');

// Import API routes
const imgbbRouter = require('./api/imgbb');
const honeyRouter = require('./api/honey');
//const removebgRouter = require('./api/removebg');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve file from web folder
app.use(express.static(path.join(__dirname, 'web')));

// Endpoints
app.use('/Nurimg', imgbbRouter);
app.use('/honey', honeyRouter);
//app.use('/Removebg', removebgRouter);

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// API documentation endpoint
app.get('/api-docs', (req, res) => {
  res.json({
    name: "Nur's API Server",
    version: "1.0.0",
    endpoints: {
      "/Nurimg": "Image upload to ImgBB",
      "/honey": "Chatbot API with MongoDB",
      "/honey/health": "Health check for chatbot API",
      "/honey/stats": "Statistics for chatbot API"
    },
    honey_usage: {
      chat: "/honey?text=your_message&senderID=user_id",
      teach: "/honey?teach=message&reply=response1,response2&senderID=user_id",
      teach_reaction: "/honey?teach=message&react=reaction1,reaction2",
      remove: "/honey?remove=message&senderID=user_id",
      remove_specific: "/honey?remove=message&index=1",
      list_all: "/honey?list=all",
      list_message: "/honey?list=specific_message",
      edit: "/honey?edit=message&replace=new_response&senderID=user_id",
      intro: "/honey?text=message&senderID=user_id&key=intro"
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    available_routes: ['/Nurimg', '/honey', '/api-docs']
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Nur's APIs server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the API documentation`);
  console.log(`Visit http://localhost:${PORT}/api-docs for API usage guide`);
  console.log(`Honey Chatbot API: http://localhost:${PORT}/honey`);
});

module.exports = app;
