const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
  order: {
    type: Number,
    required: true,
  },
});

const coordinateSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
});

const routeSchema = new mongoose.Schema(
  {
    routeNumber: {
      type: String,
      required: [true, 'Please provide route number/code'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    routeName: {
      type: String,
      required: [true, 'Please provide full route corridor name'],
      trim: true,
    },
    startingPoint: {
      type: String,
      required: [true, 'Please specify starting origin'],
    },
    destination: {
      type: String,
      required: [true, 'Please specify final destination'],
    },
    stops: [stopSchema],
    coordinates: [coordinateSchema],
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Route', routeSchema);
