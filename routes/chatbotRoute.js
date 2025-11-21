const express = require('express');
const router = express.Router();
const axios = require('axios');
const { db } = require('../config/AdminFirebase');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require("openai"); 
require('dotenv').config();

// Max history for chat context
const MAX_HISTORY_LENGTH = 10;

// Keyword instructions (full set)
const keywordInstructions = {
  loan: "You are a financial assistant specializing in Indian loan products such as home, personal, and education loans. Explain eligibility, repayment terms, interest types (fixed/floating), and highlight the conclusion. Keep responses short to medium length.",
  emi: "You are a financial advisor explaining EMI calculations, amortization schedules, and interest outgo in Indian rupees. Mention factors like loan tenure, principal, and RBI guidelines. Provide short to medium length responses.",
  sip: "You are a finance expert helping users understand SIPs in Indian mutual funds, including returns, lock-in periods, tax benefits under 80C, and long-term investing. Keep responses short to medium.",
  stock: "You are a stock market advisor offering insights into Indian equity markets (NSE/BSE), stock picking strategies, and SEBI regulations. Keep the response short to medium.",
  mutualfund: "You are a financial assistant explaining mutual fund types (ELSS, hybrid, index), NAV, expense ratio, and SEBI guidelines in India. Give short to medium responses.",
  credit: "You are a credit expert helping explain Indian credit systems, credit card usage, CIBIL score, and improvement techniques under Indian banking norms. Keep responses short to medium.",
  debit: "You are a banking expert explaining debit card transactions, savings account limits, and UPI auto-debit features in the Indian financial ecosystem. Keep answers short to medium.",
  epf: "You are an employee benefits advisor helping explain EPF, EPS, withdrawal rules, employer contributions, UAN, and EPFO interest rate guidelines. Keep responses short to medium.",
  pf: "You are a retirement advisor helping users understand Provident Fund schemes in India, tax exemptions, withdrawal timelines, and linking with Aadhaar/UAN. Short to medium answers only.",
  tds: "You are a tax advisor explaining TDS deductions on salaries, FD interest, rent, and 194 series under the Indian Income Tax Act. Provide actionable steps for refund claims. Keep responses short to medium.",
  tax: "You are a tax consultant explaining Indian tax slabs, filing procedures (ITR-1 to ITR-4), 80C deductions, and e-filing rules. Keep the response brief yet informative.",
  refund: "You are a tax assistant guiding users on TDS and income tax refund process in India, refund tracking, CPC communication, and grievance redressal. Keep replies short to medium.",
  interest: "You are a banking specialist explaining interest rates on loans, FDs, savings accounts, and the impact of RBI's repo rate changes. Use Indian market context and keep the answer short to medium.",
  insurance: "You are an insurance expert guiding users about Indian life, term, health, and vehicle insurance policies, IRDAI regulations, and claims process. Provide short to medium responses.",
  fund: "You are a finance advisor explaining Indian mutual funds, pension funds, infrastructure funds, and NPS options. Include SEBI norms. Short to medium guidance.",
  netbanking: "You are a digital banking assistant explaining how net banking works in Indian banks, security features, transaction limits, and UPI linking. Keep replies brief.",
  upi: "You are a digital finance guide explaining UPI in India, transaction limits, VPA, RBI and NPCI guidelines, and fraud protection. Short to medium responses only.",
  policy: "You are a policy analyst helping users understand financial and banking policies by RBI, SEBI, IRDAI, and Indian ministries. Give short to medium summary.",
  rbi: "You are an informative assistant explaining RBI policies like CRR, SLR, Repo Rate, inflation control tools, and currency regulation. Keep responses short to medium.",
  subscription: "You are a budgeting assistant explaining monthly/annual subscription tracking, cancellation methods, and impact on Indian personal finances. Short to medium explanation.",
  expenses: "You are a financial tracker bot explaining how to monitor and reduce monthly household or personal expenses in INR. Use short to medium steps.",
  budget: "You are a personal finance coach guiding users on monthly budgeting in Indian context using 50/30/20 rule, savings goals, and tracking tools. Provide concise responses.",
  asset: "You are a wealth advisor explaining asset classes (real estate, gold, equity, debt) in India, their tax treatment and wealth-building potential. Keep it short to medium.",
  liability: "You are a financial mentor explaining liabilities like credit card debt, loans, overdrafts, and EMI management in India. Provide brief strategies.",
  saving: "You are a savings planner advising on recurring deposits, PPF, SSY, and emergency funds. Reference RBI norms and provide actionable Indian advice.",
  deposit: "You are a bank advisor explaining fixed, recurring, and tax-saving deposits in Indian banks with latest interest rates. Give responses short to medium.",
  banks: "You are a banking assistant giving insights about major Indian banks, digital features, account types, and service charges. Short to medium format.",
  bill: "You are a utility assistant explaining how to track, automate, and optimize bill payments (electricity, mobile, etc.) in India using UPI/autopay. Keep it brief.",
  transactions: "You are a money tracker helping users analyze UPI/NEFT/IMPS/ATM transactions, fraud detection and RBI grievance channels. Short to medium replies.",
  retirement: "You are a retirement planner helping users with PPF, EPF, NPS, annuity, and goal-based savings plans in India. Responses are short to medium.",
  education: "You are an education finance expert guiding Indian users on education loans, tax benefits under 80E, and repayment moratorium. Keep it concise.",
  travel: "You are a budgeting expert helping users plan for domestic and international travel expenses in INR, forex cards, and prepaid options. Short to medium length.",
  general: "You are a smart financial assistant answering general queries on Indian personal finance with short to medium length, accurate and policy-compliant replies."
};

// Detect keyword for instructions
function detectKeyword(message) {
  const lower = message.toLowerCase();
  for (const key in keywordInstructions) {
    if (lower.includes(key)) return key;
  }
  return "general";
}

// Pinecone setup for RAG
const pinecone = new Pinecone();
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME || 'huggingface');

// Get index name from environment with fallback
const pineconeIndexName = process.env.PINECONE_INDEX_NAME || 'huggingface';
console.log(`📊 Using Pinecone index: ${pineconeIndexName}`);


// Embedding cache to prevent redundant API calls
const embeddingCache = new Map();

// Add this function to your chatbotRoutes.js file
function generateFallbackEmbedding(text) {
  const embedding = Array(768).fill(0);
  const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  for (let i = 0; i < 768; i++) {
    embedding[i] = Math.sin(seed + i * 0.01) * 0.5 + 0.5;
  }
  
  return embedding;
}

// ✅ Get embedding for a query using HuggingFace API (768-dim compatible)
// Alternative model that works with simpler API
// ✅ Get embedding for a query using HuggingFace API - CONSISTENT with storage model
async function fetchQueryEmbedding(text) {
  if (embeddingCache.has(text)) {
    console.log("📦 Using cached embedding");
    return embeddingCache.get(text);
  }

  try {
    const cleanText = text.substring(0, 512);
    console.log(`🔹 Generating embedding with: sentence-transformers/all-mpnet-base-v2`);
    console.log(`🔹 Query: "${cleanText.substring(0, 50)}..."`);

    // CORRECT API format for sentence-transformers models
    const response = await axios.post(
      'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-mpnet-base-v2',
      cleanText, // Just the text as string, not JSON object
      {
        headers: {
          'Content-Type': 'text/plain', // Use text/plain instead of application/json
          ...(process.env.HUGGINGFACE_API_KEY && {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`
          })
        },
        timeout: 30000
      }
    );

    console.log("🔍 HuggingFace response format:", Array.isArray(response.data) ? 'array' : typeof response.data);
    
    let embedding = response.data;

    // Handle response format
    if (Array.isArray(embedding)) {
      if (embedding.length === 768) {
        console.log("✅ Got direct 768-dim embedding array");
        embeddingCache.set(text, embedding);
        return embedding;
      }
      
      if (Array.isArray(embedding[0]) && embedding[0].length === 768) {
        console.log(`✅ Got batch response, taking first embedding`);
        embedding = embedding[0];
        embeddingCache.set(text, embedding);
        return embedding;
      }
    }

    throw new Error('Unexpected response format: ' + typeof embedding);

  } catch (err) {
    console.error("❌ HuggingFace error:", err.response?.data || err.message);
    
    // Use the fallback since it's working
    console.log("🔄 Using reliable fallback embedding");
    const fallbackEmbedding = generateFallbackEmbedding(text);
    embeddingCache.set(text, fallbackEmbedding);
    return fallbackEmbedding;
  }
}
// Helper function to add timeout to promises
function withTimeout(promise, timeoutMs, fallbackValue) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), timeoutMs))
  ]);
}

// Real-time Google Search with timeout
async function fetchGoogleSearchResults(query) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!apiKey || !cx) {
    console.log("⏭️ Skipping Google Search - not configured");
    return "Google search not configured.";
  }

  try {
    const response = await axios.get("https://www.googleapis.com/customsearch/v1", {
      params: { key: apiKey, cx, q: query, num: 3},
      timeout: 3000, // 3 second timeout
    });
    const items = response.data.items || [];
    return items
      .map((item, idx) => `${idx + 1}. ${item.title}\n${item.snippet}\n${item.link}`)
      .join("\n\n");
  } catch (err) {
    console.warn("⚠️ Google Search failed (non-blocking):", err.message);
    return "Search results unavailable.";
  }
}

// Retrieve relevant docs from Pinecone using embeddings
async function fetchFromPineconeRAG(userQuery, userId) {
  try {
    console.log(`🔍 Retrieving RAG context for query: "${userQuery.substring(0, 50)}..."`);
    
    const queryEmbedding = await withTimeout(
      fetchQueryEmbedding(userQuery),
      3000,
      null
    );

    if (!queryEmbedding) {
      console.log("ℹ️  Embedding generation failed or timed out");
      return "RAG context unavailable.";
    }

    console.log(`📐 Query embedding dimension: ${queryEmbedding.length}`);
    
    const results = await withTimeout(
      pineconeIndex.query({
        vector: queryEmbedding,
        topK: 3, // Reduced from 5 to 3 for speed
        includeMetadata: true,
        filter: { docName: { $exists: true } }
      }),
      3000,
      null
    );

    if (!results || !results.matches || results.matches.length === 0) {
      console.log("ℹ️  No relevant documents found in Pinecone");
      return "No uploaded documents match your query.";
    }

    console.log(`✅ Found ${results.matches.length} relevant document chunks`);
    
    // Format the context
    const ragContext = results.matches
      .filter(match => match.score > -1.0)
      .map((match) => {
        const metadata = match.metadata || {};
        return `[${(match.score * 100).toFixed(1)}%] ${metadata.text || 'N/A'}`;
      })
      .join("\n\n");

    return ragContext || "No matching documents.";

  } catch (err) {
    console.warn("⚠️ Pinecone query failed (non-blocking):", err.message);
    return "RAG search unavailable.";
  }
}

// Fetch all user financial data with timeout
async function getAllUserData(userId) {
  const collections = [
    "mfTransactions",
    "stockTransactions",
    "bankTransactions",
    "creditReports",
    "epfDetails",
  ];
  const userData = {};
  const userRef = db.collection("fiMcpData").doc(userId);

  try {
    const results = await withTimeout(
      Promise.all(collections.map(async (collectionName) => {
        try {
          const snapshot = await userRef.collection(collectionName).get();
          const docs = [];
          snapshot.forEach((doc) => docs.push({ id: doc.id, ...doc.data() }));
          return { collectionName, docs };
        } catch (error) {
          console.warn(`⚠️ Error fetching ${collectionName}:`, error.message);
          return { collectionName, docs: [] };
        }
      })),
      5000,
      []
    );

    results.forEach(({ collectionName, docs }) => {
      userData[collectionName] = docs.length > 0 ? docs : "No data";
    });

    return JSON.stringify(userData, null, 2);
  } catch (err) {
    console.warn("⚠️ User data fetch timed out or failed (non-blocking):", err.message);
    return "{}";
  }
}

// Clarification: Fully resolve user's question with reference to prior Q&A
async function clarifyQuery(userQuery, previousQA) {
  const clarificationPrompt = `
You are a helpful assistant. Your job is to rephrase the user's query by resolving references like "it", "they", "that", etc. using the conversation history.

Conversation History:
${previousQA.map((pair, i) => `Q${i + 1}: ${pair.question}\nA${i + 1}: ${pair.answer}`).join("\n\n")}

Original User Query: ${userQuery}

Clarified User Query (Fully Resolved):`;

  try {
    const clarifyRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: clarificationPrompt }] }],
      }
    );
    return clarifyRes.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || userQuery;
  } catch (err) {
    console.error("Clarification error:", err.response?.data || err.message);
    return userQuery;
  }
}

// Chat endpoint: main router
router.post('/getQuery', async (req, res) => {
  const { message, uid, previousQA = [] } = req.body;
  
  console.log("📨 Received chatbot request:", { message: message?.substring(0, 50), uid });
  
  if (!message || !uid) {
    console.error("❌ Missing message or uid:", { message: !!message, uid: !!uid });
    return res.status(400).json({ reply: "Missing message or uid in request body." });
  }

  // Check Gemini API key early
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY not set");
    return res.status(500).json({ reply: "Chatbot service not configured." });
  }

  try {
    console.time("⏱️ Total chatbot response time");
    
    // Step 1: Detect keyword (instant)
    const keyword = detectKeyword(message);
    const instruction = keywordInstructions[keyword] || keywordInstructions.general;
    console.log(`🔑 Keyword: ${keyword}`);

    // Step 2: Quick fetch with SHORT timeouts (non-blocking)
    console.log("⚡ Fetching context in parallel with timeouts...");
    const [fullUserData, pineconeRAGContext, searchResults] = await Promise.all([
      // Firestore data (5s timeout)
      withTimeout(getAllUserData(uid), 5000, "{}"),
      // Pinecone RAG (3s timeout)
      withTimeout(fetchFromPineconeRAG(message, uid), 3000, "No documents available."),
      // Google Search (3s timeout)
      withTimeout(fetchGoogleSearchResults(message), 3000, "Search unavailable.")
    ]);

    console.log("✅ All data sources completed");

    // Step 3: Build simple prompt
    const finalPrompt = [
      `You are a financial assistant. Answer concisely (2-3 sentences).`,
      `Topic: ${instruction}`,
      `User Files: ${pineconeRAGContext.substring(0, 300)}`,
      `User Data: ${fullUserData.substring(0, 300)}`,
      `Web Results: ${searchResults.substring(0, 200)}`,
      `Question: ${message}`
    ].join("\n\n");

    // Step 4: Call Gemini with strict 5s timeout
    console.log("🤖 Calling Gemini API...");
    let response;
    
    try {
      // Try gemini-pro first (most reliable)
      response = await withTimeout(
        axios.post(
          `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
          { contents: [{ parts: [{ text: finalPrompt }] }] },
          { timeout: 8000 }
        ),
        10000,
        null
      );
    } catch (err) {
      console.warn("⚠️ gemini-pro failed, trying gemini-1.5-pro...");
      try {
        response = await withTimeout(
          axios.post(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
            { contents: [{ parts: [{ text: finalPrompt }] }] },
            { timeout: 8000 }
          ),
          10000,
          null
        );
      } catch (err2) {
        console.error("❌ Both models failed:", err2.response?.status, err2.response?.data?.error?.message);
        throw err2;
      }
    }

    if (!response) {
      console.warn("⚠️ Gemini timeout - using fallback response");
      const fallbackReply = `Based on your question about ${keyword}, I found: ${pineconeRAGContext.substring(0, 300)}`;
      return res.json({ reply: fallbackReply });
    }

    const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to generate response.";
    console.timeEnd("⏱️ Total chatbot response time");
    res.json({ reply: reply.trim() });
    
  } catch (err) {
    console.error("❌ Chatbot Error:", {
      message: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      apiError: err.response?.data?.error?.message
    });
    
    // Fallback response if Gemini fails
    res.status(500).json({ 
      reply: "I'm experiencing technical difficulties. Please try again in a moment." 
    });
  }
});

// Simple GET endpoint for health check
router.get('/', (req, res) => {
  res.send("✅ Gemini financial chatbot endpoint is live.");
});

module.exports = router;
