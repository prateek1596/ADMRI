const { v4: uuidv4 } = require('uuid');
const { body, query: queryValidator } = require('express-validator');
const { query, withTransaction } = require('../config/db');
const logger = require('../config/logger');

// ── Validation rules ─────────────────────────────────────────────────────────
const createRules = [
  body('name').trim().isLength({ min: 2, max: 150 }).withMessage('Name required (2-150 chars)'),
  body('age').isInt({ min: 4, max: 25 }).withMessage('Age must be between 4 and 25'),
  body('gender').isIn(['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say']).withMessage('Invalid gender'),
  body('diagnosis').optional().trim().isLength({ max: 255 }),
  body('guardian').optional().trim().isLength({ max: 150 }),
  body('contact').optional().trim().isLength({ max: 50 }),
  body('notes').optional().trim().isLength({ max: 2000 }),
];

const updateRules = [
  body('name').optional().trim().isLength({ min: 2, max: 150 }),
  body('age').optional().isInt({ min: 4, max: 25 }),
  body('gender').optional().isIn(['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say']),
  body('diagnosis').optional().trim().isLength({ max: 255 }),
  body('guardian').optional().trim().isLength({ max: 150 }),
  body('contact').optional().trim().isLength({ max: 50 }),
];

// ── List patients ────────────────────────────────────────────────────────────
async function listPatients(req, res, next) {
  try {
    const {
      search = '', page = 1, limit = 20,
      sort = 'created_at', order = 'desc',
      risk_level,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const allowedSort = ['name', 'age', 'created_at', 'latest_score', 'last_assessment_at'];
    const sortCol = allowedSort.includes(sort) ? sort : 'created_at';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';

    let whereClause = 'WHERE p.doctor_id = $1 AND p.deleted_at IS NULL';
    const params = [req.user.id];
    let paramIdx = 2;

    if (search) {
      whereClause += ` AND (p.name ILIKE $${paramIdx} OR p.diagnosis ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (risk_level) {
      const ranges = {
        minimal: [0, 20], mild: [21, 40], moderate: [41, 60], high: [61, 75], severe: [76, 100],
      };
      const r = ranges[risk_level.toLowerCase()];
      if (r) {
        whereClause += ` AND p.latest_score BETWEEN $${paramIdx} AND $${paramIdx + 1}`;
        params.push(r[0], r[1]);
        paramIdx += 2;
      }
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM patients p ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT p.id, p.name, p.age, p.gender, p.diagnosis, p.guardian, p.contact,
              p.latest_score, p.risk_history, p.last_assessment_at,
              p.join_date, p.created_at,
              COUNT(DISTINCT n.id) AS note_count,
              COUNT(DISTINCT a.id) AS assessment_count
       FROM patients p
       LEFT JOIN notes n ON n.patient_id = p.id AND n.deleted_at IS NULL
       LEFT JOIN assessments a ON a.patient_id = p.id
       ${whereClause}
       GROUP BY p.id
       ORDER BY p.${sortCol} ${sortDir} NULLS LAST
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      patients:   result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    next(err);
  }
}

// ── Get single patient ───────────────────────────────────────────────────────
async function getPatient(req, res, next) {
  try {
    const result = await query(
      `SELECT p.*,
              COUNT(DISTINCT n.id) AS note_count,
              COUNT(DISTINCT a.id) AS assessment_count,
              MAX(a.created_at) AS last_assessment_at
       FROM patients p
       LEFT JOIN notes n ON n.patient_id = p.id AND n.deleted_at IS NULL
       LEFT JOIN assessments a ON a.patient_id = p.id
       WHERE p.id = $1 AND p.doctor_id = $2 AND p.deleted_at IS NULL
       GROUP BY p.id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Patient not found' });
    res.json({ patient: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// ── Create patient ───────────────────────────────────────────────────────────
async function createPatient(req, res, next) {
  try {
    const { name, age, gender, diagnosis, guardian, contact, notes } = req.body;
    const id = uuidv4();

    const result = await query(
      `INSERT INTO patients (id, doctor_id, name, age, gender, diagnosis, guardian, contact, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, req.user.id, name, age, gender, diagnosis || null, guardian || null, contact || null, notes || null]
    );

    logger.info('Patient created', { doctorId: req.user.id, patientId: id });
    res.status(201).json({ patient: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// ── Update patient ───────────────────────────────────────────────────────────
async function updatePatient(req, res, next) {
  try {
    const fields = ['name', 'age', 'gender', 'diagnosis', 'guardian', 'contact', 'notes'];
    const updates = [];
    const params = [];
    let idx = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx}`);
        params.push(req.body[field]);
        idx++;
      }
    }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(req.params.id);
    const result = await query(
      `UPDATE patients SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${idx} AND doctor_id = $${idx + 1} AND deleted_at IS NULL
       RETURNING *`,
      [...params, req.user.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Patient not found' });
    res.json({ patient: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// ── Soft-delete patient ──────────────────────────────────────────────────────
async function deletePatient(req, res, next) {
  try {
    const result = await query(
      `UPDATE patients SET deleted_at = NOW()
       WHERE id = $1 AND doctor_id = $2 AND deleted_at IS NULL
       RETURNING id, name`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Patient not found' });
    logger.info('Patient deleted', { doctorId: req.user.id, patientId: req.params.id });
    res.json({ message: `Patient ${result.rows[0].name} deleted`, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
}

// ── Get risk history ─────────────────────────────────────────────────────────
async function getRiskHistory(req, res, next) {
  try {
    const result = await query(
      `SELECT a.id, a.admri_score, a.adaptive_score, a.risk_level,
              a.quest_score, a.sentiment_score, a.behavioural_score,
              a.confidence_mean, a.confidence_lower, a.confidence_upper,
              a.anomaly_detected, a.anomaly_delta, a.created_at
       FROM assessments a
       JOIN patients p ON p.id = a.patient_id
       WHERE a.patient_id = $1 AND p.doctor_id = $2
       ORDER BY a.created_at ASC`,
      [req.params.id, req.user.id]
    );
    res.json({ history: result.rows });
  } catch (err) {
    next(err);
  }
}

// ── Dashboard stats ──────────────────────────────────────────────────────────
async function getDashboardStats(req, res, next) {
  try {
    const doctorId = req.user.id;

    const [patients, highRisk, avgScore, recentNotes, riskDist, trend] = await Promise.all([
      query('SELECT COUNT(*) FROM patients WHERE doctor_id = $1 AND deleted_at IS NULL', [doctorId]),
      query(`SELECT COUNT(*) FROM patients WHERE doctor_id = $1 AND deleted_at IS NULL AND latest_score >= 61`, [doctorId]),
      query(`SELECT ROUND(AVG(latest_score)::numeric, 1) as avg FROM patients WHERE doctor_id = $1 AND deleted_at IS NULL AND latest_score IS NOT NULL`, [doctorId]),
      query(`SELECT COUNT(*) FROM notes n JOIN patients p ON p.id = n.patient_id
             WHERE p.doctor_id = $1 AND n.created_at > NOW() - INTERVAL '7 days' AND n.deleted_at IS NULL`, [doctorId]),
      query(`SELECT
               SUM(CASE WHEN latest_score BETWEEN 0  AND 20  THEN 1 ELSE 0 END) AS minimal,
               SUM(CASE WHEN latest_score BETWEEN 21 AND 40  THEN 1 ELSE 0 END) AS mild,
               SUM(CASE WHEN latest_score BETWEEN 41 AND 60  THEN 1 ELSE 0 END) AS moderate,
               SUM(CASE WHEN latest_score BETWEEN 61 AND 75  THEN 1 ELSE 0 END) AS high,
               SUM(CASE WHEN latest_score BETWEEN 76 AND 100 THEN 1 ELSE 0 END) AS severe
             FROM patients WHERE doctor_id = $1 AND deleted_at IS NULL AND latest_score IS NOT NULL`, [doctorId]),
      // Last 30 days avg score per day
      query(`SELECT DATE(a.created_at) as date, ROUND(AVG(a.admri_score)::numeric, 1) as avg_score
             FROM assessments a JOIN patients p ON p.id = a.patient_id
             WHERE p.doctor_id = $1 AND a.created_at > NOW() - INTERVAL '30 days'
             GROUP BY DATE(a.created_at) ORDER BY date ASC`, [doctorId]),
    ]);

    res.json({
      stats: {
        total_patients: parseInt(patients.rows[0].count),
        high_risk:       parseInt(highRisk.rows[0].count),
        avg_score:       parseFloat(avgScore.rows[0].avg) || 0,
        notes_this_week: parseInt(recentNotes.rows[0].count),
      },
      risk_distribution: riskDist.rows[0],
      score_trend:       trend.rows,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPatients, getPatient, createPatient, updatePatient, deletePatient,
  getRiskHistory, getDashboardStats, createRules, updateRules,
};
