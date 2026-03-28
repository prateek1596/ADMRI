const express = require('express');
const router  = express.Router();

router.use('/auth',      require('./auth'));
router.use('/patients',  require('./patients'));
router.use('/dashboard', require('./dashboard'));
router.use('/alerts',    require('./alerts'));
router.use('/sessions',  require('./sessions'));   // standalone PATCH/DELETE /api/sessions/:id


module.exports = router;
