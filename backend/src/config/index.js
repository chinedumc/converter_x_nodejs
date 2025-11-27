/**
 * Application Configuration
 * 
 * Loads environment variables and provides configuration settings
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Resolve paths relative to the backend directory
const BASE_DIR = path.resolve(__dirname, '../..');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(require('os').homedir(), 'converter_x_output');
const LOG_DIR = path.join(BASE_DIR, 'logs');
const LOG_FILE_PATH = process.env.LOG_FILE_PATH || path.join(LOG_DIR, 'audit.log');

// Create necessary directories
[OUTPUT_DIR, LOG_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const config = {
  // Base paths
  BASE_DIR,
  OUTPUT_DIR,
  LOG_DIR,
  LOG_FILE_PATH,

  // API Settings
  API_V1_PREFIX: '/api/v1',
  PROJECT_NAME: 'Excel to XML Converter',
  DEBUG: process.env.DEBUG?.toLowerCase() === 'true',

  // Server
  HOST: process.env.HOST || '0.0.0.0',
  PORT: parseInt(process.env.PORT, 10) || 8000,

  // Security
  SECRET_KEY: process.env.SECRET_KEY,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,

  // Session
  SESSION_TIMEOUT_MINUTES: parseInt(process.env.SESSION_TIMEOUT_MINUTES, 10) || 5,

  // CORS
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),

  // File Upload
  MAX_UPLOAD_SIZE_MB: parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 10,
  ALLOWED_EXTENSIONS: ['.xls', '.xlsx'],

  // Rate Limiting
  RATE_LIMIT_CALLS: parseInt(process.env.RATE_LIMIT_CALLS, 10) || 100,
  RATE_LIMIT_PERIOD: parseInt(process.env.RATE_LIMIT_PERIOD, 10) || 60,

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // XML Settings
  XML_NAMESPACE: 'http://www.example.com/xml/converter',
  XML_SCHEMA_VERSION: '1.0',

  // Error Display
  SHOW_ERROR_DETAILS: process.env.SHOW_ERROR_DETAILS?.toLowerCase() === 'true',

  /**
   * Validate if the file extension is allowed
   */
  validateFileExtension(filename) {
    const ext = path.extname(filename).toLowerCase();
    return this.ALLOWED_EXTENSIONS.includes(ext);
  },

  /**
   * Get the full path for an output file
   */
  getOutputPath(filename) {
    return path.join(this.OUTPUT_DIR, filename);
  },

  /**
   * Get all settings as an object
   */
  getSettings() {
    return {
      PROJECT_NAME: this.PROJECT_NAME,
      API_V1_PREFIX: this.API_V1_PREFIX,
      DEBUG: this.DEBUG,
      MAX_UPLOAD_SIZE_MB: this.MAX_UPLOAD_SIZE_MB,
      ALLOWED_EXTENSIONS: this.ALLOWED_EXTENSIONS,
      RATE_LIMIT_CALLS: this.RATE_LIMIT_CALLS,
      RATE_LIMIT_PERIOD: this.RATE_LIMIT_PERIOD,
      LOG_LEVEL: this.LOG_LEVEL,
      XML_SCHEMA_VERSION: this.XML_SCHEMA_VERSION
    };
  }
};

// Validate required environment variables in production
if (process.env.NODE_ENV === 'production') {
  if (!config.SECRET_KEY) {
    console.warn('Warning: No SECRET_KEY set in environment');
  }
  if (!config.ENCRYPTION_KEY) {
    console.warn('Warning: No ENCRYPTION_KEY set in environment');
  }
}

module.exports = config;
