// config/AdminFirebase.js
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

let serviceAccount = null;
let adminInitialized = false;
let db = null;

// Load service account credentials
function loadServiceAccount() {
  console.log("🔍 Checking for FIREBASE_SERVICE_ACCOUNT env var...");

  // Try to load from environment variable first (for production/Render)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log("✅ Loading credentials from FIREBASE_SERVICE_ACCOUNT env var");
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log("✅ Successfully parsed FIREBASE_SERVICE_ACCOUNT");
      return true;
    } catch (error) {
      console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:", error.message);
      return false;
    }
  }

  // Fall back to file (for local development)
  console.log("⚠️  FIREBASE_SERVICE_ACCOUNT not set, attempting to load from file...");
  
  // Try multiple possible paths
  const possiblePaths = [
    "./config/serviceAccountKey.json",
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(__dirname, "../config/serviceAccountKey.json"),
    "/etc/secrets/serviceAccountKey.json" // Render secret file mount point
  ];
  
  for (const filePath of possiblePaths) {
    try {
      if (fs.existsSync(filePath)) {
        console.log(`✅ Found credentials at: ${filePath}`);
        serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log("✅ Successfully loaded credentials from file");
        return true;
      }
    } catch (error) {
      console.log(`⚠️  Could not load from ${filePath}: ${error.message}`);
    }
  }
  
  console.warn("⚠️  Firebase credentials not found - will attempt to load on first use");
  return false;
}

// Initialize Firebase Admin SDK (can be called multiple times, only initializes once)
function initializeFirebase() {
  if (adminInitialized && db) {
    return { admin, db };
  }

  // Try to load credentials if not already loaded
  if (!serviceAccount) {
    loadServiceAccount();
  }

  // If we have credentials, initialize
  if (serviceAccount && !admin.apps.length) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      db = admin.firestore();
      adminInitialized = true;
      console.log("✅ Firebase Admin SDK initialized successfully");
      return { admin, db };
    } catch (error) {
      console.error("❌ Failed to initialize Firebase:", error.message);
      throw error;
    }
  }

  // Return what we have (could be uninitialized)
  return { admin, db };
}

// Try initial load without crashing if not available
try {
  loadServiceAccount();
  if (serviceAccount) {
    initializeFirebase();
  }
} catch (error) {
  console.warn("⚠️  Firebase will be initialized on first use");
}

// ✅ Correct way to export in CommonJS
module.exports = { admin, db, initializeFirebase, loadServiceAccount };
