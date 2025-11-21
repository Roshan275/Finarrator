// routes/authRouter.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Auth routes - POST only (React handles GET/UI)
router.post("/signup", authController.postSignup);
router.post("/login", authController.postLogin);
router.post("/googleLogin", authController.googleLogin);

// Logout route
router.get("/logout", authController.logout);

module.exports = router;
