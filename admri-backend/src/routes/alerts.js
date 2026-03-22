const express  = require('express');
const router   = express.Router();
const { authenticate } = require('../middleware/auth');
const { getAlertHistory } = require('../controllers/assessmentController');
router.use(authenticate);
router.get('/', getAlertHistory);
module.exports = router;
