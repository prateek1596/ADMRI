const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { getDashboardStats } = require('../controllers/patientController');

router.use(authenticate);
router.get('/stats', getDashboardStats);

module.exports = router;
