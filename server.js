const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const cors = require('cors');

// Import API routes
const imgbbRouter = require('./api/imgbb');
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
app.use('/Removebg', removebgRouter);

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Nur's APIs server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the API documentation`);
});
