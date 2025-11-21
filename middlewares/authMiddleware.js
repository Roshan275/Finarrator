const {admin} = require('../config/AdminFirebase');

const checkAuth = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.redirect('/login');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    // ✅ Attach full user to req
    req.user = decodedToken;

    next();
  } catch (err) {
    console.error('❌ Token verification failed:', err.message);
    return res.redirect('/login');
  }
};

module.exports = checkAuth;
