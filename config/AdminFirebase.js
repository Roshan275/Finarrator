const admin = require("firebase-admin");

// Decode Firebase Service Account from BASE64
if (!admin.apps.length) {
    const base64Key = process.env.FIREBASE_SA_BASE64;

    if (!base64Key) {
        throw new Error("❌ FIREBASE_SA_BASE64 not found in environment variables");
    }

    const jsonKey = JSON.parse(
        Buffer.from(base64Key, "base64").toString("utf8")
    );

    admin.initializeApp({
        credential: admin.credential.cert(jsonKey),
    });
}

const db = admin.firestore();

module.exports = { admin, db };
