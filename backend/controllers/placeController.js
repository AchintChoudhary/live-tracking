const { getProvider, searchPlaces } = require('../services/geocodingService');

exports.searchPlaces = async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length < 2 || query.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be between 2 and 150 characters',
      });
    }
    if (getProvider() === 'none') {
      return res.status(503).json({
        success: false,
        message: 'Place search is not configured. Set Google Places credentials or a self-hosted Nominatim URL.',
      });
    }
    const places = await searchPlaces(query);
    if (places === null) {
      return res.status(503).json({ success: false, message: 'Place search is not configured' });
    }
    res.json({ success: true, count: places.length, data: places });
  } catch (error) {
    next(error);
  }
};
