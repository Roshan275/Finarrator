const express = require('express');
const apiRouter = express.Router();
const checkAuth = require('../middlewares/authMiddleware');
const { getUser, getFirebaseCustomToken } = require('../controllers/getUserApiController');
const { postFuture } = require('../controllers/futureController4');

apiRouter.get('/getUser', getUser)
apiRouter.get('/firebaseCustomToken', checkAuth , getFirebaseCustomToken )
apiRouter.post('/future', postFuture )

module.exports = apiRouter; 