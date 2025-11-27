/**
 * Logger Utility
 * 
 * Provides structured logging with file rotation and audit logging capabilities
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Create logs directory if it doesn't exist
const logDir = path.dirname(config.LOG_FILE_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level.toUpperCase()}] ${message}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: config.LOG_LEVEL.toLowerCase(),
  format: structuredFormat,
  transports: [
    // File transport for audit logs
    new winston.transports.File({
      filename: config.LOG_FILE_PATH,
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 30,
      tailable: true
    })
  ]
});

// Add console transport in development mode
if (config.DEBUG) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      structuredFormat
    )
  }));
}

/**
 * Audit Logger Class
 * Provides structured audit logging for various events
 */
class AuditLogger {
  constructor() {
    this.logger = logger;
  }

  /**
   * Format audit log message in a structured way
   */
  _formatMessage(eventType, userId, action, details = null, status = 'success') {
    const auditData = {
      timestamp: new Date().toISOString(),
      event_type: eventType,
      user_id: userId,
      action: action,
      status: status,
      details: details || {}
    };
    return JSON.stringify(auditData);
  }

  /**
   * Log authentication related events
   */
  logAuthEvent(userId, action, status = 'success', details = null) {
    const message = this._formatMessage('authentication', userId, action, details, status);
    if (status === 'success') {
      this.logger.info(message);
    } else {
      this.logger.warn(message);
    }
  }

  /**
   * Log file operation events
   */
  logFileOperation(userId, action, fileName, fileSize, status = 'success', details = null) {
    const fileDetails = {
      file_name: fileName,
      file_size: fileSize,
      ...(details || {})
    };
    const message = this._formatMessage('file_operation', userId, action, fileDetails, status);
    if (status === 'success') {
      this.logger.info(message);
    } else {
      this.logger.error(message);
    }
  }

  /**
   * Log file conversion events
   */
  logConversionEvent(userId, inputFile, outputFile, conversionTime, status = 'success', details = null) {
    const conversionDetails = {
      input_file: inputFile,
      output_file: outputFile,
      conversion_time_ms: conversionTime,
      ...(details || {})
    };
    const message = this._formatMessage('conversion', userId, 'convert_excel_to_xml', conversionDetails, status);
    if (status === 'success') {
      this.logger.info(message);
    } else {
      this.logger.error(message);
    }
  }

  /**
   * Log security related events
   */
  logSecurityEvent(userId, action, ipAddress, status = 'success', details = null) {
    const securityDetails = {
      ip_address: ipAddress,
      ...(details || {})
    };
    const message = this._formatMessage('security', userId, action, securityDetails, status);
    if (status === 'success') {
      this.logger.info(message);
    } else {
      this.logger.warn(message);
    }
  }

  /**
   * Log error events
   */
  logError(userId, action, error, details = null) {
    const errorDetails = {
      error_type: error?.name || 'Error',
      error_message: error?.message || String(error),
      ...(details || {})
    };
    const message = this._formatMessage('error', userId, action, errorDetails, 'error');
    this.logger.error(message);
  }
}

// Create singleton instance
const auditLogger = new AuditLogger();

module.exports = {
  logger,
  auditLogger
};
