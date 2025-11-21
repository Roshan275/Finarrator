exports.getDashboard = async (req, res) => {
//   console.log("User data is", req.user); // ✅ Log the user object

//   // ✅ Redirect to React frontend dashboard
//   res.redirect('http://localhost:5173', { user: req.user });

// After Firebase auth verifies user
res.cookie("uid", req.user.uid, {
  httpOnly: true,     // 🛡️ Frontend cannot access this
  secure: false,      // true in production
  sameSite: "Lax",
});
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  res.redirect(frontendUrl + "/dashboard");
};
