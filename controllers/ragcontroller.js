const fs = require("fs");
const pdfParse = require("pdf-parse");
const pinecone = require("../utils/pinecone");
const { embedText } = require("../utils/embedding");

const MAX_CHUNK_LENGTH = 4000;
const BATCH_SIZE = 100;

function splitTextIntoChunks(text, maxLength = MAX_CHUNK_LENGTH) {
  const sentences = text.split(/\.\s+|\n+/);
  const chunks = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence + ". ";
    } else {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = sentence + ". ";
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks.filter(chunk => chunk.length > 0);
}

const postFile = async (req, res) => {
  let filePath = null;
  
  try {
    filePath = req.file.path;
    const { docName } = req.body;

    if (!docName) {
      throw new Error("Document name is required");
    }

    console.log(`📄 Processing file: ${req.file.originalname}`);
    console.log(`📝 Document name: ${docName}`);

    const pdfBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(pdfBuffer);
    const fullText = pdfData.text;

    if (!fullText || fullText.trim().length === 0) {
      throw new Error("No text content found in PDF");
    }

    console.log(`📖 Extracted text length: ${fullText.length} characters`);

    const textChunks = splitTextIntoChunks(fullText);
    console.log(`🧩 Total chunks created: ${textChunks.length}`);

    if (textChunks.length === 0) {
      throw new Error("No text chunks generated from PDF");
    }

    // 🔹 Create embeddings using HuggingFace (768-dim)
    console.log("🔹 Generating embeddings with HuggingFace...");
    const embeddings = [];
    
    for (let i = 0; i < textChunks.length; i++) {
      console.log(`📊 Generating embedding for chunk ${i + 1}/${textChunks.length}`);
      try {
        const embedding = await embedText(textChunks[i]);
        embeddings.push(embedding);
      } catch (error) {
        console.error(`❌ Failed to generate embedding for chunk ${i + 1}:`, error.message);
        throw new Error(`Embedding generation failed at chunk ${i + 1}`);
      }
    }

    // Verify embedding dimensions match Pinecone index (768)
    const embeddingDimension = embeddings[0]?.length || 0;
    console.log(`📏 Embedding dimension: ${embeddingDimension}`);
    
    if (embeddingDimension !== 768) {
      throw new Error(`Dimension mismatch! Pinecone index 'ragdata' expects 768-dimensional vectors, but got ${embeddingDimension}.`);
    }

    // Prepare vectors for Pinecone
    const vectors = embeddings.map((embedding, index) => ({
      id: `${docName.replace(/\s+/g, "_")}_${index}_${Date.now()}`,
      values: embedding,
      metadata: {
        text: textChunks[index],
        docName: docName,
        chunkIndex: index,
        totalChunks: textChunks.length,
        timestamp: new Date().toISOString(),
        embeddingModel: "all-mpnet-base-v2",
        dimension: embeddingDimension,
        originalFilename: req.file.originalname
      },
    }));

    console.log("📡 Connecting to Pinecone index...");
    const pineconeIndex = await pinecone.index(process.env.PINECONE_INDEX_NAME || 'ragdata');

    // Upload in batches
    let totalUploaded = 0;
    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
      const batch = vectors.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`📤 Uploading batch ${batchNumber} (${batch.length} vectors)`);
      
      try {
        await pineconeIndex.upsert(batch);
        totalUploaded += batch.length;
        console.log(`✅ Batch ${batchNumber} uploaded successfully`);
      } catch (batchError) {
        console.error(`❌ Failed to upload batch ${batchNumber}:`, batchError.message);
        throw new Error(`Batch upload failed at batch ${batchNumber}`);
      }
    }

    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("🗑️ Temporary file deleted");
    }

    res.status(200).json({
      success: true,
      message: "✅ Document embedded and uploaded to Pinecone successfully!",
      details: {
        chunksUploaded: totalUploaded,
        embeddingDimension: embeddingDimension,
        documentName: docName,
        pineconeIndex: process.env.PINECONE_INDEX_NAME || 'ragdata'
      }
    });

  } catch (err) {
    console.error("❌ Upload Error:", err.message);
    
    // Clean up file on error
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log("🗑️ Temporary file deleted after error");
      } catch (cleanupError) {
        console.error("❌ Failed to delete temporary file:", cleanupError.message);
      }
    }

    res.status(500).json({
      success: false,
      error: err.message || "Failed to upload and process document.",
      details: {
        documentName: req.body?.docName,
        originalFilename: req.file?.originalname
      }
    });
  }
};

module.exports = { postFile };