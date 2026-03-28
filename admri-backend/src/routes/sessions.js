// src/routes/sessions.js
// Standalone session routes for PATCH/DELETE by session ID
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const sc = require('../controllers/sessionController');

router.use(authenticate);

// Update session status (mark done, cancel, etc)
router.patch('/:id',  sc.updateSession);
// Delete session
router.delete('/:id', sc.deleteSession);
// List all upcoming sessions across all patients (for dashboard calendar)
router.get('/upcoming', sc.listUpcoming);
// Send reminders manually (for testing)
router.post('/send-reminders', sc.sendReminders);

module.exports = router;
