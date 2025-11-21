const axios = require("axios");
const storeFiMcpData = require("./storeFiMcpData");

// Render Fi-MCP Login Page (optional for EJS)
exports.getFiMcpLogin = (req, res) => {
  res.render("firestoreview/mcplogin", { error: null });
};

// Handle MCP login and store data
exports.postFiMcpLogin = async (req, res) => {
  const { mobile, password } = req.body;

  if (!mobile || !password) {
    return res.status(400).json({ message: "Mobile and password are required" });
  }

  try {
    // 1️⃣ Send credentials to MCP server
    const response = await axios.post("https://financial-mcp-server-production.up.railway.app/api/login", {
      mobile,
      password,
    });

    const mcpData = response.data?.data;
    if (!mcpData || typeof mcpData !== "object") {
      return res.status(500).json({ message: "Invalid MCP response" });
    }

    // 2️⃣ Get UID from Firebase Auth middleware
    const userId = req.user?.uid;
    if (!userId) return res.status(401).json({ message: "Unauthorized: UID missing" });

    // 3️⃣ Store MCP data in Firestore
    await storeFiMcpData(userId, mcpData);

    // 4️⃣ ✅ Send JSON success response (no redirect)
    res.redirect("/dashboard");
  } catch (err) {
    console.error("❌ MCP or Firestore Error:", err.message);
    res.status(500).json({ message: "Failed to fetch or store data" });
  }
};
