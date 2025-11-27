/**
 * Authentication Utility
 * 
 * Provides JWT token creation, verification, and session management
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const { logger } = require('./logger');

const ALGORITHM = 'HS256';

/**
 * Custom Authentication Error
 */
class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Create a new JWT access token
 */
function createAccessToken(data, expiresInMinutes = null) {
  try {
    const expireMinutes = expiresInMinutes || config.SESSION_TIMEOUT_MINUTES;
    
    const payload = {
      ...data,
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(payload, config.SECRET_KEY, {
      algorithm: ALGORITHM,
      expiresIn: `${expireMinutes}m`
    });

    logger.info(`Access token created for user: ${data.sub || 'unknown'}`);
    return token;
  } catch (error) {
    logger.error(`Failed to create access token: ${error.message}`);
    throw new AuthError('Could not create access token');
  }
}

/**
 * Verify and decode a JWT token
 */
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.SECRET_KEY, {
      algorithms: [ALGORITHM]
    });
    return payload;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token has expired');
      throw new AuthError('Token has expired');
    }
    logger.warn(`Invalid token: ${error.message}`);
    throw new AuthError('Could not validate credentials');
  }
}

/**
 * Get current user from token
 */
function getCurrentUser(token) {
  try {
    const payload = verifyToken(token);
    const userId = payload.sub;
    
    if (!userId) {
      throw new AuthError('Token missing user identifier');
    }

    // Check token expiration
    const exp = payload.exp;
    if (!exp || exp < Math.floor(Date.now() / 1000)) {
      throw new AuthError('Token has expired');
    }

    return { user_id: userId };
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    throw error;
  }
}

/**
 * Verify if the session has timed out
 */
function verifySessionTimeout(token) {
  try {
    const payload = verifyToken(token);
    const exp = payload.exp;

    if (!exp) {
      return false;
    }

    // Check if token is within timeout window
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDifference = exp - currentTime;

    // Session is valid if within timeout window
    return timeDifference > 0;
  } catch (error) {
    logger.warn(`Session verification failed: ${error.message}`);
    return false;
  }
}

/**
 * Refresh an existing token if it's still valid
 */
function refreshToken(token) {
  try {
    // Verify current token
    const payload = verifyToken(token);

    // Create new token with updated expiration
    const newToken = createAccessToken(
      { sub: payload.sub },
      config.SESSION_TIMEOUT_MINUTES
    );

    logger.info(`Token refreshed for user: ${payload.sub}`);
    return newToken;
  } catch (error) {
    logger.error(`Token refresh failed: ${error.message}`);
    throw new AuthError('Could not refresh token');
  }
}

module.exports = {
  AuthError,
  createAccessToken,
  verifyToken,
  getCurrentUser,
  verifySessionTimeout,
  refreshToken
};
