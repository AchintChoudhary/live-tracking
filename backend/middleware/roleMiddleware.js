/**
 * Restricts access to specified user roles (e.g. 'driver', 'passenger', 'admin')
 * @param  {...string} roles Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before checking role permissions',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role forbidden: '${req.user.role}' is not authorized to access this resource. Allowed: [${roles.join(', ')}]`,
      });
    }

    next();
  };
};

module.exports = { authorize };
