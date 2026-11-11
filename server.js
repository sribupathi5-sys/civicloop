require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '6mb' }));      // photos arrive as base64
app.use(express.static('public'));            // serves the frontend

app.use('/api/auth', require('./routes/auth'));
app.use('/api/issues', require('./routes/issues'));

app.use((err, req, res, next) => {            // one place for all errors
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('DB connected');
    app.listen(process.env.PORT || 3000, () =>
      console.log('Server running on http://localhost:' + (process.env.PORT || 3000)));
  })
  .catch(err => console.log('DB error:', err.message));
