// middlewares/authMiddleware.js
const admin = require('../config/AdminFirebase');

const checkAuth = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) return res.redirect('/login');

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    req.user = decodedToken; // ✅ attach whole user (including uid)

    next();
  } catch (err) {
    console.error("Token verification error:", err.message);
    res.redirect('/login');
  }
};

module.exports = checkAuth;
