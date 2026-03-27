// src/controllers/sessionController.js
const { v4: uuidv4 } = require('uuid');
const { body }       = require('express-validator');
const { query, withTransaction } = require('../config/db');
const { sendSessionReminder }    = require('../services/emailService');
const logger = require('../config/logger');

const createRules = [
  body('scheduled_at').isISO8601().withMessage('Valid date/time required'),
  body('session_type').isIn(['Assessment','Check-in','Review','Crisis','Family Meeting']),
  body('notes').optional().isString().isLength({ max: 1000 }),
];

// ── List sessions for a patient ───────────────────────────────────────────────
async function listSessions(req, res, next) {
  try {
    const { status } = req.query;
    let where = 'WHERE s.patient_id = $1 AND s.doctor_id = $2';
    const params = [req.params.patientId, req.user.id];
    if (status) { where += ` AND s.status = $3`; params.push(status); }

    const result = await query(
      `SELECT s.*, p.name AS patient_name
       FROM scheduled_sessions s
       JOIN patients p ON p.id = s.patient_id
       ${where}
       ORDER BY s.scheduled_at ASC`,
      params
    );
    res.json({ sessions: result.rows });
  } catch (err) { next(err); }
}

// ── List all upcoming sessions across all patients (for dashboard) ─────────────
async function listUpcoming(req, res, next) {
  try {
    const result = await query(
      `SELECT s.*, p.name AS patient_name, p.latest_score, p.risk_level
       FROM scheduled_sessions s
       JOIN patients p ON p.id = s.patient_id
       WHERE s.doctor_id = $1
         AND s.status = 'upcoming'
         AND s.scheduled_at >= NOW()
       ORDER BY s.scheduled_at ASC
       LIMIT 20`,
      [req.user.id]
    );
    res.json({ sessions: result.rows });
  } catch (err) { next(err); }
}

// ── Create session ────────────────────────────────────────────────────────────
async function createSession(req, res, next) {
  try {
    const { scheduled_at, session_type, notes } = req.body;
    const patientId = req.params.patientId;
    const id = uuidv4();

    const result = await query(
      `INSERT INTO scheduled_sessions
         (id, patient_id, doctor_id, scheduled_at, session_type, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [id, patientId, req.user.id, scheduled_at, session_type, notes || null]
    );

    // Send immediate confirmation email
    sendConfirmation(req.user.id, patientId, result.rows[0]).catch(() => {});

    logger.info('Session scheduled', { patientId, sessionId: id, scheduledAt: scheduled_at });
    res.status(201).json({ session: result.rows[0] });
  } catch (err) { next(err); }
}

// ── Update session status ─────────────────────────────────────────────────────
async function updateSession(req, res, next) {
  try {
    const { status, notes } = req.body;
    const result = await query(
      `UPDATE scheduled_sessions s
       SET status       = COALESCE($1, s.status),
           notes        = COALESCE($2, s.notes),
           completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE s.completed_at END,
           updated_at   = NOW()
       FROM patients p
       WHERE s.id = $3 AND s.patient_id = p.id AND s.doctor_id = $4
       RETURNING s.*`,
      [status || null, notes || null, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Session not found' });
    res.json({ session: result.rows[0] });
  } catch (err) { next(err); }
}

// ── Delete session ────────────────────────────────────────────────────────────
async function deleteSession(req, res, next) {
  try {
    const result = await query(
      `DELETE FROM scheduled_sessions
       WHERE id = $1 AND doctor_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Session not found' });
    res.json({ message: 'Session deleted', id: result.rows[0].id });
  } catch (err) { next(err); }
}

// ── Send reminders (called by cron/scheduler) ─────────────────────────────────
async function sendReminders(req, res, next) {
  try {
    // Find sessions due in next 24 hours that haven't had a reminder
    const result = await query(
      `SELECT s.*, p.name AS patient_name, p.latest_score, p.risk_level,
              d.name AS doctor_name, d.email AS doctor_email
       FROM scheduled_sessions s
       JOIN patients p ON p.id = s.patient_id
       JOIN doctors  d ON d.id = s.doctor_id
       WHERE s.status = 'upcoming'
         AND s.reminder_sent = false
         AND s.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'`,
      []
    );

    let sent = 0;
    for (const session of result.rows) {
      try {
        await sendSessionReminder(session);
        await query(
          'UPDATE scheduled_sessions SET reminder_sent = true WHERE id = $1',
          [session.id]
        );
        sent++;
      } catch (e) {
        logger.error('Reminder send failed', { sessionId: session.id, error: e.message });
      }
    }

    logger.info('Reminders processed', { sent, total: result.rows.length });
    res.json({ message: `Sent ${sent} of ${result.rows.length} reminders` });
  } catch (err) { next(err); }
}

async function sendConfirmation(doctorId, patientId, session) {
  try {
    const [dRes, pRes] = await Promise.all([
      query('SELECT name, email FROM doctors  WHERE id = $1', [doctorId]),
      query('SELECT name           FROM patients WHERE id = $1', [patientId]),
    ]);
    await sendSessionReminder({
      ...session,
      doctor_name:  dRes.rows[0]?.name,
      doctor_email: dRes.rows[0]?.email,
      patient_name: pRes.rows[0]?.name,
      isConfirmation: true,
    });
  } catch {}
}

module.exports = { listSessions, listUpcoming, createSession, updateSession, deleteSession, sendReminders, createRules };
