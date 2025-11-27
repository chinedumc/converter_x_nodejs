/**
 * Security Middleware
 * 
 * Provides security features including XSS protection, content validation,
 * and request logging
 */

const config = require('../config');
const { auditLogger } = require('../utils/logger');
const { verifySessionTimeout } = require('../utils/auth');

/**
 * XSS patterns to check for
 */
const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /onerror=/gi,
  /onload=/gi,
  /eval\(/gi,
  /document\.cookie/gi
];

/**
 * Check for potential XSS attacks in request parameters
 */
function checkXSS(value) {
  if (typeof value !== 'string') return false;
  return XSS_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * Get client IP address from request headers
 */
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Get Content Security Policy header value
 */
function getCSPHeader() {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'"
  ].join('; ');
}

/**
 * Security middleware function
 */
function securityMiddleware(req, res, next) {
  try {
    const clientIP = getClientIP(req);
    const userId = req.user?.id || 'anonymous';

    // Content-Type validation for POST requests
    if (req.method === 'POST') {
      const contentType = req.headers['content-type'] || '';
      const allowedTypes = [
        'application/json',
        'multipart/form-data',
        'application/x-www-form-urlencoded'
      ];
      
      const isValidContentType = allowedTypes.some(type => 
        contentType.toLowerCase().includes(type.toLowerCase())
      );
      
      if (!isValidContentType) {
        auditLogger.logSecurityEvent(userId, 'security_violation', clientIP, 'error', {
          error_code: 415,
          error_detail: 'Unsupported media type'
        });
        return res.status(415).json({ detail: 'Unsupported media type' });
      }
    }

    // File size validation for uploads
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      const contentLength = req.headers['content-length'];
      const maxSize = config.MAX_UPLOAD_SIZE_MB * 1024 * 1024;
      if (contentLength && parseInt(contentLength, 10) > maxSize) {
        auditLogger.logSecurityEvent(userId, 'security_violation', clientIP, 'error', {
          error_code: 413,
          error_detail: 'File too large'
        });
        return res.status(413).json({ detail: 'File too large' });
      }
    }

    // Session timeout check
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (!verifySessionTimeout(token)) {
        auditLogger.logSecurityEvent(userId, 'security_violation', clientIP, 'error', {
          error_code: 440,
          error_detail: 'Session has expired'
        });
        return res.status(440).json({ detail: 'Session has expired' });
      }
    }

    // XSS protection - check query parameters
    for (const [key, value] of Object.entries(req.query)) {
      if (checkXSS(String(value))) {
        auditLogger.logSecurityEvent(userId, 'security_violation', clientIP, 'error', {
          error_code: 400,
          error_detail: 'Potential XSS attack detected'
        });
        return res.status(400).json({ detail: 'Potential XSS attack detected' });
      }
    }

    // Log incoming request
    auditLogger.logSecurityEvent(userId, 'incoming_request', clientIP, 'success', {
      method: req.method,
      path: req.path,
      query_params: JSON.stringify(req.query)
    });

    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', getCSPHeader());

    next();
  } catch (error) {
    const clientIP = getClientIP(req);
    auditLogger.logError('system', 'security_middleware', error, {
      path: req.path
    });
    return res.status(500).json({ detail: 'Internal server error' });
  }
}

module.exports = {
  securityMiddleware,
  getClientIP,
  checkXSS
};
