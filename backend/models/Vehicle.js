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
    vehicleType: {
      type: String,
      enum: ['Standard Transit Bus', 'Articulated Bus', 'Electric Shuttle', 'Double Decker Bus'],
      default: 'Standard Transit Bus',
    },
    capacity: {
      type: Number,
      required: [true, 'Please provide passenger capacity'],
      default: 45,
    },
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
