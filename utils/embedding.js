const { HfInference } = require('@huggingface/inference');
require("dotenv").config();

// Initialize HuggingFace client (API key optional for some models)
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// 768-dimensional embedding models compatible with your Pinecone index
const EMBEDDING_MODELS = {
  DEFAULT: 'sentence-transformers/all-mpnet-base-v2', // 768 dim - best general purpose
  ALTERNATIVE: 'BAAI/bge-base-en', // 768 dim - high quality
  MULTILINGUAL: 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2' // 768 dim for multilingual
};

const embedText = async (text) => {
  try {
    console.log(`🔹 Generating 768-dim embeddings with: ${EMBEDDING_MODELS.DEFAULT}`);
    
    const response = await hf.featureExtraction({
      model: EMBEDDING_MODELS.DEFAULT,
      inputs: text
    });

    // Verify we got 768-dimensional vectors
    if (response && response.length !== 768) {
      console.warn(`⚠️  Expected 768 dimensions, got: ${response.length}`);
      throw new Error(`Dimension mismatch: Expected 768, got ${response.length}`);
    }
    
    console.log(`✅ Successfully generated 768-dim embedding`);
    return response;
    
  } catch (err) {
    console.error("❌ HuggingFace embedding error:", err.message);
    
    // Fallback to alternative model if primary fails
    try {
      console.log("🔄 Attempting fallback to alternative model...");
      const fallbackResponse = await hf.featureExtraction({
        model: EMBEDDING_MODELS.ALTERNATIVE,
        inputs: text
      });
      
      if (fallbackResponse && fallbackResponse.length === 768) {
        console.log("✅ Fallback model succeeded");
        return fallbackResponse;
      }
      throw new Error("Fallback model also failed");
      
    } catch (fallbackError) {
      console.error("❌ All embedding methods failed:", fallbackError.message);
      throw new Error(`Embedding generation failed: ${err.message}`);
    }
  }
};

// Test function to verify compatibility
async function testEmbeddingCompatibility() {
  try {
    const testText = "This is a test sentence for dimension verification";
    const embedding = await embedText(testText);
    
    console.log(`\n🧪 Compatibility Test Results:`);
    console.log(`✅ Embedding dimension: ${embedding.length}`);
    console.log(`✅ Expected: 768, Actual: ${embedding.length}`);
    
    if (embedding.length === 768) {
      console.log("✅ Perfect compatibility with Pinecone index!");
      return true;
    } else {
      console.log("❌ Dimension mismatch! Update your model.");
      return false;
    }
  } catch (error) {
    console.error("❌ Compatibility test failed:", error);
    return false;
  }
}

module.exports = { embedText, testEmbeddingCompatibility, EMBEDDING_MODELS };