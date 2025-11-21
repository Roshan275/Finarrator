# Backend Deployment Guide

Comprehensive guide for deploying Finarrator backend on Render.

## Local Development

### Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with all required variables (see `.env.example`)

3. Run the server:
```bash
npm run dev
```

The server will run on `http://localhost:3000`

## Deployment on Render

### Prerequisites
- Render account (render.com)
- GitHub repository with the backend code
- All API keys and credentials ready

### Step-by-Step Deployment

#### 1. Prepare Your Repository

```bash
git add .
git commit -m "Prepare backend for production deployment"
git push origin main
```

#### 2. Create Web Service on Render

1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub account (if not already connected)
4. Select your repository
5. Choose the branch (usually `main`)

#### 3. Configure Service Settings

- **Service Name**: `finarrator-backend`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: Free (or Paid for production)
- **Auto-Deploy**: Yes (redeploy on every push to main)

#### 4. Add Environment Variables

In Render dashboard, go to Environment and add:

```
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-frontend-domain.vercel.app
MCP_SERVER_URL=https://your-mcp-server.onrender.com
FIREBASE_API_KEY=your_firebase_api_key
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_SEARCH_API_KEY=your_google_search_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=your_pinecone_env
PINECONE_INDEX_NAME=your_index_name
PINECONE_PROJECT_NAME=your_project_name
LLAMA_API_KEY=your_llama_key
LLAMA_CLOUD_API_KEY=your_llama_cloud_key
HUGGINGFACE_API_KEY=your_huggingface_key
OPENAI_API_KEY=your_openai_key
CREDENTIALS_FILE=./config/serviceAccountKey.json
```

#### 5. Deploy

1. Click "Create Web Service"
2. Wait for build to complete
3. Check logs for any errors
4. Once deployed, note the service URL: `https://finarrator-backend.onrender.com`

### Post-Deployment Verification

Test your backend endpoints:

```bash
# Health check
curl https://finarrator-backend.onrender.com/

# Check user data endpoint
curl -X GET https://finarrator-backend.onrender.com/api/getUser \
  -H "Cookie: token=your_token"

# Test chatbot
curl -X POST https://finarrator-backend.onrender.com/api/chatbot/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: token=your_token" \
  -d '{"message":"Hello"}'
```

## Important Notes

### Firebase Service Account Key

**Critical**: You need to add `serviceAccountKey.json` to your `.env` or as a Render secret:

Option 1: Upload as file (secure)
- Go to Render dashboard → Files
- Upload `config/serviceAccountKey.json`

Option 2: Store as environment variable
- Convert JSON to string and store as `FIREBASE_CREDENTIALS`
- Parse in code: `JSON.parse(process.env.FIREBASE_CREDENTIALS)`

### API Key Security

- ✅ Never commit API keys to GitHub
- ✅ Use Render environment variables for sensitive data
- ✅ Rotate keys periodically
- ✅ Use separate keys for dev and production

### CORS Configuration

Update `FRONTEND_URL` in production to your Vercel domain:

```
FRONTEND_URL=https://your-app.vercel.app
```

### Database

Ensure Firestore credentials are properly configured:
- Service account key must be accessible
- Firebase project ID must match `.firebaserc`

## Monitoring & Troubleshooting

### View Logs
```bash
# In Render dashboard, click on service → Logs
```

### Common Issues

**502 Bad Gateway**
- Check service is running: curl `https://your-service.onrender.com/`
- Check for crashes in logs
- Verify environment variables are set

**Port Already in Use**
- Render auto-assigns available ports
- Ensure code respects `process.env.PORT`

**Firebase Auth Errors**
- Verify `serviceAccountKey.json` is accessible
- Check Firebase credentials in Render env vars
- Verify project ID matches

**API Rate Limits**
- Gemini: 60 requests/minute (free tier)
- Google Search: 100 queries/day (free tier)
- Consider rate limiting on backend

### Auto-Restart on Failure

Render automatically restarts services on crash. To customize:
- Go to service settings → Auto-Deploy
- Or manually restart from dashboard

## Updating Backend

### Deploy New Changes

1. Make changes locally
2. Test with `npm run dev`
3. Commit and push:
   ```bash
   git add .
   git commit -m "Update feature"
   git push origin main
   ```
4. Render auto-deploys within 1-2 minutes

### Rollback

If deployment fails:
- Go to Render dashboard
- Click "Manual Deploy" with previous commit
- Select commit from history

## Production Checklist

- [ ] All environment variables set in Render
- [ ] Firebase credentials configured
- [ ] Frontend URL updated to Vercel domain
- [ ] MCP Server URL configured
- [ ] Tested all API endpoints
- [ ] CORS properly configured
- [ ] Error logging enabled
- [ ] Database backups configured
- [ ] Monitoring alerts set up
- [ ] SSL certificate auto-renewed (Render handles this)

## Performance Optimization

### For Free Tier:
- Render spins down services after 15 min of inactivity
- First request after spin-down takes 20-30 seconds
- Consider upgrading to Starter for production

### Caching:
- Implement response caching for frequently accessed data
- Use Redis if scaling becomes necessary

### Rate Limiting:
- Add rate limiting for API endpoints
- Protect against abuse of expensive API calls

## Scaling

When ready to scale:

1. Upgrade from Free to Starter plan
2. Add additional services if needed
3. Consider database optimization
4. Set up CDN for static assets
5. Monitor metrics and adjust based on usage

## Support

- Render Docs: https://render.com/docs
- Firebase Documentation: https://firebase.google.com/docs
- Pinecone Docs: https://docs.pinecone.io
- GitHub Actions for CI/CD integration

## Next Steps

1. Deploy MCP server on Render (see MCP deployment guide)
2. Deploy frontend on Vercel (see Frontend deployment guide)
3. Update all URLs to point to production endpoints
4. Monitor logs and performance
5. Set up error alerts and notifications
