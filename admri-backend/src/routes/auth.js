const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const c = require('../controllers/authController');

router.post('/register',        c.registerRules, validate, c.register);
router.post('/login',           c.loginRules,    validate, c.login);
router.post('/refresh',                                     c.refreshToken);
router.post('/logout',          auth.authenticate,          c.logout);
router.get( '/me',              auth.authenticate,          c.getMe);
router.patch('/me',             auth.authenticate,          c.updateMe);
router.patch('/me/email',       auth.authenticate,          c.changeEmail);
router.post('/change-password', auth.authenticate,          c.changePassword);

module.exports = router;
