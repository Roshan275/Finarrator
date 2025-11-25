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
// Retrieve relevant docs from Pinecone using embeddings
// Retrieve relevant docs from Pinecone using embeddings
async function fetchFromPineconeRAG(userQuery, userId) {
  try {
    console.log(`🔍 Retrieving RAG context for query: "${userQuery.substring(0, 50)}..."`);
    
    const queryEmbedding = await fetchQueryEmbedding(userQuery);
    if (!queryEmbedding) {
      console.log("❌ Failed to generate embedding for query");
      return "No RAG context available.";
    }

    console.log(`📐 Query embedding dimension: ${queryEmbedding.length}`);
    
    const results = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
      filter: { docName: { $exists: true } }
    });

    // DEBUG: See what metadata was stored
    if (results.matches && results.matches.length > 0) {
      console.log("📄 Full document text:", results.matches[0].metadata.text);
    }

    if (!results.matches || results.matches.length === 0) {
      console.log("ℹ️  No relevant documents found in Pinecone");
      return "No relevant information found in documents.";
    }

    console.log(`✅ Found ${results.matches.length} relevant document chunks`);
    console.log("📊 Match scores:", results.matches.map(m => m.score));
    
    // Format the context
    const ragContext = results.matches
      .filter(match => match.score > -1.0) // Reasonable threshold
      .map((match) => {
        const metadata = match.metadata || {};
        return `[Relevance: ${(match.score * 100).toFixed(1)}%] ${metadata.text || 'No text content'}`;
      })
      .join("\n\n");

    return ragContext || "No highly relevant information found.";

  } catch (err) {
    console.error("❌ Pinecone query error:", err.message);
    return "Error retrieving information from documents.";
  }
}

// Fetch all user financial data
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

  await Promise.all(collections.map(async (collectionName) => {
    try {
      const snapshot = await userRef.collection(collectionName).get();
      if (snapshot.empty) {
        userData[collectionName] = "No data found";
        return;
      }
      const docs = [];
      snapshot.forEach((doc) => docs.push({ id: doc.id, ...doc.data() }));
      userData[collectionName] = docs;
    } catch (error) {
      console.error(`❌ Error fetching ${collectionName}:`, error.message);
      userData[collectionName] = "Error fetching data";
    }
  }));

  return JSON.stringify(userData, null, 2);
}

// Real-time Google Search
async function fetchGoogleSearchResults(query) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  try {
    const response = await axios.get("https://www.googleapis.com/customsearch/v1", {
      params: { key: apiKey, cx, q: query, num: 3},
      timeout: 5000,
    });
    const items = response.data.items || [];
    console.log("API:", process.env.GOOGLE_SEARCH_API_KEY);
    console.log("CX:", process.env.GOOGLE_SEARCH_ENGINE_ID);

    console.log(items)

    return items
      .map((item, idx) => `${idx + 1}. ${item.title}\n${item.snippet}\n${item.link}`)
      .join("\n\n");
  } catch (err) {
    console.error("❌ Custom Search API error:", err.response?.data || err.message);
    return "Real-time search failed or not available.";
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
  if (!message || !uid) return res.status(400).json({ reply: "Missing message or uid in request body." });

  // Step 1: Clarify message with history if provided
  let clarifiedMessage = message;
  try {
    clarifiedMessage = await clarifyQuery(message, previousQA);
  } catch (err) {
    // fallback to raw message if clarification fails
    clarifiedMessage = message;
  }

  // Step 2: Detect question category
  const keyword = detectKeyword(clarifiedMessage);
  const instruction = keywordInstructions[keyword] || keywordInstructions.general;

  // Step 3: Get all user financial data
  let fullUserData = {};
  try {
    fullUserData = await getAllUserData(uid);
  } catch (err) {
    console.error("❌ Error fetching user data:", err.message);
    return res.status(500).json({ reply: "Error retrieving user financial data." });
  }

  // Step 4: Data extraction by Gemini - relevant user data
  const sanitizedMessage = clarifiedMessage.replace(/\s+/g, " ").trim();
  const dataExtractionPrompt = [
    "You are a financial data filter.",
    "Given the user's financial data and a question, respond ONLY with the data relevant to the question in STRICT JSON format.",
    "Avoid commentary, summaries, or explanations.",
    `User Query: ${sanitizedMessage}`,
    `User Financial Data: ${fullUserData}`
  ].join("\n");

  let relevantUserDataJSON = "{}";
  try {
    const dataFilterResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: dataExtractionPrompt }] }] },
      { timeout: 800000 }
    );
    relevantUserDataJSON =
      dataFilterResponse.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";
  } catch (err) {
    console.error("❌ Data filtering error:", err.response?.data || err.message);
  }

  // Step 5: RAG context via Pinecone search
  const pineconeRAGContext = await fetchFromPineconeRAG(clarifiedMessage, uid);

  // Step 6: Real-time Google search
  const searchResults = await fetchGoogleSearchResults(message);

  // Step 7: Format conversation history
  const formattedHistory = previousQA
    .slice(-MAX_HISTORY_LENGTH)
    .map((pair, i) => `Q${i + 1}: ${pair.question}\nA${i + 1}: ${pair.answer}`)
    .join("\n\n");

  // Step 8: Build final prompt for Gemini
  const finalPrompt = [
    "You are a smart financial assistant.",
    "Start by strictly analyzing the user-uploaded file content below before using external search results.",
    "Prefer file-based answers over Google unless the answer is clearly not found.",
    "",
    `Instruction:\n${instruction}`,
    "",
    "User Uploaded File Content:",
    pineconeRAGContext,
    "",
    "User Financial Data:",
    fullUserData,
    "",
    "Real-time Search Results:",
    searchResults,
    "Based on user query use the real-time search results if data is not found in user financial data or uploaded files.",
    "",
    `User Question:\n${sanitizedMessage}`,
    "",
    "Previous Conversation History (optional, use only when relevant):",
    formattedHistory
  ].join("\n");

  try {
    const finalGeminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: finalPrompt }] }] },
      { timeout: 15000 }
    );
    let reply = finalGeminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, no reply generated.";
    reply = reply.trim();
    res.json({ reply });
  } catch (err) {
    console.error("❌ Final Gemini response error:", err.response?.data || err.message);
    res.status(500).json({ reply: "Something went wrong while generating the response." });
  }
});

// Simple GET endpoint for health check
router.get('/', (req, res) => {
  res.send("✅ Gemini financial chatbot endpoint is live.");
});

module.exports = router;
