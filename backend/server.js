
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const labRoutes = require('./routes/labRoutes');
const labDetailsRoutes = require('./routes/labDetailsRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const equipmentRoutes = require('./routes/equipmentRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    process.env.FRONTEND_URL
  ].filter(Boolean)
}));

app.use(express.json());

// Connect to MongoDB
connectDB();

// Log incoming API requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Laboratory API routes
app.use('/api/labs', labRoutes);

// Laboratory details API routes
app.use('/api/lab-details', labDetailsRoutes);

// Booking API routes
app.use('/api/bookings', bookingRoutes);

// Authentication API routes
app.use('/api/auth', authRoutes);

// Admin API routes
app.use('/api/admin', adminRoutes);

// Equipment API routes
app.use('/api/equipment', equipmentRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({
    message: 'University Lab Management API is running.'
  });
});

// Return JSON for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    message: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// Start a local server only outside Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Laboratory API mounted at /api/labs');
  });
}

// Export Express app for Vercel
module.exports = app;
