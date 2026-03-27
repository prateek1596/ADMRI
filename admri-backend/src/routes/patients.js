// src/routes/patients.js
const express = require('express');
const router  = express.Router();
const { authenticate, ownPatient } = require('../middleware/auth');
const { validate, auditLog }       = require('../middleware/errorHandler');

const pc    = require('../controllers/patientController');
const ac    = require('../controllers/assessmentController');
const nc    = require('../controllers/noteController');
const sc    = require('../controllers/sessionController');
const gc    = require('../controllers/goalController');
const shapC = require('../controllers/shapController');

// All routes require auth
router.use(authenticate);

// ── Patient CRUD ──────────────────────────────────────────────────────────────
router.get(   '/',         pc.listPatients);
router.post(  '/',         pc.createRules, validate, pc.createPatient);
router.get(   '/:id',      ownPatient('id'), pc.getPatient);
router.patch( '/:id',      ownPatient('id'), pc.updateRules, validate, pc.updatePatient);
router.delete('/:id',      ownPatient('id'), auditLog('DELETE_PATIENT'), pc.deletePatient);
router.get(   '/:id/risk-history', ownPatient('id'), pc.getRiskHistory);

// ── Assessments ───────────────────────────────────────────────────────────────
router.get(   '/:patientId/assessments',
  ownPatient('patientId'), ac.listAssessments);
router.post(  '/:patientId/assessments',
  ownPatient('patientId'), ac.createRules, validate, ac.createAssessment);
router.get(   '/:patientId/assessments/:id',
  ownPatient('patientId'), ac.getAssessment);
router.delete('/:patientId/assessments/:id',
  ownPatient('patientId'), auditLog('DELETE_ASSESSMENT'), ac.deleteAssessment);

// ── SHAP (feature importance) — must come BEFORE generic assessment routes ────
router.get('/:patientId/assessments/:assessmentId/shap',
  ownPatient('patientId'), shapC.getShapScores);
router.get('/:patientId/shap-trend',
  ownPatient('patientId'), shapC.getShapTrend);

// ── Notes ─────────────────────────────────────────────────────────────────────
router.get(   '/:patientId/notes',
  ownPatient('patientId'), nc.listNotes);
router.post(  '/:patientId/notes',
  ownPatient('patientId'), nc.createRules, validate, nc.createNote);
router.patch( '/:patientId/notes/:id',
  ownPatient('patientId'), nc.updateNote);
router.delete('/:patientId/notes/:id',
  ownPatient('patientId'), auditLog('DELETE_NOTE'), nc.deleteNote);

// ── Sessions (scheduled appointments) ────────────────────────────────────────
router.get(   '/:patientId/sessions',
  ownPatient('patientId'), sc.listSessions);
router.post(  '/:patientId/sessions',
  ownPatient('patientId'), sc.createRules, validate, sc.createSession);

// Session update/delete by session ID (no patientId in path)
router.patch( '/sessions/:id',  sc.updateSession);
router.delete('/sessions/:id',  sc.deleteSession);

// ── Treatment Goals ───────────────────────────────────────────────────────────
// suggest MUST come before /:id routes to avoid "suggest" being treated as an id
router.get(   '/:patientId/goals/suggest',
  ownPatient('patientId'), gc.suggestGoals);
router.get(   '/:patientId/goals',
  ownPatient('patientId'), gc.listGoals);
router.post(  '/:patientId/goals',
  ownPatient('patientId'), gc.createRules, validate, gc.createGoal);
router.patch( '/:patientId/goals/:id',
  ownPatient('patientId'), gc.updateGoal);
router.post(  '/:patientId/goals/:id/progress',
  ownPatient('patientId'), gc.logProgress);
router.delete('/:patientId/goals/:id',
  ownPatient('patientId'), gc.deleteGoal);

module.exports = router;
