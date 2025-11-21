# Finarrator Backend

Express.js backend server for the Finarrator financial dashboard application. Handles authentication, chatbot APIs, Firebase integration, and financial data processing.

## Features

- 🔐 Firebase Authentication with custom tokens
- 💬 AI-powered Chatbot (Gemini API integration)
- 🔍 RAG (Retrieval-Augmented Generation) with Pinecone
- 🌐 Google Search integration for real-time data
- 📄 PDF document processing and embedding
- 🏦 Financial data management
- 🔄 CORS-enabled for cross-origin requests
- 📚 LangChain integration for LLM workflows

## Tech Stack

- **Framework**: Express.js (Node.js)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Admin SDK
- **AI/LLM**: Google Gemini API, OpenAI, LLaMA
- **Vector DB**: Pinecone
- **Search**: Google Custom Search API
- **File Upload**: Multer
- **PDF Processing**: pdf-parse
- **Embeddings**: HuggingFace

## Installation

### Prerequisites
- Node.js 18+ 
- npm 9+
- Firebase project setup
- API keys for Gemini, Pinecone, etc.

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Fill in all required environment variables in `.env`

5. Add Firebase service account key at `config/serviceAccountKey.json`

6. Start development server:
```bash
npm run dev
```

Server runs on `http://localhost:3000`

## Environment Variables

See `.env.example` for all required environment variables:

- `FIREBASE_API_KEY` - Firebase authentication key
- `GEMINI_API_KEY` - Google Gemini API key
- `GOOGLE_SEARCH_API_KEY` - Google Search API key
- `PINECONE_API_KEY` - Pinecone vector database key
- `HUGGINGFACE_API_KEY` - HuggingFace embeddings API key
- `OPENAI_API_KEY` - OpenAI API key (optional)
- And more (see `.env.example`)

## API Endpoints

### Authentication
- `POST /signup` - User registration
- `POST /login` - User login
- `POST /googleLogin` - Google OAuth login
- `GET /logout` - User logout

### User Data
- `GET /api/getUser` - Get user profile
- `GET /api/firebaseCustomToken` - Get Firebase token

### Chatbot
- `POST /api/chatbot/chat` - Send chat message
- Returns AI-powered response with financial context

### Documents & RAG
- `POST /api/documents/upload` - Upload document for RAG
- `GET /api/documents` - List user documents
- `DELETE /api/documents/:id` - Delete document

### Financial Data
- `GET /dashboard/*` - Dashboard data endpoints
- `GET /rag/*` - RAG and search endpoints

## Project Structure

```
backend/
├── config/
│   ├── AdminFirebase.js          # Firebase initialization
│   └── serviceAccountKey.json    # Firebase credentials
├── controllers/
│   ├── authController.js         # Auth logic
│   ├── mcpController.js          # MCP integration
│   ├── ragcontroller.js          # RAG logic
│   ├── chatbotRoute.js           # Chatbot API handler
│   └── ...
├── routes/
│   ├── authRoutes.js             # Auth endpoints
│   ├── chatbotRoute.js           # Chatbot routes
│   ├── documentRoutes.js         # Document upload
│   └── ...
├── middlewares/
│   ├── authMiddleware.js         # Auth verification
│   └── checkAuth.js              # Cookie auth check
├── utils/
│   ├── embedding.js              # Embeddings generation
│   ├── pinecone.js               # Pinecone operations
│   └── ...
├── data/                         # Mock data files
├── uploads/                      # Uploaded documents
├── index.js                      # Server entry point
├── package.json
├── .env                          # Environment variables
└── .gitignore
```

## Running Locally

### Development
```bash
npm run dev
```

Uses nodemon for auto-reload on file changes.

### Production
```bash
npm start
```

Runs with Node.js directly.

## Deployment

### Render Deployment

See `DEPLOYMENT.md` for comprehensive deployment guide:

1. Push to GitHub
2. Connect to Render
3. Configure environment variables
4. Deploy automatically

```bash
# View deployment guide
cat DEPLOYMENT.md
```

### Environment for Production

Update these for Render:
- `NODE_ENV=production`
- `FRONTEND_URL=https://your-vercel-domain.app`
- `MCP_SERVER_URL=https://your-render-mcp-server.onrender.com`

## Troubleshooting

### Port Already in Use
```bash
# Change PORT in .env
PORT=3001
```

### Firebase Connection Issues
- Verify `serviceAccountKey.json` exists
- Check FIREBASE_API_KEY is correct
- Ensure Firestore database is enabled

### Chatbot API Errors
- Verify GEMINI_API_KEY is valid
- Check Pinecone connection
- Review API rate limits

### Document Upload Issues
- Ensure `uploads/` directory is writable
- Check file size limits
- Verify PDF format is supported

## API Key Setup

### Get API Keys

1. **Firebase**: [console.firebase.google.com](https://console.firebase.google.com)
2. **Gemini**: [makersuite.google.com](https://makersuite.google.com)
3. **Google Search**: [console.cloud.google.com](https://console.cloud.google.com)
4. **Pinecone**: [app.pinecone.io](https://app.pinecone.io)
5. **HuggingFace**: [huggingface.co](https://huggingface.co)
6. **OpenAI**: [platform.openai.com](https://platform.openai.com)

## Testing

```bash
# Test health check
curl http://localhost:3000/

# Test login
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test chatbot
curl -X POST http://localhost:3000/api/chatbot/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: token=your_token" \
  -d '{"message":"What is my financial status?"}'
```

## Performance

### Optimizations
- Parallel API calls for chatbot responses
- Timeout wrappers for non-blocking operations
- Request caching where applicable
- Connection pooling for databases

### Response Time Goals
- Health check: <100ms
- Login: <500ms
- Chatbot: 3-5 seconds

## Security

- ✅ CORS enabled for frontend only
- ✅ HttpOnly cookies for tokens
- ✅ Firebase Admin SDK for secure operations
- ✅ Input validation on all endpoints
- ✅ Environment variables for sensitive data
- ✅ Rate limiting ready to implement

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m 'Add feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Open Pull Request

## License

ISC

## Support

For issues and questions:
- Check logs in Render dashboard
- Review Firebase console
- Check API key validity
- Verify network connectivity

## Related Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Express.js Documentation](https://expressjs.com/)
- [Pinecone Documentation](https://docs.pinecone.io/)
