const mongoose = require('mongoose');

const vehicleLocationSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle ID is required'],
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Driver ID is required'],
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: [true, 'Trip ID is required'],
      index: true,
    },
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
    },
    accuracy: {
      type: Number,
      min: 0,
      default: null,
    },
    speed: {
      type: Number,
      min: 0,
      default: null,
    },
    heading: {
      type: Number,
      min: 0,
      max: 360,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for high performance geospatial/temporal queries
vehicleLocationSchema.index({ tripId: 1, timestamp: -1 });

module.exports = mongoose.model('VehicleLocation', vehicleLocationSchema);
