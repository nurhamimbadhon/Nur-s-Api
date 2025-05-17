const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

// Import routes 
const imgbbApi = require('./api/imgbb');
const removebgApi = require('./api/removebg');

// Custom endpoints
app.use('/nurimg', imgbbApi);
app.use('/removebg', removebgApi);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
