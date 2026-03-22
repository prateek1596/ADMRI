const { v4: uuidv4 } = require('uuid');
const { body } = require('express-validator');
const { query } = require('../config/db');

const createRules = [
  body('content').trim().isLength({ min: 1, max: 5000 }).withMessage('Note content required'),
  body('type').isIn(['Session', 'Check-in', 'Crisis', 'Family Meeting', 'Progress', 'Discharge']),
  body('mood').optional().isIn(['Positive', 'Neutral', 'Anxious', 'Depressed', 'Agitated', 'Calm', 'Mixed']),
  body('tags').optional().isArray(),
  body('tags.*').optional().isString().isLength({ max: 50 }),
];

async function listNotes(req, res, next) {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClause = 'WHERE n.patient_id = $1 AND p.doctor_id = $2 AND n.deleted_at IS NULL';
    const params = [req.params.patientId, req.user.id];
    let idx = 3;
    if (type) { whereClause += ` AND n.type = $${idx}`; params.push(type); idx++; }

    const countResult = await query(
      `SELECT COUNT(*) FROM notes n JOIN patients p ON p.id = n.patient_id ${whereClause}`,
      params
    );
    const result = await query(
      `SELECT n.id, n.content, n.type, n.mood, n.tags, n.created_at, n.updated_at
       FROM notes n
       JOIN patients p ON p.id = n.patient_id
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      notes: result.rows,
      pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    next(err);
  }
}

async function createNote(req, res, next) {
  try {
    const { content, type, mood, tags } = req.body;
    const id = uuidv4();
    const result = await query(
      `INSERT INTO notes (id, patient_id, doctor_id, content, type, mood, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, req.params.patientId, req.user.id, content, type, mood || null, tags ? JSON.stringify(tags) : '[]']
    );
    res.status(201).json({ note: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateNote(req, res, next) {
  try {
    const { content, mood, tags } = req.body;
    const result = await query(
      `UPDATE notes n SET
         content    = COALESCE($1, n.content),
         mood       = COALESCE($2, n.mood),
         tags       = COALESCE($3, n.tags),
         updated_at = NOW()
       FROM patients p
       WHERE n.id = $4 AND n.patient_id = p.id AND p.doctor_id = $5 AND n.deleted_at IS NULL
       RETURNING n.*`,
      [content, mood, tags ? JSON.stringify(tags) : null, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Note not found' });
    res.json({ note: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteNote(req, res, next) {
  try {
    const result = await query(
      `UPDATE notes n SET deleted_at = NOW()
       FROM patients p
       WHERE n.id = $1 AND n.patient_id = p.id AND p.doctor_id = $2 AND n.deleted_at IS NULL
       RETURNING n.id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Note not found' });
    res.json({ message: 'Note deleted', id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
}

module.exports = { listNotes, createNote, updateNote, deleteNote, createRules };
