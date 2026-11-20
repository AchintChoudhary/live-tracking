const mongoose = require('mongoose');

/**
 * Connects to MongoDB. Database-backed API operations are unavailable when this fails.
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
    console.error(`[MongoDB] Connection failed (${error.name}). Database-backed features are unavailable.`);
    return null;
  }
};

module.exports = connectDB;
