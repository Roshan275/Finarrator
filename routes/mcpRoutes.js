const express = require('express');
const router = express.Router();

const { getFiMcpLogin, postFiMcpLogin } = require('../controllers/mcpController');
const checkAuth = require('../middlewares/authMiddleware');

router.get('/login', checkAuth, getFiMcpLogin);
router.post('/login', checkAuth, postFiMcpLogin);

module.exports = router;
