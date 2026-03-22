const { validationResult } = require('express-validator');
const logger = require('../config/logger');

// ── Validation result checker ────────────────────────────────────────────────
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error:  'Validation failed',
      fields: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// ── Global error handler ─────────────────────────────────────────────────────
function errorHandler(err, req, res, next) {
  // PostgreSQL constraint violations
  if (err.code === '23505') {
    const field = err.detail?.match(/Key \((.+)\)/)?.[1] || 'field';
    return res.status(409).json({ error: `Duplicate value for ${field}` });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }
  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Invalid UUID format' });
  }

  logger.error('Unhandled error', {
    message: err.message,
    stack:   err.stack,
    url:     req.originalUrl,
    method:  req.method,
    userId:  req.user?.id,
  });

  const status  = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(status).json({ error: message });
}

// ── 404 handler ──────────────────────────────────────────────────────────────
function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}

// ── Audit log middleware ─────────────────────────────────────────────────────
function auditLog(action) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = async function (body) {
      if (res.statusCode < 400 && req.user?.id) {
        try {
          const { query } = require('../config/db');
          await query(
            `INSERT INTO audit_logs (doctor_id, action, resource, resource_id, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              req.user.id,
              action,
              req.baseUrl.split('/').pop(),
              req.params.id || req.params.patientId || null,
              req.ip,
              req.headers['user-agent']?.slice(0, 255),
            ]
          );
        } catch (e) {
          logger.error('Audit log write failed', { error: e.message });
        }
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { validate, errorHandler, notFound, auditLog };
