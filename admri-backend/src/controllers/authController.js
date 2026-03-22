const bcrypt   = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body } = require('express-validator');
const { query } = require('../config/db');
const { generateTokens } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/emailService');
const logger = require('../config/logger');

// ── Validation rules ──────────────────────────────────────────────────────────
const registerRules = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password min 8 chars')
    .matches(/[A-Z]/).withMessage('Password needs uppercase')
    .matches(/[0-9]/).withMessage('Password needs a number'),
  body('specialty').trim().isLength({ min: 2, max: 100 }).withMessage('Specialty required'),
  body('license_number').trim().isLength({ min: 3, max: 50 }).withMessage('License number required'),
];

const loginRules = [
  body('email').trim().isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

// ── Register ──────────────────────────────────────────────────────────────────
async function register(req, res, next) {
  try {
    const { name, email, password, specialty, license_number } = req.body;

    const existing = await query('SELECT id FROM doctors WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();

    const result = await query(
      `INSERT INTO doctors (id, name, email, password_hash, specialty, license_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, specialty, license_number, role, created_at`,
      [id, name, email, passwordHash, specialty, license_number]
    );

    const doctor = result.rows[0];
    const tokens = generateTokens({ id: doctor.id, email: doctor.email, role: doctor.role });

    await query(
      `INSERT INTO refresh_tokens (token, doctor_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [tokens.refresh, doctor.id]
    );

    sendWelcomeEmail({ name: doctor.name, email: doctor.email }).catch(() => {});

    logger.info('Doctor registered', { doctorId: doctor.id, email: doctor.email });
    res.status(201).json({
      message: 'Account created successfully',
      doctor:  { id: doctor.id, name: doctor.name, email: doctor.email, specialty: doctor.specialty, role: doctor.role },
      tokens,
    });
  } catch (err) {
    next(err);
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await query(
      `SELECT id, name, email, password_hash, specialty, license_number, role, is_active
       FROM doctors WHERE email = $1`,
      [email]
    );

    const doctor = result.rows[0];
    const dummyHash = '$2b$12$dummyhashforsecurity000000000000000000000000000';
    const valid = doctor
      ? await bcrypt.compare(password, doctor.password_hash)
      : await bcrypt.compare(password, dummyHash);

    if (!doctor || !valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!doctor.is_active) {
      return res.status(403).json({ error: 'Account deactivated. Contact administrator.' });
    }

    const tokens = generateTokens({ id: doctor.id, email: doctor.email, role: doctor.role });

    await query('DELETE FROM refresh_tokens WHERE doctor_id = $1 AND expires_at < NOW()', [doctor.id]);
    await query(
      `INSERT INTO refresh_tokens (token, doctor_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [tokens.refresh, doctor.id]
    );
    await query('UPDATE doctors SET last_login = NOW() WHERE id = $1', [doctor.id]);

    logger.info('Doctor logged in', { doctorId: doctor.id });
    res.json({
      doctor: { id: doctor.id, name: doctor.name, email: doctor.email, specialty: doctor.specialty, role: doctor.role },
      tokens,
    });
  } catch (err) {
    next(err);
  }
}

// ── Refresh token ─────────────────────────────────────────────────────────────
async function refreshToken(req, res, next) {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'Refresh token required' });

    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET, {
        issuer: 'admri-api', audience: 'admri-client',
      });
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const stored = await query(
      'SELECT id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [refresh_token]
    );
    if (!stored.rows.length) {
      return res.status(401).json({ error: 'Refresh token not found or expired' });
    }

    const doctorResult = await query(
      'SELECT id, email, role, is_active FROM doctors WHERE id = $1',
      [decoded.id]
    );
    const doctor = doctorResult.rows[0];
    if (!doctor || !doctor.is_active) {
      return res.status(401).json({ error: 'Account not found or deactivated' });
    }

    await query('DELETE FROM refresh_tokens WHERE token = $1', [refresh_token]);
    const tokens = generateTokens({ id: doctor.id, email: doctor.email, role: doctor.role });
    await query(
      `INSERT INTO refresh_tokens (token, doctor_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [tokens.refresh, doctor.id]
    );

    res.json({ tokens });
  } catch (err) {
    next(err);
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────
async function logout(req, res, next) {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refresh_token]);
    }
    if (req.body.all_devices) {
      await query('DELETE FROM refresh_tokens WHERE doctor_id = $1', [req.user.id]);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

// ── Get me ────────────────────────────────────────────────────────────────────
async function getMe(req, res, next) {
  try {
    const result = await query(
      `SELECT id, name, email, specialty, license_number, role, created_at, last_login
       FROM doctors WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Doctor not found' });
    res.json({ doctor: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// ── Update profile (name + specialty) ────────────────────────────────────────
async function updateMe(req, res, next) {
  try {
    const { name, specialty } = req.body;
    const result = await query(
      `UPDATE doctors
       SET name      = COALESCE($1, name),
           specialty = COALESCE($2, specialty),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, email, specialty, role`,
      [name || null, specialty || null, req.user.id]
    );
    res.json({ doctor: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// ── Change password ───────────────────────────────────────────────────────────
async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    const result = await query(
      'SELECT password_hash FROM doctors WHERE id = $1',
      [req.user.id]
    );
    const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

    const newHash = await bcrypt.hash(new_password, 12);
    await query(
      'UPDATE doctors SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.user.id]
    );
    await query('DELETE FROM refresh_tokens WHERE doctor_id = $1', [req.user.id]);

    logger.info('Password changed', { doctorId: req.user.id });
    res.json({ message: 'Password updated. Please log in again.' });
  } catch (err) {
    next(err);
  }
}

// ── Change email ──────────────────────────────────────────────────────────────
async function changeEmail(req, res, next) {
  try {
    const { new_email, current_password } = req.body;

    if (!new_email)        return res.status(400).json({ error: 'New email is required' });
    if (!current_password) return res.status(400).json({ error: 'Current password is required' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(new_email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Verify current password
    const doctorRes = await query(
      'SELECT password_hash FROM doctors WHERE id = $1',
      [req.user.id]
    );
    const valid = await bcrypt.compare(current_password, doctorRes.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    // Check new email not already taken
    const existing = await query(
      'SELECT id FROM doctors WHERE email = $1 AND id != $2',
      [new_email.toLowerCase(), req.user.id]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'That email is already registered' });
    }

    // Update email
    await query(
      'UPDATE doctors SET email = $1, updated_at = NOW() WHERE id = $2',
      [new_email.toLowerCase(), req.user.id]
    );

    // Invalidate all sessions — must log in again with new email
    await query('DELETE FROM refresh_tokens WHERE doctor_id = $1', [req.user.id]);

    logger.info('Email changed', { doctorId: req.user.id, newEmail: new_email });
    res.json({ message: 'Email updated. Please log in with your new email.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register, registerRules,
  login, loginRules,
  refreshToken,
  logout,
  getMe,
  updateMe,
  changePassword,
  changeEmail,
};
