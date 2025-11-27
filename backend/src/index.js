/**
 * Excel to XML Converter API
 * 
 * Node.js/Express Backend
 * 
 * A secure API for converting Excel files to XML format
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { securityMiddleware } = require('./middleware/security');
const converterRoutes = require('./routes/converter');
const { auditLogger, logger } = require('./utils/logger');

// Create Express app
const app = express();

// Trust proxy for proper IP detection behind reverse proxies
app.set('trust proxy', 1);

// Security headers with helmet
app.use(helmet({
  contentSecurityPolicy: config.DEBUG ? false : undefined
}));

// CORS configuration
app.use(cors({
  origin: config.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_PERIOD * 1000, // Convert to milliseconds
  max: config.RATE_LIMIT_CALLS,
  message: { detail: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom security middleware
app.use(securityMiddleware);

// API routes
app.use(config.API_V1_PREFIX, converterRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running' });
});

// Global error handler
app.use((err, req, res, next) => {
  const showDetails = config.SHOW_ERROR_DETAILS;

  // Log the error
  auditLogger.logError(
    req.user?.id || 'anonymous',
    'http_error',
    err,
    {
      status_code: err.status || 500,
      path: req.path,
      error_details: showDetails ? err.message : 'hidden'
    }
  );

  const statusCode = err.status || 500;
  const errorResponse = {
    message: showDetails ? err.message : 'Internal server error',
    error_code: `HTTP_${statusCode}`,
    timestamp: new Date().toISOString()
  };

  if (showDetails && err.stack) {
    errorResponse.details = err.stack;
  }

  res.status(statusCode).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Not found',
    error_code: 'HTTP_404',
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(config.PORT, config.HOST, () => {
  // Log startup
  auditLogger.logSecurityEvent(
    'system',
    'application_startup',
    'localhost',
    'success',
    {
      version: config.XML_SCHEMA_VERSION,
      debug_mode: config.DEBUG,
      host: config.HOST,
      port: config.PORT
    }
  );

  logger.info(`Server running on http://${config.HOST}:${config.PORT}`);
  logger.info(`API available at http://${config.HOST}:${config.PORT}${config.API_V1_PREFIX}`);
});

// Graceful shutdown
const gracefulShutdown = () => {
  auditLogger.logSecurityEvent(
    'system',
    'application_shutdown',
    'localhost',
    'success'
  );
  
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = app;
