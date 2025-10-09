const mongoose = require('mongoose');

// Connection configuration with enhanced options
const connectionOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4, // Use IPv4, skip trying IPv6
  bufferCommands: false, // Disable mongoose buffering
  connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
  heartbeatFrequencyMS: 10000, // Send a ping every 10 seconds
  retryWrites: true, // Retry failed writes
  retryReads: true, // Retry failed reads
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  compressors: 'zlib', // Enable compression
};

// Connection state tracking
let isConnected = false;
let connectionAttempts = 0;
const maxRetries = 5;
const retryDelay = 5000; // 5 seconds

const connectDB = async (retryCount = 0) => {
  try {
    // If already connected, return
    if (isConnected && mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return mongoose.connection;
    }

    console.log(`Attempting to connect to MongoDB... (Attempt ${retryCount + 1}/${maxRetries + 1})`);
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, connectionOptions);
    
    isConnected = true;
    connectionAttempts = 0;
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}:${conn.connection.port}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    return conn;

  } catch (error) {
    isConnected = false;
    connectionAttempts++;
    
    console.error(`❌ MongoDB connection failed (Attempt ${retryCount + 1}):`, error.message);
    
    // Retry logic with exponential backoff
    if (retryCount < maxRetries) {
      const delay = retryDelay * Math.pow(2, retryCount); // Exponential backoff
      console.log(`⏳ Retrying connection in ${delay / 1000} seconds...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectDB(retryCount + 1);
    } else {
      console.error('💥 Max connection attempts reached. Exiting...');
      process.exit(1);
    }
  }
};

// Enhanced connection event handlers
const setupConnectionHandlers = () => {
  // Connection successful
  mongoose.connection.on('connected', () => {
    console.log('🔗 Mongoose connected to MongoDB');
    isConnected = true;
  });

  // Connection error
  mongoose.connection.on('error', (err) => {
    console.error('🚨 MongoDB connection error:', err);
    isConnected = false;
  });

  // Connection disconnected
  mongoose.connection.on('disconnected', () => {
    console.log('🔌 MongoDB disconnected');
    isConnected = false;
    
    // Attempt to reconnect if not in shutdown process
    if (!process.exitTimeoutId) {
      console.log('🔄 Attempting to reconnect...');
      setTimeout(() => {
        if (!isConnected) {
          connectDB();
        }
      }, retryDelay);
    }
  });

  // Connection reconnected
  mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
    isConnected = true;
  });

  // MongoDB server selection failed
  mongoose.connection.on('serverSelectionError', (err) => {
    console.error('🎯 MongoDB server selection error:', err.message);
    isConnected = false;
  });

  // Graceful shutdown handlers
  const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
    
    // Set timeout to force exit if graceful shutdown takes too long
    process.exitTimeoutId = setTimeout(() => {
      console.error('⏰ Graceful shutdown timeout. Forcing exit...');
      process.exit(1);
    }, 10000);

    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed gracefully');
      }
      
      clearTimeout(process.exitTimeoutId);
      console.log('👋 Application shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during graceful shutdown:', err);
      clearTimeout(process.exitTimeoutId);
      process.exit(1);
    }
  };

  // Handle different termination signals
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon restart

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
};

// Health check function
const checkConnection = () => {
  return {
    isConnected: isConnected && mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    connectionAttempts
  };
};

// Initialize connection handlers
setupConnectionHandlers();

module.exports = {
  connectDB,
  checkConnection,
  isConnected: () => isConnected && mongoose.connection.readyState === 1
};