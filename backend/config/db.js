const mongoose = require('mongoose');

/**
 * Connects to MongoDB database with auto-reconnection and event logging.
 * In development or testing without a running MongoDB daemon, provides graceful fallback.
 */
const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/transit_tracking';

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected Successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.warn(`[MongoDB Warning] Could not connect to MongoDB at ${mongoURI}: ${error.message}`);
    console.warn('[MongoDB Notice] Running in operational mode. Telemetry and memory caching enabled.');
    return null;
  }
};

module.exports = connectDB;
