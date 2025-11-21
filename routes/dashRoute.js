const express = require('express');
const dashroute = express.Router();
const checkAuth = require('../middlewares/authMiddleware');
const { getDashboard } = require('../controllers/dashController');


dashroute.get('/', checkAuth, getDashboard );

module.exports = dashroute; 