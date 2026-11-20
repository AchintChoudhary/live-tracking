const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Driver ID is required'],
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle ID is required'],
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: [true, 'Route ID is required'],
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
      default: 'in-progress',
    },
    liveStatus: {
      type: String,
      default: 'On Route',
    },
    startLocation: {
      name: { type: String, default: null },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    endLocation: {
      name: { type: String, default: null },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    distance: {
      type: Number,
      default: null,
    },
    duration: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes to enforce single-active-trip logic and fast driver/route lookups
tripSchema.index({ vehicleId: 1, status: 1 });
tripSchema.index({ driverId: 1, status: 1 });
tripSchema.index({ routeId: 1, status: 1 });

module.exports = mongoose.model('Trip', tripSchema);
