const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

// ── Token generation ─────────────────────────────────────────────────────────
function generateTokens(payload) {
  const access = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    issuer:    'admri-api',
    audience:  'admri-client',
  });
  const refresh = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer:    'admri-api',
    audience:  'admri-client',
  });
  return { access, refresh };
}

// ── Authenticate middleware ───────────────────────────────────────────────────
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer:   'admri-api',
      audience: 'admri-client',
    });
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Role guard ───────────────────────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// ── Ownership guard — doctors can only access their own patients ─────────────
function ownPatient(patientIdParam = 'patientId') {
  return async (req, res, next) => {
    const { query } = require('../config/db');
    const patientId = req.params[patientIdParam];
    if (!patientId) return next();
    try {
      const result = await query(
        'SELECT doctor_id FROM patients WHERE id = $1 AND deleted_at IS NULL',
        [patientId]
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      if (result.rows[0].doctor_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied — not your patient' });
      }
      next();
    } catch (err) {
      logger.error('ownPatient middleware error', { error: err.message });
      next(err);
    }
  };
}

module.exports = { generateTokens, authenticate, requireRole, ownPatient };
