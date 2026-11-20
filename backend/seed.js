const mongoose = require('mongoose');
const dotenv = require('dotenv');

const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config(); // fallback to current working directory

const User = require('./models/User');
const Vehicle = require('./models/Vehicle');
const Route = require('./models/Route');
const Trip = require('./models/Trip');
const VehicleLocation = require('./models/VehicleLocation');

const seedData = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/transit_tracking';

  try {
    console.log(`[Seed] Connecting to MongoDB at ${mongoURI}...`);
    await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 });
    console.log('[Seed] Database connection successful.');

    // 1. Clear existing test collections
    console.log('[Seed] Clearing previous test data...');
    await User.deleteMany({});
    await Vehicle.deleteMany({});
    await Route.deleteMany({});
    await Trip.deleteMany({});
    await VehicleLocation.deleteMany({});

    // 2. Seed Users (1 Driver, 2 Passengers)
    console.log('[Seed] Creating demo accounts...');
    const driver = await User.create({
      name: 'Marcus Vance',
      email: 'driver@transit.com',
      password: 'password123',
      phone: '+1 (555) 123-4567',
      role: 'driver',
    });

    const passenger1 = await User.create({
      name: 'Alice Johnson',
      email: 'passenger1@transit.com',
      password: 'password123',
      phone: '+1 (555) 234-5678',
      role: 'passenger',
    });

    const passenger2 = await User.create({
      name: 'Bob Smith',
      email: 'passenger2@transit.com',
      password: 'password123',
      phone: '+1 (555) 345-6789',
      role: 'passenger',
    });

    console.log(`[Seed] Created 1 driver and 2 passengers.`);

    // 3. Seed Vehicles (2 Vehicles)
    console.log('[Seed] Registering fleet vehicles...');
    const vehicle1 = await Vehicle.create({
      vehicleNumber: 'BUS-01',
      vehicleType: 'Standard Transit Bus',
      capacity: 45,
      assignedDriver: driver._id,
      active: true,
    });

    const vehicle2 = await Vehicle.create({
      vehicleNumber: 'BUS-02',
      vehicleType: 'Electric Shuttle',
      capacity: 35,
      assignedDriver: null,
      active: true,
    });

    console.log(`[Seed] Registered 2 transit buses: BUS-01 & BUS-02.`);

    // 4. Seed 3 Transit Corridors
    console.log('[Seed] Establishing designated bus routes & geo-coordinates...');
    const route1 = await Route.create({
      routeNumber: 'R-101',
      routeName: 'North-South Metro Express',
      startingPoint: 'Central Transit Terminal',
      destination: 'Harbor View Transit Center',
      active: true,
      stops: [
        { name: 'Central Transit Terminal', latitude: 37.7749, longitude: -122.4194, order: 1 },
        { name: 'Market Street Station', latitude: 37.7790, longitude: -122.4150, order: 2 },
        { name: 'Civic Center Plaza', latitude: 37.7845, longitude: -122.4080, order: 3 },
        { name: 'Financial District Crossing', latitude: 37.7920, longitude: -122.4010, order: 4 },
        { name: 'Union Square Terminal', latitude: 37.7879, longitude: -122.4075, order: 5 },
        { name: 'Harbor View Transit Center', latitude: 37.8050, longitude: -122.4090, order: 6 },
      ],
      coordinates: [
        { latitude: 37.7749, longitude: -122.4194 },
        { latitude: 37.7770, longitude: -122.4170 },
        { latitude: 37.7790, longitude: -122.4150 },
        { latitude: 37.7820, longitude: -122.4110 },
        { latitude: 37.7845, longitude: -122.4080 },
        { latitude: 37.7879, longitude: -122.4075 },
        { latitude: 37.7920, longitude: -122.4010 },
        { latitude: 37.7980, longitude: -122.4040 },
        { latitude: 37.8050, longitude: -122.4090 },
      ],
    });

    const route2 = await Route.create({
      routeNumber: 'R-202',
      routeName: 'Uptown Circular Line',
      startingPoint: 'Grand Central Plaza',
      destination: 'University Medical Campus',
      active: true,
      stops: [
        { name: 'Grand Central Plaza', latitude: 37.7850, longitude: -122.4200, order: 1 },
        { name: 'Tech District Boulevard', latitude: 37.7800, longitude: -122.4100, order: 2 },
        { name: 'Innovation Hub', latitude: 37.7700, longitude: -122.4050, order: 3 },
        { name: 'University Medical Campus', latitude: 37.7650, longitude: -122.4300, order: 4 },
      ],
      coordinates: [
        { latitude: 37.7850, longitude: -122.4200 },
        { latitude: 37.7825, longitude: -122.4150 },
        { latitude: 37.7800, longitude: -122.4100 },
        { latitude: 37.7750, longitude: -122.4075 },
        { latitude: 37.7700, longitude: -122.4050 },
        { latitude: 37.7675, longitude: -122.4175 },
        { latitude: 37.7650, longitude: -122.4300 },
      ],
    });

    const route3 = await Route.create({
      routeNumber: 'R-303',
      routeName: 'Airport Express Corridor',
      startingPoint: 'Downtown Metro Station',
      destination: 'International Airport Terminal 3',
      active: true,
      stops: [
        { name: 'Downtown Metro Station', latitude: 37.7833, longitude: -122.4167, order: 1 },
        { name: 'South Bay Junction', latitude: 37.7300, longitude: -122.4000, order: 2 },
        { name: 'Airport Gateway Hub', latitude: 37.6500, longitude: -122.3900, order: 3 },
        { name: 'International Airport Terminal 3', latitude: 37.6213, longitude: -122.3790, order: 4 },
      ],
      coordinates: [
        { latitude: 37.7833, longitude: -122.4167 },
        { latitude: 37.7550, longitude: -122.4080 },
        { latitude: 37.7300, longitude: -122.4000 },
        { latitude: 37.6900, longitude: -122.3950 },
        { latitude: 37.6500, longitude: -122.3900 },
        { latitude: 37.6350, longitude: -122.3850 },
        { latitude: 37.6213, longitude: -122.3790 },
      ],
    });

    console.log(`[Seed] Seeded 3 routes: R-101, R-202, R-303.`);

    // 5. Seed an Initial Active Trip & Initial Completed Trip for testing
    console.log('[Seed] Seeding sample active trip & telemetry...');
    const activeTrip = await Trip.create({
      driverId: driver._id,
      vehicleId: vehicle1._id,
      routeId: route1._id,
      startTime: new Date(Date.now() - 15 * 60 * 1000), // started 15 mins ago
      status: 'in-progress',
      startLocation: {
        name: route1.startingPoint,
        latitude: route1.coordinates[0].latitude,
        longitude: route1.coordinates[0].longitude,
      },
      distance: 3.4,
      duration: 900,
    });

    await VehicleLocation.create({
      vehicleId: vehicle1._id,
      driverId: driver._id,
      tripId: activeTrip._id,
      latitude: route1.coordinates[2].latitude,
      longitude: route1.coordinates[2].longitude,
      accuracy: 8,
      speed: 26,
      heading: 45,
      timestamp: new Date(),
    });

    // Seed a completed trip in history
    await Trip.create({
      driverId: driver._id,
      vehicleId: vehicle1._id,
      routeId: route1._id,
      startTime: new Date(Date.now() - 120 * 60 * 1000),
      endTime: new Date(Date.now() - 75 * 60 * 1000),
      status: 'completed',
      startLocation: {
        name: route1.startingPoint,
        latitude: route1.coordinates[0].latitude,
        longitude: route1.coordinates[0].longitude,
      },
      endLocation: {
        name: route1.destination,
        latitude: route1.coordinates[route1.coordinates.length - 1].latitude,
        longitude: route1.coordinates[route1.coordinates.length - 1].longitude,
      },
      distance: 14.2,
      duration: 2700,
    });

    console.log('[Seed] Seeded active trip and historical trip log.');

    console.log('\n================ SEED SUMMARY ================');
    console.log('Driver Login:      driver@transit.com / password123');
    console.log('Passenger 1 Login: passenger1@transit.com / password123');
    console.log('Passenger 2 Login: passenger2@transit.com / password123');
    console.log('Vehicles:          BUS-01, BUS-02');
    console.log('Routes:            R-101, R-202, R-303');
    console.log('==============================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error.message);
    process.exit(1);
  }
};

seedData();
