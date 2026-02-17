const log = require('../logger');

module.exports = (err, req, res, _next) => {
  log.error(`${req.method} ${req.url}:`, err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
};
