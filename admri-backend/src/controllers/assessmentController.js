const { v4: uuidv4 } = require('uuid');
const { body } = require('express-validator');
const { query, withTransaction } = require('../config/db');
const { sendRiskSpikeAlert } = require('../services/emailService');
const logger = require('../config/logger');

const SPIKE_THRESHOLD = parseInt(process.env.RISK_SPIKE_THRESHOLD || '15');

// ── Validation ───────────────────────────────────────────────────────────────
const createRules = [
  body('admri_score').isFloat({ min: 0, max: 100 }).withMessage('Score must be 0-100'),
  body('adaptive_score').optional().isFloat({ min: 0, max: 100 }),
  body('risk_level').isIn(['Minimal', 'Mild', 'Moderate', 'High', 'Severe']),
  body('quest_score').optional().isFloat({ min: 0, max: 100 }),
  body('sentiment_score').optional().isFloat({ min: 0, max: 100 }),
  body('behavioural_score').optional().isFloat({ min: 0, max: 100 }),
  body('confidence_mean').optional().isFloat({ min: 0, max: 100 }),
  body('confidence_lower').optional().isFloat({ min: 0, max: 100 }),
  body('confidence_upper').optional().isFloat({ min: 0, max: 100 }),
  body('confidence_label').optional().isIn(['High', 'Moderate', 'Low']),
  body('journal_text').optional().isString().isLength({ max: 5000 }),
  body('quest_answers').optional().isObject(),
  body('behavioral_data').optional().isObject(),
  body('domain_profile').optional().isObject(),
  body('forecast').optional().isObject(),
  body('model_scores').optional().isObject(),
  body('crisis_flags').optional().isArray(),
  body('dominant_emotion').optional().isString(),
];

// ── Create assessment ────────────────────────────────────────────────────────
async function createAssessment(req, res, next) {
  try {
    const patientId = req.params.patientId;
    const {
      admri_score, adaptive_score, risk_level,
      quest_score, sentiment_score, behavioural_score,
      confidence_mean, confidence_lower, confidence_upper, confidence_label,
      journal_text, quest_answers, behavioral_data, domain_profile,
      forecast, model_scores, crisis_flags, dominant_emotion,
    } = req.body;

    const anomalyResult = await detectAnomaly(patientId, admri_score);
    const id = uuidv4();

    const assessment = await withTransaction(async (client) => {
      // Insert assessment
      const result = await client.query(
        `INSERT INTO assessments (
           id, patient_id, admri_score, adaptive_score, risk_level,
           quest_score, sentiment_score, behavioural_score,
           confidence_mean, confidence_lower, confidence_upper, confidence_label,
           journal_text, quest_answers, behavioral_data, domain_profile,
           forecast, model_scores, crisis_flags, dominant_emotion,
           anomaly_detected, anomaly_delta, anomaly_z_score
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
         ) RETURNING *`,
        [
          id, patientId, admri_score, adaptive_score || null, risk_level,
          quest_score || null, sentiment_score || null, behavioural_score || null,
          confidence_mean || null, confidence_lower || null, confidence_upper || null, confidence_label || null,
          journal_text || null,
          quest_answers ? JSON.stringify(quest_answers) : null,
          behavioral_data ? JSON.stringify(behavioral_data) : null,
          domain_profile ? JSON.stringify(domain_profile) : null,
          forecast ? JSON.stringify(forecast) : null,
          model_scores ? JSON.stringify(model_scores) : null,
          crisis_flags ? JSON.stringify(crisis_flags) : null,
          dominant_emotion || null,
          anomalyResult.detected, anomalyResult.delta, anomalyResult.zScore,
        ]
      );

      // Update patient's latest score + risk history array
      await client.query(
        `UPDATE patients SET
           latest_score = $1,
           risk_level   = $2,
           risk_history = (
             SELECT COALESCE(
               array_append(
                 (SELECT risk_history FROM patients WHERE id = $3)::integer[],
                 $1::integer
               ),
               ARRAY[$1::integer]
             )
           ),
           last_assessment_at = NOW(),
           updated_at = NOW()
         WHERE id = $3`,
        [Math.round(admri_score), risk_level, patientId]
      );

      return result.rows[0];
    });

    // Fire risk spike alert outside transaction
    if (anomalyResult.detected && anomalyResult.delta >= SPIKE_THRESHOLD) {
      triggerRiskAlert(patientId, req.user.id, assessment, anomalyResult).catch(() => {});
    }

    logger.info('Assessment created', { patientId, score: admri_score, riskLevel: risk_level });
    res.status(201).json({ assessment });
  } catch (err) {
    next(err);
  }
}

// ── List assessments for a patient ───────────────────────────────────────────
async function listAssessments(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await query(
      'SELECT COUNT(*) FROM assessments WHERE patient_id = $1',
      [req.params.patientId]
    );

    const result = await query(
      `SELECT id, admri_score, adaptive_score, risk_level,
              quest_score, sentiment_score, behavioural_score,
              confidence_mean, confidence_lower, confidence_upper, confidence_label,
              anomaly_detected, anomaly_delta, anomaly_z_score,
              dominant_emotion, crisis_flags,
              created_at
       FROM assessments
       WHERE patient_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.patientId, parseInt(limit), offset]
    );

    res.json({
      assessments: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── Get single assessment with full snapshot ─────────────────────────────────
async function getAssessment(req, res, next) {
  try {
    const result = await query(
      `SELECT a.*
       FROM assessments a
       JOIN patients p ON p.id = a.patient_id
       WHERE a.id = $1 AND p.doctor_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Assessment not found' });
    res.json({ assessment: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// ── Delete assessment ─────────────────────────────────────────────────────────
async function deleteAssessment(req, res, next) {
  try {
    const result = await query(
      `DELETE FROM assessments a
       USING patients p
       WHERE a.id = $1 AND a.patient_id = p.id AND p.doctor_id = $2
       RETURNING a.id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Assessment not found' });
    res.json({ message: 'Assessment deleted', id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
}

// ── Anomaly detection ────────────────────────────────────────────────────────
async function detectAnomaly(patientId, newScore) {
  try {
    const result = await query(
      `SELECT admri_score FROM assessments
       WHERE patient_id = $1
       ORDER BY created_at DESC LIMIT 7`,
      [patientId]
    );
    if (result.rows.length < 2) return { detected: false, delta: 0, zScore: 0 };

    const scores = result.rows.map(r => parseFloat(r.admri_score));
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const std  = Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length);
    const prev = scores[0];
    const delta = Math.round(newScore - prev);
    const zScore = std > 0 ? parseFloat(((newScore - mean) / std).toFixed(2)) : 0;
    const detected = Math.abs(delta) >= SPIKE_THRESHOLD || Math.abs(zScore) >= 2.0;

    return { detected, delta, zScore };
  } catch {
    return { detected: false, delta: 0, zScore: 0 };
  }
}

// ── Send alert email ─────────────────────────────────────────────────────────
async function triggerRiskAlert(patientId, doctorId, assessment, anomaly) {
  try {
    const [pResult, dResult] = await Promise.all([
      query('SELECT id, name, age, gender, diagnosis FROM patients WHERE id = $1', [patientId]),
      query('SELECT id, name, email FROM doctors WHERE id = $1', [doctorId]),
    ]);
    const patient = pResult.rows[0];
    const doctor  = dResult.rows[0];
    if (!patient || !doctor) return;

    const previousScore = Math.round(assessment.admri_score - anomaly.delta);

    await sendRiskSpikeAlert({
      doctor,
      patient,
      previousScore,
      newScore:     Math.round(assessment.admri_score),
      delta:        anomaly.delta,
      assessmentId: assessment.id,
    });

    // Log alert in DB
    await query(
      `INSERT INTO alert_logs (patient_id, doctor_id, assessment_id, previous_score, new_score, delta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [patientId, doctorId, assessment.id, previousScore, Math.round(assessment.admri_score), anomaly.delta]
    );
  } catch (err) {
    logger.error('Failed to send risk alert', { error: err.message });
  }
}

// ── Alert history ────────────────────────────────────────────────────────────
async function getAlertHistory(req, res, next) {
  try {
    const result = await query(
      `SELECT al.*, p.name AS patient_name
       FROM alert_logs al
       JOIN patients p ON p.id = al.patient_id
       WHERE al.doctor_id = $1
       ORDER BY al.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ alerts: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAssessment, listAssessments, getAssessment,
  deleteAssessment, getAlertHistory, createRules,
};
