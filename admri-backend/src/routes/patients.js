const express = require('express');
const router  = express.Router();
const { authenticate, ownPatient } = require('../middleware/auth');
const { validate, auditLog } = require('../middleware/errorHandler');
const pc = require('../controllers/patientController');
const ac = require('../controllers/assessmentController');
const nc = require('../controllers/noteController');

// All patient routes require auth
router.use(authenticate);

// ── Patient CRUD ─────────────────────────────────────────────────────────────
router.get(   '/',                                         pc.listPatients);
router.post(  '/',           pc.createRules, validate,     pc.createPatient);
router.get(   '/:id',        ownPatient('id'),              pc.getPatient);
router.patch( '/:id',        ownPatient('id'), pc.updateRules, validate, pc.updatePatient);
router.delete('/:id',        ownPatient('id'), auditLog('DELETE_PATIENT'), pc.deletePatient);
router.get(   '/:id/risk-history', ownPatient('id'),       pc.getRiskHistory);

// ── Assessments (nested under patient) ───────────────────────────────────────
router.get(   '/:patientId/assessments',
  ownPatient('patientId'), ac.listAssessments);
router.post(  '/:patientId/assessments',
  ownPatient('patientId'), ac.createRules, validate, ac.createAssessment);
router.get(   '/:patientId/assessments/:id',
  ownPatient('patientId'), ac.getAssessment);
router.delete('/:patientId/assessments/:id',
  ownPatient('patientId'), auditLog('DELETE_ASSESSMENT'), ac.deleteAssessment);

// ── Notes (nested under patient) ─────────────────────────────────────────────
router.get(   '/:patientId/notes',
  ownPatient('patientId'), nc.listNotes);
router.post(  '/:patientId/notes',
  ownPatient('patientId'), nc.createRules, validate, nc.createNote);
router.patch( '/:patientId/notes/:id',
  ownPatient('patientId'), nc.updateNote);
router.delete('/:patientId/notes/:id',
  ownPatient('patientId'), auditLog('DELETE_NOTE'), nc.deleteNote);

module.exports = router;
