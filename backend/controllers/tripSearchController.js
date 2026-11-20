const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const VehicleLocation = require('../models/VehicleLocation');
const { isValidCoordinates } = require('../utils/distanceCalculator');
const { getTripStopCandidates, routeIndexFor } = require('../utils/tripSearch');
const {
  estimateTripLeg,
  hasRoutingProviderConfigured,
} = require('../services/googleRoutesService');

const GPS_STALE_AFTER_MS = 2 * 60 * 1000;

const getLatestTripLocation = async (tripId) =>
  VehicleLocation.findOne({ tripId }).sort({ timestamp: -1 }).lean();

const routeIntermediates = (route, fromIndex, toIndex) => {
  if (!route.stops?.length || fromIndex < 0 || toIndex <= fromIndex) return [];
  return [...route.stops]
    .map((stop) => ({ stop, routeIndex: routeIndexFor(route, stop) }))
    .filter(({ routeIndex }) => routeIndex > fromIndex && routeIndex < toIndex)
    .sort((a, b) => a.routeIndex - b.routeIndex)
    .slice(0, 25)
    .map(({ stop }) => ({ latitude: stop.latitude, longitude: stop.longitude }));
};

const stopDwellSeconds = (route, predicate) =>
  (route.stops || [])
    .filter(predicate)
    .reduce((sum, stop) => sum + (Number(stop.dwellTimeSeconds) || 0), 0);

const mapWithConcurrency = async (items, concurrency, callback) => {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await callback(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
};

const getEtaForTrip = async (trip, boardingStop, destinationStop, location) => {
  if (!location || Date.now() - new Date(location.timestamp).getTime() > GPS_STALE_AFTER_MS) {
    return {
      etaMinutes: null,
      estimatedArrivalTime: null,
      distanceMeters: null,
      etaStatus: location ? 'stale-location' : 'location-unavailable',
      calculatedAt: null,
      locationUpdatedAt: location?.timestamp || null,
      travelTimeToDestinationMinutes: null,
    };
  }

  const route = trip.routeId;
  const busIndex = routeIndexFor(route, location);
  const boardIndex = routeIndexFor(route, boardingStop);
  const destinationIndex = routeIndexFor(route, destinationStop);
  const intermediatePoints = routeIntermediates(route, busIndex, boardIndex);
  const dwellToBoarding = stopDwellSeconds(
    route,
    (stop) => stop.order < boardingStop.order && routeIndexFor(route, stop) > busIndex
  );
  const dwellToDestination = stopDwellSeconds(
    route,
    (stop) => stop.order > boardingStop.order && stop.order < destinationStop.order
  );

  try {
    const [etaResult, onwardResult] = await Promise.all([
      estimateTripLeg({
        cacheKey: `${trip._id}:${boardingStop._id}:boarding`,
        origin: { latitude: location.latitude, longitude: location.longitude },
        destination: boardingStop,
        intermediates: intermediatePoints,
        dwellSeconds: dwellToBoarding,
      }),
      estimateTripLeg({
        cacheKey: `${route._id}:${boardingStop._id}:${destinationStop._id}:destination`,
        origin: boardingStop,
        destination: destinationStop,
        intermediates: routeIntermediates(route, boardIndex, destinationIndex),
        dwellSeconds: dwellToDestination,
      }),
    ]);

    if (!etaResult) {
      return {
        etaMinutes: null,
        estimatedArrivalTime: null,
        distanceMeters: null,
        etaStatus: hasRoutingProviderConfigured() ? 'routing-unavailable' : 'routing-not-configured',
        calculatedAt: null,
        locationUpdatedAt: location.timestamp,
        travelTimeToDestinationMinutes: null,
      };
    }

    const etaMinutes = Math.max(0, Math.ceil(etaResult.durationSeconds / 60));
    return {
      etaMinutes,
      estimatedArrivalTime: new Date(Date.now() + etaResult.durationSeconds * 1000).toISOString(),
      distanceMeters: etaResult.distanceMeters,
      etaStatus: 'available',
      calculatedAt: etaResult.calculatedAt,
      locationUpdatedAt: location.timestamp,
      dwellIncludedSeconds: etaResult.dwellIncludedSeconds,
      dwellEstimateNote: 'ETA includes configured dwell times only; unknown stop delays are not included.',
      travelTimeToDestinationMinutes: onwardResult
        ? Math.ceil(onwardResult.durationSeconds / 60)
        : null,
    };
  } catch (error) {
    console.error('[Trip ETA] Route calculation failed:', error.message);
    return {
      etaMinutes: null,
      estimatedArrivalTime: null,
      distanceMeters: null,
      etaStatus: 'routing-unavailable',
      calculatedAt: null,
      locationUpdatedAt: location.timestamp,
      travelTimeToDestinationMinutes: null,
    };
  }
};

const searchActiveTrips = async (req, res, next) => {
  try {
    const passengerLat = Number(req.query.passengerLat);
    const passengerLng = Number(req.query.passengerLng);
    const destinationStopId = String(req.query.destinationStopId || req.query.destinationPlaceId || '');
    const boardingStopId = req.query.boardingStopId ? String(req.query.boardingStopId) : null;
    const radiusKm = req.query.radiusKm == null ? 1 : Number(req.query.radiusKm);

    if (!isValidCoordinates(passengerLat, passengerLng)) {
      return res.status(400).json({ success: false, message: 'Valid passengerLat and passengerLng are required' });
    }
    if (!destinationStopId || destinationStopId.length > 200) {
      return res.status(400).json({ success: false, message: 'destinationStopId or destinationPlaceId is required' });
    }
    if (!Number.isFinite(radiusKm) || radiusKm < 0.1 || radiusKm > 25) {
      return res.status(400).json({ success: false, message: 'radiusKm must be between 0.1 and 25' });
    }
    if (boardingStopId && !mongoose.isValidObjectId(boardingStopId)) {
      return res.status(400).json({ success: false, message: 'boardingStopId must be a valid stop ID' });
    }
    if (
      req.query.destinationStopId &&
      !mongoose.isValidObjectId(destinationStopId)
    ) {
      return res.status(400).json({ success: false, message: 'destinationStopId must be a valid stop ID' });
    }

    const trips = await Trip.find({ status: 'in-progress' })
      .populate({ path: 'vehicleId', match: { active: true } })
      .populate({ path: 'routeId', match: { active: true } })
      .populate('driverId', 'name phone')
      .sort({ startTime: -1 })
      .limit(100);

    const locationRows = await VehicleLocation.aggregate([
      { $match: { tripId: { $in: trips.map((trip) => trip._id) } } },
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$tripId', location: { $first: '$$ROOT' } } },
    ]);
    const locationsByTripId = new Map(
      locationRows.map((row) => [String(row._id), row.location])
    );
    const data = [];
    const nearestStopMap = new Map();
    const etaJobs = [];

    for (const trip of trips) {
      if (!trip.vehicleId || !trip.routeId) continue;

      const location = locationsByTripId.get(String(trip._id)) || null;
      const stopMatches = getTripStopCandidates({
        route: trip.routeId,
        location,
        passengerLat,
        passengerLng,
        destinationStopId,
        boardingStopId,
        radiusKm,
      });

      stopMatches.nearestStops.forEach((stop) => {
        const key = `${stop.routeId}:${stop._id}`;
        if (!nearestStopMap.has(key)) nearestStopMap.set(key, stop);
      });

      const selectedMatches = boardingStopId
        ? stopMatches.candidates
        : stopMatches.candidates
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .slice(0, 1);
      for (const match of selectedMatches) {
        etaJobs.push({ trip, match, location });
      }
    }

    const etaResults = await mapWithConcurrency(etaJobs, 4, async ({ trip, match, location }) => {
      const eta = await getEtaForTrip(
        trip,
        match.boardingStop,
        match.destinationStop,
        location
      );
      return {
          tripId: trip._id,
          busName: trip.vehicleId.vehicleName || trip.vehicleId.vehicleType || 'Transit Bus',
          vehicle: trip.vehicleId,
          driver: trip.driverId,
          route: trip.routeId,
          startingPoint: trip.routeId.startingPoint,
          destination: trip.routeId.destination,
          boardingStop: match.boardingStop,
          destinationStop: match.destinationStop,
          passengerDistanceMeters: Math.round(match.distanceKm * 1000),
          currentLocation: location
            ? {
                latitude: location.latitude,
                longitude: location.longitude,
                speed: location.speed,
                heading: location.heading,
                timestamp: location.timestamp,
              }
            : null,
          locationStatus: location
            ? Date.now() - new Date(location.timestamp).getTime() > GPS_STALE_AFTER_MS
              ? 'stale'
              : 'current'
            : 'unavailable',
          status: trip.liveStatus || trip.status,
          ...eta,
      };
    });
    data.push(...etaResults);

    data.sort((a, b) => {
      if (a.etaMinutes == null) return b.etaMinutes == null ? 0 : 1;
      if (b.etaMinutes == null) return -1;
      return a.etaMinutes - b.etaMinutes;
    });

    const nearestBoardingStops = [...nearestStopMap.values()].sort(
      (a, b) => a.distanceKm - b.distanceKm
    );

    res.json({
      success: true,
      count: data.length,
      radiusKm,
      data,
      nearestBoardingStops,
      message: data.length ? undefined : 'No active buses available for your selected route.',
    });
  } catch (error) {
    next(error);
  }
};

const getTripEta = async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const { boardingStopId } = req.query;
    const requestedDestinationStopId = req.query.destinationStopId
      ? String(req.query.destinationStopId)
      : null;
    if (!mongoose.isValidObjectId(tripId) || !mongoose.isValidObjectId(boardingStopId)) {
      return res.status(400).json({ success: false, message: 'Valid tripId and boardingStopId are required' });
    }
    if (requestedDestinationStopId && !mongoose.isValidObjectId(requestedDestinationStopId)) {
      return res.status(400).json({ success: false, message: 'destinationStopId must be a valid stop ID' });
    }

    const trip = await Trip.findById(tripId)
      .populate({ path: 'vehicleId', match: { active: true } })
      .populate({ path: 'routeId', match: { active: true } });
    if (!trip || trip.status !== 'in-progress' || !trip.vehicleId || !trip.routeId) {
      return res.status(404).json({ success: false, message: 'Active trip not found' });
    }

    const stops = [...(trip.routeId.stops || [])].sort((a, b) => a.order - b.order);
    const boardingIndex = stops.findIndex((stop) => String(stop._id) === boardingStopId);
    if (boardingIndex < 0 || boardingIndex >= stops.length - 1) {
      return res.status(404).json({ success: false, message: 'Boarding stop not found or has no later destination stop' });
    }

    const location = await getLatestTripLocation(trip._id);
    const destinationStop = requestedDestinationStopId
      ? stops.find((stop) => String(stop._id) === requestedDestinationStopId)
      : stops[stops.length - 1];
    const destinationIndex = destinationStop
      ? stops.findIndex((stop) => String(stop._id) === String(destinationStop._id))
      : -1;
    if (!destinationStop || destinationIndex <= boardingIndex) {
      return res.status(400).json({ success: false, message: 'Destination must be a stop later than the boarding stop' });
    }
    if (location && Date.now() - new Date(location.timestamp).getTime() <= GPS_STALE_AFTER_MS) {
      const busIndex = routeIndexFor(trip.routeId, location);
      const boardRouteIndex = routeIndexFor(trip.routeId, stops[boardingIndex]);
      if (busIndex > boardRouteIndex) {
        return res.status(409).json({ success: false, message: 'The bus has already passed this boarding stop' });
      }
    }
    const eta = await getEtaForTrip(trip, stops[boardingIndex], destinationStop, location);
    res.json({
      success: true,
      data: {
        tripId: trip._id,
        busName: trip.vehicleId.vehicleName || trip.vehicleId.vehicleType || 'Transit Bus',
        boardingStop: stops[boardingIndex],
        destinationStop,
        ...eta,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchActiveTrips,
  getTripEta,
};
