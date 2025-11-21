// config/AdminFirebase.js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); // Ensure the path is correct

// Initialize app if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ✅ Get Firestore instance
const db = admin.firestore();

// ✅ Correct way to export in CommonJS
module.exports = { admin, db };
