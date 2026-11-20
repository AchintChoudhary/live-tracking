const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    vehicleNumber: {
      type: String,
      required: [true, 'Please specify vehicle registration number'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    vehicleName: {
      type: String,
      trim: true,
      default: '',
    },
    vehicleType: {
      type: String,
      enum: ['Standard Transit Bus', 'Articulated Bus', 'Electric Shuttle', 'Double Decker Bus'],
    },
    capacity: {
      type: Number,
      required: [true, 'Please provide passenger capacity'],
    },
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedRoute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
    },
    currentLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      timestamp: { type: Date, default: null },
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Vehicle', vehicleSchema);
