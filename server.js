const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
import dotenv from 'dotenv';
dotenv.config();
// MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nur_api', { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.connection.on('connected', () => console.log('MongoDB connected'));
mongoose.connection.on('error', err => console.error('MongoDB error:', err));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routers
app.use('/Nurimg', require('./api/imgbb'));
app.use('/api/media', require('./api/media'));

// Health & docs
app.get('/health', async (req, res) => {
  const status = { status: 'OK', mongodb: mongoose.connection.readyState };
  res.json(status);
});
app.get('/api-docs', (req, res) => res.json({ name: "Nur API", version: "2.1.0" }));

// 404
app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Error
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
