const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const { connectDB, checkConnection } = require('./config/database');
require('dotenv').config();
const { startReportScheduler } = require('./services/reportScheduler');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Compression middleware
app.use(compression());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Rate limiting - TEMPORARILY DISABLED FOR DEVELOPMENT
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.'
// });
// app.use(limiter);

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.CLIENT_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Accept', 'Origin', 'X-Requested-With'],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/analyse', require('./routes/analyse'));
app.use('/api/market-news-intelligence', require('./routes/marketNewsIntelligence'));

// Health check endpoint with database status
app.get('/api/health', (req, res) => {
  const dbStatus = checkConnection();
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      connected: dbStatus.isConnected,
      readyState: dbStatus.readyState,
      host: dbStatus.host,
      port: dbStatus.port,
      name: dbStatus.name,
      connectionAttempts: dbStatus.connectionAttempts
    },
    memory: process.memoryUsage(),
    version: process.version
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const DEFAULT_PORT = Number(process.env.PORT || 5000);
const MAX_PORT_ATTEMPTS = 10;

const listenOnPort = (port) => new Promise((resolve, reject) => {
  const server = app.listen(port);

  const handleListening = () => {
    server.off('error', handleError);
    resolve(server);
  };

  const handleError = (error) => {
    server.off('listening', handleListening);
    reject(error);
  };

  server.once('listening', handleListening);
  server.once('error', handleError);
});

const startServer = async () => {
  await connectDB();

  let port = DEFAULT_PORT;

  for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt += 1) {
    try {
      await listenOnPort(port);
      console.log(`Server running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);

      try {
        startReportScheduler();
      } catch (e) {
        console.warn('Report scheduler not started:', e?.message || e);
      }

      return;
    } catch (error) {
      if (error.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS - 1) {
        console.warn(`Port ${port} is already in use. Retrying on port ${port + 1}...`);
        port += 1;
        continue;
      }

      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
};

startServer();
