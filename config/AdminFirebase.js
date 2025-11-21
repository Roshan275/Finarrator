// config/AdminFirebase.js
const admin = require("firebase-admin");

// Load service account credentials
let serviceAccount;

// Debug: Log environment variable status
console.log("🔍 Checking for FIREBASE_SERVICE_ACCOUNT env var...");
console.log("FIREBASE_SERVICE_ACCOUNT exists:", !!process.env.FIREBASE_SERVICE_ACCOUNT);

// Try to load from environment variable first (for production/Render)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.log("✅ Loading credentials from FIREBASE_SERVICE_ACCOUNT env var");
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log("✅ Successfully parsed FIREBASE_SERVICE_ACCOUNT");
  } catch (error) {
    console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:", error.message);
    process.exit(1);
  }
} else {
  // Fall back to file (for local development)
  console.log("⚠️  FIREBASE_SERVICE_ACCOUNT not set, attempting to load from file...");
  try {
    serviceAccount = require("./serviceAccountKey.json");
    console.log("✅ Successfully loaded credentials from serviceAccountKey.json");
  } catch (error) {
    console.error("❌ serviceAccountKey.json not found and FIREBASE_SERVICE_ACCOUNT not set");
    console.error("   Please add FIREBASE_SERVICE_ACCOUNT to Render environment variables");
    process.exit(1);
  }
}

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
