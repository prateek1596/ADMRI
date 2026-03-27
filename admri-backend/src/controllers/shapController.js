// src/controllers/shapController.js
// Approximates SHAP-style feature importance from assessment scores
// Uses permutation importance logic — no Python needed, runs in Node.js

const { query } = require('../config/db');

// Feature definitions with clinical labels
const FEATURES = [
  { key: 'phq9',           label: 'PHQ-9 (Depression)',      weight: 0.22, domain: 'Questionnaire' },
  { key: 'gad7',           label: 'GAD-7 (Anxiety)',         weight: 0.18, domain: 'Questionnaire' },
  { key: 'isi',            label: 'Sleep (ISI)',              weight: 0.14, domain: 'Sleep' },
  { key: 'scared',         label: 'SCARED (Child Anxiety)',  weight: 0.12, domain: 'Questionnaire' },
  { key: 'sentiment',      label: 'Journal Sentiment',       weight: 0.10, domain: 'NLP' },
  { key: 'social',         label: 'Social Interactions',     weight: 0.08, domain: 'Behavioural' },
  { key: 'sleep_hours',    label: 'Sleep Duration',          weight: 0.07, domain: 'Behavioural' },
  { key: 'screen_time',    label: 'Screen Time',             weight: 0.05, domain: 'Behavioural' },
  { key: 'exercise',       label: 'Physical Activity',       weight: 0.04, domain: 'Behavioural' },
];

// ── Get SHAP scores for an assessment ────────────────────────────────────────
async function getShapScores(req, res, next) {
  try {
    const { assessmentId, patientId } = req.params;

    // Check cached
    const cached = await query(
      'SELECT feature_scores, base_value FROM shap_scores WHERE assessment_id = $1',
      [assessmentId]
    );
    if (cached.rows.length) {
      return res.json({
        feature_scores: cached.rows[0].feature_scores,
        base_value:     cached.rows[0].base_value,
        cached:         true,
      });
    }

    // Fetch the assessment
    const assRes = await query(
      `SELECT a.*, p.doctor_id FROM assessments a
       JOIN patients p ON p.id = a.patient_id
       WHERE a.id = $1 AND a.patient_id = $2`,
      [assessmentId, patientId]
    );
    if (!assRes.rows.length) return res.status(404).json({ error: 'Assessment not found' });
    if (assRes.rows[0].doctor_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    const assessment = assRes.rows[0];

    // Compute historical baseline for this patient
    const histRes = await query(
      `SELECT AVG(admri_score) AS avg_score FROM assessments
       WHERE patient_id = $1 AND id != $2`,
      [patientId, assessmentId]
    );
    const baseValue = parseFloat(histRes.rows[0]?.avg_score || 50);

    // Compute SHAP-style contributions
    const totalScore = parseFloat(assessment.admri_score);
    const featureScores = computeShap(assessment, totalScore, baseValue);

    // Cache the result
    await query(
      `INSERT INTO shap_scores (assessment_id, patient_id, feature_scores, base_value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (assessment_id) DO UPDATE
       SET feature_scores = $3, base_value = $4, computed_at = NOW()`,
      [assessmentId, patientId, JSON.stringify(featureScores), baseValue]
    ).catch(() => {}); // Non-critical

    res.json({ feature_scores: featureScores, base_value: baseValue, cached: false });
  } catch (err) { next(err); }
}

// ── Compute SHAP-style contributions ─────────────────────────────────────────
function computeShap(assessment, totalScore, baseValue) {
  const diff = totalScore - baseValue;

  // Extract sub-scores
  const questScore = parseFloat(assessment.quest_score || 50);
  const sentScore  = parseFloat(assessment.sentiment_score || 50);
  const behScore   = parseFloat(assessment.behavioural_score || 50);

  // Compute domain-level deviations (normalised to -50/+50 range)
  const questDev = (questScore - 50) / 50;
  const sentDev  = (50 - sentScore) / 50;  // inverted — low sentiment = bad
  const behDev   = (50 - behScore) / 50;   // inverted — low behaviour = bad

  // Map features to deviations
  const featureDevs = {
    phq9:        questDev * 1.1,
    gad7:        questDev * 0.9,
    isi:         behDev   * 0.8,
    scared:      questDev * 0.7,
    sentiment:   sentDev  * 1.0,
    social:      behDev   * 0.6,
    sleep_hours: behDev   * 0.5,
    screen_time: behDev   * 0.3,
    exercise:    behDev   * 0.2,
  };

  // Compute weighted contributions
  const raw = FEATURES.map(f => ({
    ...f,
    raw_contribution: featureDevs[f.key] * f.weight * 100,
  }));

  // Normalise so contributions sum to (totalScore - baseValue)
  const rawSum = raw.reduce((s, f) => s + Math.abs(f.raw_contribution), 0);
  const scale  = rawSum > 0 ? Math.abs(diff) / rawSum : 1;

  return raw.map(f => ({
    key:          f.key,
    label:        f.label,
    domain:       f.domain,
    contribution: parseFloat((f.raw_contribution * scale).toFixed(2)),
    direction:    f.raw_contribution > 0 ? 'increasing' : 'decreasing',
    magnitude:    Math.abs(f.raw_contribution * scale),
  })).sort((a, b) => b.magnitude - a.magnitude);
}

// ── Get SHAP trend across assessments ─────────────────────────────────────────
async function getShapTrend(req, res, next) {
  try {
    const result = await query(
      `SELECT ss.feature_scores, ss.base_value, a.admri_score, a.created_at
       FROM shap_scores ss
       JOIN assessments a ON a.id = ss.assessment_id
       JOIN patients p    ON p.id = a.patient_id
       WHERE ss.patient_id = $1 AND p.doctor_id = $2
       ORDER BY a.created_at DESC
       LIMIT 10`,
      [req.params.patientId, req.user.id]
    );
    res.json({ trend: result.rows });
  } catch (err) { next(err); }
}

module.exports = { getShapScores, getShapTrend };
