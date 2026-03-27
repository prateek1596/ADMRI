// src/controllers/goalController.js
const { v4: uuidv4 } = require('uuid');
const { body }       = require('express-validator');
const { query }      = require('../config/db');
const logger         = require('../config/logger');

const createRules = [
  body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title required'),
  body('category').isIn(['Risk Score','PHQ-9','GAD-7','Sleep','Social','Behavioural','Custom']),
  body('target_value').optional().isNumeric(),
  body('baseline_value').optional().isNumeric(),
  body('target_date').optional().isISO8601(),
  body('priority').optional().isIn([1, 2, 3]),
  body('description').optional().isString().isLength({ max: 1000 }),
];

// ── List goals for a patient ──────────────────────────────────────────────────
async function listGoals(req, res, next) {
  try {
    const result = await query(
      `SELECT g.*,
         (SELECT json_agg(gp ORDER BY gp.recorded_at ASC)
          FROM goal_progress gp WHERE gp.goal_id = g.id) AS progress_log
       FROM treatment_goals g
       WHERE g.patient_id = $1 AND g.doctor_id = $2
       ORDER BY g.priority ASC, g.created_at DESC`,
      [req.params.patientId, req.user.id]
    );
    res.json({ goals: result.rows });
  } catch (err) { next(err); }
}

// ── Create goal ───────────────────────────────────────────────────────────────
async function createGoal(req, res, next) {
  try {
    const { title, description, category, target_value, baseline_value,
            target_date, priority } = req.body;
    const id = uuidv4();

    const result = await query(
      `INSERT INTO treatment_goals
         (id, patient_id, doctor_id, title, description, category,
          target_value, baseline_value, current_value, target_date, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10)
       RETURNING *`,
      [id, req.params.patientId, req.user.id, title, description || null,
       category, target_value || null, baseline_value || null,
       target_date || null, priority || 2]
    );

    // Auto-log first progress point at baseline
    if (baseline_value != null) {
      await query(
        `INSERT INTO goal_progress (goal_id, value, note)
         VALUES ($1, $2, 'Baseline recorded')`,
        [id, baseline_value]
      );
    }

    logger.info('Goal created', { patientId: req.params.patientId, goalId: id });
    res.status(201).json({ goal: result.rows[0] });
  } catch (err) { next(err); }
}

// ── Update goal ───────────────────────────────────────────────────────────────
async function updateGoal(req, res, next) {
  try {
    const { title, description, status, target_value, target_date, current_value, priority } = req.body;
    const result = await query(
      `UPDATE treatment_goals
       SET title         = COALESCE($1, title),
           description   = COALESCE($2, description),
           status        = COALESCE($3, status),
           target_value  = COALESCE($4, target_value),
           target_date   = COALESCE($5, target_date),
           current_value = COALESCE($6, current_value),
           priority      = COALESCE($7, priority),
           updated_at    = NOW()
       WHERE id = $8 AND patient_id = $9 AND doctor_id = $10
       RETURNING *`,
      [title, description, status, target_value, target_date,
       current_value, priority, req.params.id, req.params.patientId, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Goal not found' });
    res.json({ goal: result.rows[0] });
  } catch (err) { next(err); }
}

// ── Log progress ──────────────────────────────────────────────────────────────
async function logProgress(req, res, next) {
  try {
    const { value, note } = req.body;
    if (value == null) return res.status(400).json({ error: 'Value required' });

    // Verify ownership
    const goalRes = await query(
      'SELECT id, target_value, status FROM treatment_goals WHERE id = $1 AND doctor_id = $2',
      [req.params.id, req.user.id]
    );
    if (!goalRes.rows.length) return res.status(404).json({ error: 'Goal not found' });

    const goal = goalRes.rows[0];

    // Insert progress point
    const progResult = await query(
      `INSERT INTO goal_progress (goal_id, value, note) VALUES ($1,$2,$3) RETURNING *`,
      [goal.id, value, note || null]
    );

    // Update current_value on goal, auto-achieve if target met
    const achieved = goal.target_value != null && parseFloat(value) <= parseFloat(goal.target_value);
    await query(
      `UPDATE treatment_goals
       SET current_value = $1,
           status = CASE WHEN $2 AND status = 'active' THEN 'achieved' ELSE status END,
           updated_at = NOW()
       WHERE id = $3`,
      [value, achieved, goal.id]
    );

    res.status(201).json({
      progress: progResult.rows[0],
      achieved,
    });
  } catch (err) { next(err); }
}

// ── Delete goal ───────────────────────────────────────────────────────────────
async function deleteGoal(req, res, next) {
  try {
    const result = await query(
      `DELETE FROM treatment_goals
       WHERE id = $1 AND patient_id = $2 AND doctor_id = $3
       RETURNING id`,
      [req.params.id, req.params.patientId, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Goal not found' });
    res.json({ message: 'Goal deleted' });
  } catch (err) { next(err); }
}

// ── Auto-suggest goals based on latest assessment ─────────────────────────────
async function suggestGoals(req, res, next) {
  try {
    const patientRes = await query(
      `SELECT p.*, a.admri_score, a.quest_score, a.sentiment_score, a.behavioural_score
       FROM patients p
       LEFT JOIN assessments a ON a.id = (
         SELECT id FROM assessments WHERE patient_id = p.id ORDER BY created_at DESC LIMIT 1
       )
       WHERE p.id = $1 AND p.doctor_id = $2`,
      [req.params.patientId, req.user.id]
    );

    if (!patientRes.rows.length) return res.status(404).json({ error: 'Patient not found' });
    const p = patientRes.rows[0];
    const suggestions = generateSuggestions(p);

    res.json({ suggestions });
  } catch (err) { next(err); }
}

function generateSuggestions(patient) {
  const suggestions = [];
  const score = parseFloat(patient.admri_score || 0);
  const quest = parseFloat(patient.quest_score || 0);
  const sent  = parseFloat(patient.sentiment_score || 0);
  const beh   = parseFloat(patient.behavioural_score || 0);

  if (score >= 61) {
    suggestions.push({
      title: `Reduce overall ADMRI risk score to below 60`,
      category: 'Risk Score',
      baseline_value: Math.round(score),
      target_value: 55,
      priority: 1,
      description: 'Primary treatment goal — reduce overall risk to moderate range through combined CBT and behavioural interventions.',
    });
  }
  if (quest >= 50) {
    suggestions.push({
      title: 'Reduce PHQ-9/questionnaire score by 40%',
      category: 'PHQ-9',
      baseline_value: Math.round(quest),
      target_value: Math.round(quest * 0.6),
      priority: 1,
      description: 'Target significant reduction in self-reported mood and anxiety symptoms through structured CBT.',
    });
  }
  if (sent <= 40) {
    suggestions.push({
      title: 'Improve emotional sentiment in journaling to 60+',
      category: 'Social',
      baseline_value: Math.round(sent),
      target_value: 60,
      priority: 2,
      description: 'Increase positive emotional expression and reduce negative cognitive distortions through thought records and behavioural activation.',
    });
  }
  if (beh <= 45) {
    suggestions.push({
      title: 'Improve behavioural engagement score to 65',
      category: 'Behavioural',
      baseline_value: Math.round(beh),
      target_value: 65,
      priority: 2,
      description: 'Increase daily structured activities, sleep hygiene, and social interactions through a behavioural activation plan.',
    });
  }
  suggestions.push({
    title: 'Establish consistent sleep routine (8 hrs/night)',
    category: 'Sleep',
    target_value: 8,
    priority: 3,
    description: 'Implement sleep restriction therapy and consistent wake time to regularise circadian rhythm.',
  });

  return suggestions;
}

module.exports = { listGoals, createGoal, updateGoal, logProgress, deleteGoal, suggestGoals, createRules };
