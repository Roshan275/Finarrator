const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const cors = require('cors');

const app = express();

// CORS (MUST be before route definitions)
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set('view engine', 'ejs');
app.set('views', 'views');
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const authRoutes = require('./routes/authRoutes');
const mcpRoutes = require('./routes/mcpRoutes');
const dashRoutes = require('./routes/dashRoute');
const getUserApi = require('./routes/getUserApi');
const ragRoutes = require('./routes/ragroutes'); // ✅ fixed import
const chatbotRoute = require('./routes/chatbotRoute');
const documentRoutes = require('./routes/documentRoutes'); // ADD THIS

// Use routes
app.use('/', authRoutes);
app.use('/api', authRoutes);
app.use('/Fi-MCP', mcpRoutes);
app.use('/dashboard', dashRoutes);
app.use('/api', getUserApi);
app.use('/api/chatbot', chatbotRoute);
app.use('/rag', ragRoutes); // ✅ mounted properly
app.use('/api', documentRoutes); // ADD THIS - handles /api/documents

// Start server
app.listen(3000, () => console.log('✅ Server running at http://localhost:3000'));
