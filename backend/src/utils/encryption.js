/**
 * Encryption Utility
 * 
 * Provides AES-256 encryption/decryption for data and files
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { auditLogger } = require('./logger');

/**
 * AES-256 Encryption Class
 */
class AESEncryption {
  constructor() {
    // Derive a 32-byte key from the encryption key using PBKDF2
    this.key = this._deriveKey(config.ENCRYPTION_KEY || 'default-key');
    this.algorithm = 'aes-256-cbc';
    this.ivLength = 16;
  }

  /**
   * Derive a 32-byte key using PBKDF2
   */
  _deriveKey(key, salt = 'converter_x_fixed_salt') {
    return crypto.pbkdf2Sync(
      key,
      salt,
      100000,
      32,
      'sha256'
    );
  }

  /**
   * Encrypt data using AES-256 CBC
   */
  encryptData(data) {
    try {
      // Convert string to buffer if necessary
      const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');

      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(dataBuffer),
        cipher.final()
      ]);

      // Combine IV and ciphertext and encode to base64
      const result = Buffer.concat([iv, encrypted]).toString('base64');

      auditLogger.logSecurityEvent('system', 'encrypt_data', 'localhost', 'success', {
        operation: 'encrypt',
        size: dataBuffer.length
      });

      return result;
    } catch (error) {
      auditLogger.logError('system', 'encrypt_data', error, { operation: 'encrypt' });
      throw error;
    }
  }

  /**
   * Decrypt data using AES-256 CBC
   */
  decryptData(encryptedData) {
    try {
      // Decode from base64
      const encryptedBuffer = Buffer.from(encryptedData, 'base64');

      // Extract IV and ciphertext
      const iv = encryptedBuffer.subarray(0, this.ivLength);
      const ciphertext = encryptedBuffer.subarray(this.ivLength);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);

      auditLogger.logSecurityEvent('system', 'decrypt_data', 'localhost', 'success', {
        operation: 'decrypt',
        size: decrypted.length
      });

      return decrypted;
    } catch (error) {
      auditLogger.logError('system', 'decrypt_data', error, { operation: 'decrypt' });
      throw error;
    }
  }

  /**
   * Encrypt a file using AES-256
   */
  encryptFile(inputPath, outputPath) {
    try {
      // Read file content
      const data = fs.readFileSync(inputPath);

      // Encrypt data
      const encryptedData = this.encryptData(data);

      // Write encrypted data
      fs.writeFileSync(outputPath, encryptedData, 'utf-8');

      auditLogger.logSecurityEvent('system', 'encrypt_file', 'localhost', 'success', {
        input_file: inputPath,
        output_file: outputPath,
        size: data.length
      });
    } catch (error) {
      auditLogger.logError('system', 'encrypt_file', error, { file: inputPath });
      throw error;
    }
  }

  /**
   * Decrypt a file using AES-256
   */
  decryptFile(inputPath, outputPath) {
    try {
      // Read encrypted data
      const encryptedData = fs.readFileSync(inputPath, 'utf-8');

      // Decrypt data
      const decryptedData = this.decryptData(encryptedData);

      // Write decrypted data
      fs.writeFileSync(outputPath, decryptedData);

      auditLogger.logSecurityEvent('system', 'decrypt_file', 'localhost', 'success', {
        input_file: inputPath,
        output_file: outputPath,
        size: decryptedData.length
      });
    } catch (error) {
      auditLogger.logError('system', 'decrypt_file', error, { file: inputPath });
      throw error;
    }
  }
}

// Create singleton instance
const encryption = new AESEncryption();

module.exports = {
  encryption
};
