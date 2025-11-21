// utils/pinecone.js
const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
  // ✅ DO NOT ADD environment/projectName/controllerHostUrl for this SDK
});

module.exports = pinecone;
