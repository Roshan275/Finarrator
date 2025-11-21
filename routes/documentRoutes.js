// routes/documentRoutes.js
const express = require('express');
const router = express.Router();
const { Pinecone } = require('@pinecone-database/pinecone');

// Initialize Pinecone
const pinecone = new Pinecone({ 
  apiKey: process.env.PINECONE_API_KEY 
});

// Get all documents from Pinecone
router.get('/documents', async (req, res) => {
  try {
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME || 'ragdata');
    
    // Query to get all documents (using a dummy vector)
    const results = await index.query({
      vector: Array(768).fill(0.1), // Better dummy vector
      topK: 1000,
      includeMetadata: true,
      includeValues: false
    });

    // Extract unique documents
    const documentsMap = new Map();
    results.matches.forEach(match => {
      const metadata = match.metadata || {};
      if (metadata.docName && metadata.originalFilename) {
        if (!documentsMap.has(metadata.docName)) {
          documentsMap.set(metadata.docName, {
            docName: metadata.docName,
            originalFilename: metadata.originalFilename,
            chunkCount: 0,
            timestamp: metadata.timestamp,
            embeddingModel: metadata.embeddingModel
          });
        }
        const doc = documentsMap.get(metadata.docName);
        doc.chunkCount += 1;
        // Keep the earliest timestamp
        if (metadata.timestamp && (!doc.timestamp || metadata.timestamp < doc.timestamp)) {
          doc.timestamp = metadata.timestamp;
        }
      }
    });

    const documents = Array.from(documentsMap.values());
    
    res.json({ success: true, documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete all vectors for a specific document
router.delete('/documents/:docName', async (req, res) => {
  try {
    const { docName } = req.params;
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME || 'ragdata');

    // Find all vectors for this document
    const results = await index.query({
      vector: Array(768).fill(0.1),
      topK: 10000,
      filter: { docName: { $eq: docName } },
      includeMetadata: true,
      includeValues: false
    });

    if (!results.matches || results.matches.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Delete all vectors for this document
    const idsToDelete = results.matches.map(match => match.id);
    await index.deleteMany(idsToDelete);

    console.log(`✅ Deleted ${idsToDelete.length} chunks for document: ${docName}`);
    
    res.json({ 
      success: true, 
      message: `Deleted ${idsToDelete.length} chunks for ${docName}`,
      deletedCount: idsToDelete.length
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;