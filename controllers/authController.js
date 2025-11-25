// controllers/authController.js
require("dotenv").config();
const { admin } = require("../config/AdminFirebase");

// Load Firebase API Key from .env
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

// Handle user signup
exports.postSignup = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Attempt to create the user in Firebase Auth
    await admin.auth().createUser({ email, password });
    
    // Success response for frontend fetch
    res.status(201).json({ 
      success: true, 
      message: 'User created successfully. Redirecting to login.' 
    });
    
  } catch (error) {
    // Extract a cleaner error message if possible
    let errorMessage = 'Registration failed.';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'The email address is already in use by another account.';
    } else if (error.code === 'auth/invalid-password') {
       errorMessage = 'Password should be at least 6 characters.';
    } else if (error.message) {
      // Use Firebase's default error message if it exists
      errorMessage = error.message;
    }
    
    // Error response for frontend fetch
    res.status(400).json({ 
      success: false, 
      error: errorMessage 
    });
  }
};

// Handle user login with token-based cookie
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email and password are required.' 
    });
  }

  try {
    const fetch = await import('node-fetch');
    const response = await fetch.default(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const data = await response.json();
    if (data.error) {
       // Log the error and return a JSON error response
       console.error('Firebase Login Error:', data.error.message);
       
       // Provide user-friendly error messages
       let errorMessage = data.error.message;
       if (data.error.message.includes('INVALID_LOGIN_CREDENTIALS')) {
         errorMessage = 'Invalid email or password.';
       } else if (data.error.message.includes('USER_DISABLED')) {
         errorMessage = 'This account has been disabled.';
       }
       
       return res.status(401).json({ success: false, error: errorMessage });
    }

    const idToken = data.idToken;

    // Set cookie on successful login
    res.cookie('token', idToken, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'Lax', // Add this for CORS compatibility
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    // Success: Return JSON for frontend to handle redirect
    return res.status(200).json({ success: true, message: 'Login successful.' });
    
  } catch (error) {
    console.error("Login Handler Error:", error.message);
    // Return a generic server error
    return res.status(500).json({ success: false, error: 'A server error occurred during login.' });
  }
};

// Logout and cleanup
exports.logout = async (req, res) => {
  const idToken = req.cookies.token;

  if (!idToken) {
    res.clearCookie('token');
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  }

  try {
    // ✅ Step 1: Verify token and get UID
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // ✅ Step 2: Get Firestore reference to user data
    const userDocRef = admin.firestore().collection('fiMcpData').doc(uid);

    // ✅ Step 3: Delete all subcollections
    await deleteSubcollections(userDocRef);

    // ✅ Step 4: Delete main document
    await userDocRef.delete();

    console.log(`🗑️ Cleared all Firestore data for user: ${uid}`);
  } catch (error) {
    console.error("❌ Error during logout cleanup:", error.message);
  }

  // ✅ Step 5: Clear cookie and send JSON response
  res.clearCookie('token');
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

// Delete all subcollections under a user document
const deleteSubcollections = async (docRef) => {
  const collections = await docRef.listCollections();

  for (const col of collections) {
    const snapshot = await col.get();

    const deletePromises = snapshot.docs.map((doc) => doc.ref.delete());
    await Promise.all(deletePromises);
    console.log(`🧹 Deleted subcollection: ${col.id}`);
  }
};

// Handle Google Sign-In
exports.googleLogin = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ 
      success: false, 
      error: 'ID token is required.' 
    });
  }

  try {
    // Verify the ID token with Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email;

    // Create or update user in Firestore
    const userDocRef = admin.firestore().collection('fiMcpData').doc(uid);
    const userSnapshot = await userDocRef.get();

    if (!userSnapshot.exists) {
      // New user - create document
      await userDocRef.set({
        email: email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        authProvider: 'Google',
      });
      console.log(`✅ New Google user created: ${email}`);
    } else {
      // Existing user - update last login
      await userDocRef.update({
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✅ User logged in with Google: ${email}`);
    }

    // Generate a custom token for the client
    const customToken = await admin.auth().createCustomToken(uid);

    // Set secure cookie with the ID token
    res.cookie('token', idToken, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'Lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    // Return the custom token
    return res.status(200).json({ 
      success: true, 
      customToken,
      message: 'Google login successful.' 
    });
  } catch (error) {
    console.error('Google Login Error:', error.message);
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid token or Google login failed.' 
    });
  }
};