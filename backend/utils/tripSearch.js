const { calculateDistanceKm } = require('./distanceCalculator');

const stopId = (stop) => String(stop?._id || '');

const isMovingOppositeDirection = (route, location) => {
  if (!location || Number(location.speed) < 2 || !Number.isFinite(Number(location.heading))) return false;
  const coordinates = route?.coordinates || [];
  const currentIndex = routeIndexFor(route, location);
  if (currentIndex < 0 || currentIndex >= coordinates.length - 1) return false;

  const current = coordinates[currentIndex];
  const next = coordinates[currentIndex + 1];
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const toDegrees = (radians) => (radians * 180) / Math.PI;
  const deltaLongitude = toRadians(next.longitude - current.longitude);
  const y = Math.sin(deltaLongitude) * Math.cos(toRadians(next.latitude));
  const x =
    Math.cos(toRadians(current.latitude)) * Math.sin(toRadians(next.latitude)) -
    Math.sin(toRadians(current.latitude)) *
      Math.cos(toRadians(next.latitude)) *
      Math.cos(deltaLongitude);
  const routeHeading = (toDegrees(Math.atan2(y, x)) + 360) % 360;
  const headingDifference = Math.abs(((Number(location.heading) - routeHeading + 540) % 360) - 180);
  return headingDifference > 135;
};

const routeIndexFor = (route, point) => {
  const coordinates = route?.coordinates || [];
  if (!coordinates.length || !point) return -1;

  let closestIndex = -1;
  let closestDistance = Infinity;
  coordinates.forEach((coordinate, index) => {
    const distance = calculateDistanceKm(
      point.latitude,
      point.longitude,
      coordinate.latitude,
      coordinate.longitude
    );
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });
  return closestIndex;
};

const stopRouteIndex = (route, stop) => {
  if (!route?.coordinates?.length) {
    return Number.isFinite(stop.order) ? stop.order : -1;
  }
  return routeIndexFor(route, stop);
};

const resolveDestinationIndex = (route, destinationStopId) => {
  const stops = [...(route?.stops || [])].sort((a, b) => a.order - b.order);
  const index = stops.findIndex((stop) =>
    stopId(stop) === destinationStopId ||
    stop.placeId === destinationStopId
  );
  return index;
};

const getTripStopCandidates = ({
  route,
  location,
  passengerLat,
  passengerLng,
  destinationStopId,
  boardingStopId,
  radiusKm,
}) => {
  const stops = [...(route?.stops || [])].sort((a, b) => a.order - b.order);
  const destinationIndex = resolveDestinationIndex(route, destinationStopId);
  if (destinationIndex < 0) return { candidates: [], nearestStops: [] };

  if (isMovingOppositeDirection(route, location)) {
    return { candidates: [], nearestStops: [] };
  }

  const busRouteIndex = routeIndexFor(route, location);
  const boardingStops = stops.slice(0, destinationIndex).map((stop, index) => ({
    stop,
    stopIndex: index,
    distanceKm: calculateDistanceKm(
      passengerLat,
      passengerLng,
      stop.latitude,
      stop.longitude
    ),
  }));
  const notPassedStops = boardingStops.filter(({ stop }) => {
    if (!location || busRouteIndex < 0 || !route.coordinates?.length) return true;
    return stopRouteIndex(route, stop) >= busRouteIndex;
  });

  const nearestStops = notPassedStops
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 5)
    .map(({ stop, distanceKm }) => {
      const stopData = typeof stop.toObject === 'function' ? stop.toObject() : stop;
      return {
        ...stopData,
        distanceKm,
        routeId: route._id,
        routeName: route.routeName,
        routeNumber: route.routeNumber,
      };
    });

  const candidates = notPassedStops.filter(({ stop, distanceKm }) => {
    const matchesManualStop = !boardingStopId || stopId(stop) === boardingStopId;
    const closeEnough = Boolean(boardingStopId) || distanceKm <= radiusKm;
    return matchesManualStop && closeEnough;
  });

  return {
    candidates: candidates.map(({ stop, distanceKm, stopIndex }) => ({
      boardingStop: stop,
      boardingStopIndex: stopIndex,
      destinationStop: stops[destinationIndex],
      destinationStopIndex: destinationIndex,
      distanceKm,
    })),
    nearestStops,
  };
};

module.exports = {
  getTripStopCandidates,
  isMovingOppositeDirection,
  routeIndexFor,
  resolveDestinationIndex,
};
