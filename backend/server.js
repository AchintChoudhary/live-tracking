const http = require('http');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const path = require('path');
// Load environment variables from backend/.env or cwd
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const connectDB = require('./config/db');
const { initSocketHandler } = require('./sockets/socketHandler');
const errorHandler = require('./middleware/errorMiddleware');

// Route files
const authRoutes = require('./routes/authRoutes');
const driverRoutes = require('./routes/driverRoutes');
const passengerRoutes = require('./routes/passengerRoutes');
const routeRoutes = require('./routes/routeRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const locationRoutes = require('./routes/locationRoutes');
const tripRoutes = require('./routes/tripRoutes');
const placeRoutes = require('./routes/placeRoutes');

// Initialize Express & HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS policy
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Attach Socket.IO to Express app so controllers can access io instance
app.set('io', io);

// Setup Socket.IO Event Handlers
initSocketHandler(io);

// Connect to Database
connectDB();

// Global Middlewares
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'online' : 'degraded',
    database: databaseConnected ? 'connected' : 'unavailable',
    system: 'TransitTrack Live Real-Time Transport Tracking System',
    timestamp: new Date().toISOString(),
  });
});

// API Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/passenger', passengerRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/places', placeRoutes);
app.use('/api/trips', tripRoutes);

// 404 Route Not Found Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test_export') {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` TRANSIT TRACK LIVE - REAL-TIME BACKEND ENGINE ACTIVE `);
    console.log(` Server running on port: ${PORT}                      `);
    console.log(` Socket.IO real-time tracking gateway initialized      `);
    console.log(`=======================================================`);
  });
}

module.exports = { app, server, io };
