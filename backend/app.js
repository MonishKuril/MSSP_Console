const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const adminRoutes = require('./routes/admin');
const newsRoutes = require('./routes/news');
const { authMiddleware } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7000;

// Get server IP for CORS configuration
const getServerIP = () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
};

const SERVER_IP = process.env.SERVER_IP || getServerIP();

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl requests, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:7000',
      'http://127.0.0.1:7000',
      `http://${SERVER_IP}:7000`,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      `http://${SERVER_IP}:3000`,
      // Add your specific server IP if different
      'http://192.168.1.70:7000',
      'http://192.168.1.70:3000'
    ];
    
    // Add any additional origins from environment
    if (process.env.CORS_ORIGINS) {
      allowedOrigins.push(...process.env.CORS_ORIGINS.split(','));
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS: Blocked request from origin: ${origin}`);
      console.log(`CORS: Allowed origins: ${allowedOrigins.join(', ')}`);
      callback(null, true); // Allow all origins in development - change to false in production
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'Cookie'
  ],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400 // 24 hours
};

// Apply CORS before other middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Enhanced security middleware with relaxed CSP for development
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", `http://${SERVER_IP}:${PORT}`, "http://localhost:7000"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.SESSION_SECRET));

// Logging middleware for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('Origin') || 'None'}`);
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', authMiddleware, clientsRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/news', newsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    server: `${SERVER_IP}:${PORT}`,
    version: '1.0.0'
  });
});

// Serve static files with proper headers
app.use(express.static(path.join(__dirname, '../frontend/public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
}));

app.use('/scripts', express.static(path.join(__dirname, '../frontend/scripts'), {
  setHeaders: (res, path) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
}));

app.use('/styles', express.static(path.join(__dirname, '../frontend/styles'), {
  setHeaders: (res, path) => {
    res.setHeader('Content-Type', 'text/css');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
}));

// Serve specific HTML routes
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.get('/login', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname, '../frontend/public/login.html'));
});

app.get('/dashboard', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname, '../frontend/public/dashboard.html'));
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found',
    path: req.path
  });
});

// Route all other requests to index.html (SPA support)
app.get('*', (req, res) => {
  // Check if file exists in public directory first
  const filePath = path.join(__dirname, '../frontend/public', req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    // Fallback to index.html for SPA routing
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error occurred:', err.stack);
  
  // CORS error handling
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ 
      success: false, 
      message: 'CORS policy violation',
      error: 'Access denied due to CORS policy'
    });
  }
  
  res.status(500).json({ 
    success: false, 
    message: 'Server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server on all interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SIEM Console Server running on port ${PORT}`);
  console.log(`📍 Local access: http://localhost:${PORT}`);
  console.log(`🌐 Network access: http://${SERVER_IP}:${PORT}`);
  console.log(`🔒 CORS enabled for multiple origins`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, '../frontend/public')}`);
  
  // Show network interfaces for debugging
  console.log('\n📡 Available network interfaces:');
  const os = require('os');
  const interfaces = os.networkInterfaces();
  Object.keys(interfaces).forEach(name => {
    interfaces[name].forEach(interface => {
      if (interface.family === 'IPv4') {
        console.log(`   ${name}: ${interface.address}`);
      }
    });
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;