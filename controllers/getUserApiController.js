// core module
const admin = require("firebase-admin");

exports.getUser = async (req, res) => {
  const uid = req.cookies.uid;
  if (!uid) return res.status(401).json({ error: "Not authenticated" });

  try {
    const user = await admin.auth().getUser(uid);
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      email: user.email,
      name: user.displayName || "User",
      uid: user.uid,
      // Add only safe data here
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


exports.getFirebaseCustomToken =  async (req, res) => {
  try {
    const { uid } = req.user; // user.uid was set by checkAuth middleware

    // ✅ Generate custom Firebase token
    const customToken = await admin.auth().createCustomToken(uid);

    res.json({ token: customToken });
  } catch (error) {
    console.error("❌ Failed to create custom token:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};






