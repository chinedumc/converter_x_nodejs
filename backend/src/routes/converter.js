/**
 * Converter Routes
 *
 * API endpoints for file validation, conversion, and download
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");
const { converter } = require("../services/converter");
const { auditLogger, logger } = require("../utils/logger");
const { encryption } = require("../utils/encryption");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		// Use system temp directory for uploads
		const tempDir = path.join(require("os").tmpdir(), "converter_x_uploads");
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}
		cb(null, tempDir);
	},
	filename: (req, file, cb) => {
		const fileId = uuidv4();
		const ext = path.extname(file.originalname);
		cb(null, `${fileId}_input${ext}`);
	},
});

const fileFilter = (req, file, cb) => {
	const ext = path.extname(file.originalname).toLowerCase();
	if (config.ALLOWED_EXTENSIONS.includes(ext)) {
		cb(null, true);
	} else {
		cb(
			new Error(
				`Invalid file type. Only ${config.ALLOWED_EXTENSIONS.join(
					", "
				)} files are allowed`
			),
			false
		);
	}
};

const upload = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: config.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
	},
});

/**
 * Health check endpoint
 * GET /api/v1/health
 */
router.get("/health", (req, res) => {
	res.json({
		status: "healthy",
		version: config.XML_SCHEMA_VERSION,
		timestamp: new Date().toISOString(),
	});
});

/**
 * Validate Excel file before conversion
 * POST /api/v1/validate
 */
router.post("/validate", upload.single("file"), async (req, res) => {
	let uploadedFilePath = null;

	try {
		if (!req.file) {
			return res.status(400).json({
				is_valid: false,
				message: "No file uploaded",
			});
		}

		uploadedFilePath = req.file.path;
		const fileSize = req.file.size;
		const fileType = path.extname(req.file.originalname);

		logger.info(
			`File upload attempt: filename=${req.file.originalname}, content_type=${req.file.mimetype}`
		);

		// Validate file size
		if (fileSize > config.MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
			return res.json({
				is_valid: false,
				message: `File size exceeds ${config.MAX_UPLOAD_SIZE_MB}MB limit`,
				file_size: fileSize,
				file_type: fileType,
			});
		}

		// Validate file type
		if (!config.validateFileExtension(req.file.originalname)) {
			return res.json({
				is_valid: false,
				message: "Invalid file type. Only .xls and .xlsx files are allowed",
				file_size: fileSize,
				file_type: fileType,
			});
		}

		// Validate Excel content
		const isValid = converter.validateExcelFile(uploadedFilePath);

		logger.info(`File upload success: filename=${req.file.originalname}`);

		res.json({
			is_valid: isValid,
			message: isValid ? "File is valid" : "Invalid Excel file format",
			file_size: fileSize,
			file_type: fileType,
		});
	} catch (error) {
		logger.error(
			`File upload failed: filename=${req.file?.originalname}, error=${error.message}`
		);
		auditLogger.logError("system", "validate_file", error, {
			filename: req.file?.originalname,
		});
		res.status(400).json({ detail: error.message });
	} finally {
		// Cleanup uploaded file
		if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
			fs.unlinkSync(uploadedFilePath);
		}
	}
});

/**
 * Convert Excel file to XML
 * POST /api/v1/convert
 */
router.post("/convert", upload.single("file"), async (req, res) => {
	const startTime = Date.now();
	let inputPath = null;
	let outputPath = null;

	try {
		if (!req.file) {
			return res.status(400).json({
				status: "error",
				message: "No file uploaded",
			});
		}

		inputPath = req.file.path;
		const fileSize = req.file.size;

		// Log file upload attempt
		auditLogger.logFileOperation(
			"system",
			"upload",
			req.file.originalname,
			fileSize,
			"success",
			{ file_type: path.extname(req.file.originalname) }
		);

		// Parse request data for header fields
		let headerFields = {};
		const requestData = req.body.request_data;

		// Debug: log to console.error so it shows in docker logs
		console.error("=== BACKEND DEBUG ===");
		console.error("Request body keys:", Object.keys(req.body));
		console.error("header_fields value:", req.body.header_fields);
		console.error("request_data value:", requestData);

		// Debug: log what we received
		logger.info(`Request body keys: ${Object.keys(req.body).join(", ")}`);
		logger.info(`header_fields raw: ${req.body.header_fields}`);
		logger.info(`request_data raw: ${requestData}`);

		// Preferred: parse JSON from request_data containing header_fields
		if (requestData) {
			try {
				const requestDict = JSON.parse(requestData);
				const headerArray = requestDict.header_fields || [];
				logger.info(
					`Parsed header_fields from request_data: ${JSON.stringify(
						headerArray
					)}`
				);
				for (const field of headerArray) {
					if (field.tagName && field.tagValue !== undefined) {
						const tagName = field.tagName.replace(/\s+/g, "_");
						headerFields[tagName] = field.tagValue;
					}
				}
			} catch (parseError) {
				auditLogger.logConversionEvent(
					"system",
					req.file.originalname,
					"",
					0,
					"error",
					{ error: `Invalid request data format: ${parseError.message}` }
				);
				return res.status(400).json({ detail: "Invalid request data format" });
			}
		} else if (req.body.header_fields) {
			// Fallback: frontend sent header_fields directly as a JSON string
			try {
				const headerArray = JSON.parse(req.body.header_fields);
				logger.info(
					`Parsed header_fields directly: ${JSON.stringify(headerArray)}`
				);
				for (const field of headerArray) {
					if (field.tagName && field.tagValue !== undefined) {
						const tagName = String(field.tagName).replace(/\s+/g, "_");
						headerFields[tagName] = field.tagValue;
					}
				}
			} catch (parseError) {
				auditLogger.logConversionEvent(
					"system",
					req.file.originalname,
					"",
					0,
					"error",
					{ error: `Invalid header_fields format: ${parseError.message}` }
				);
				return res.status(400).json({ detail: "Invalid header_fields format" });
			}
		}

		logger.info(`Final headerFields object: ${JSON.stringify(headerFields)}`);
		logger.info(`Header fields count: ${Object.keys(headerFields).length}`);

		// Generate unique file ID and output path
		const fileId = uuidv4();
		outputPath = config.getOutputPath(`${fileId}_output.xml`);

		// Get encryption and sheet options from request
		let encryptOutput = false;
		let sheetName = null;

		if (requestData) {
			try {
				const requestDict = JSON.parse(requestData);
				encryptOutput = requestDict.encrypt_output || false;
				sheetName = requestDict.sheet_name || null;
			} catch (e) {
				// Ignore parse errors for these optional fields
			}
		} else {
			// Fallback: accept fields directly if provided
			if (typeof req.body.encrypt_output !== "undefined") {
				const val = req.body.encrypt_output;
				encryptOutput = val === true || val === "true";
			}
			if (
				typeof req.body.sheet_name === "string" &&
				req.body.sheet_name.trim()
			) {
				sheetName = req.body.sheet_name.trim();
			}
		}

		// Convert file
		converter.convert(
			inputPath,
			outputPath,
			headerFields,
			sheetName,
			encryptOutput,
			"system"
		);

		// Generate download URL
		const downloadUrl = `${config.API_V1_PREFIX}/download/${fileId}`;

		// Determine the actual output file (could be encrypted)
		const encryptedPath = outputPath.replace(".xml", ".xml.enc");
		const actualOutputPath = fs.existsSync(encryptedPath)
			? encryptedPath
			: outputPath;

		// Log successful conversion
		const conversionTime = (Date.now() - startTime) / 1000;
		auditLogger.logConversionEvent(
			"system",
			req.file.originalname,
			actualOutputPath,
			conversionTime,
			"success",
			{
				input_size: fileSize,
				output_size: fs.existsSync(actualOutputPath)
					? fs.statSync(actualOutputPath).size
					: 0,
				header_fields: Object.keys(headerFields).length,
			}
		);

		res.json({
			status: "success",
			message: "File converted successfully",
			downloadUrl,
		});
	} catch (error) {
		logger.error(
			`Conversion failed for file: ${req.file?.originalname} - ${error.message}`
		);
		res.status(500).json({
			detail: config.SHOW_ERROR_DETAILS
				? error.message
				: "An error occurred during the conversion process. Please try again later.",
		});
	} finally {
		// Cleanup input file
		if (inputPath && fs.existsSync(inputPath)) {
			fs.unlinkSync(inputPath);
		}
	}
});

/**
 * Download converted file
 * GET /api/v1/download/:fileId
 */
router.get("/download/:fileId", async (req, res) => {
	const { fileId } = req.params;

	try {
		// Check for both encrypted and unencrypted files
		const encryptedPath = config.getOutputPath(`${fileId}_output.xml.enc`);
		const unencryptedPath = config.getOutputPath(`${fileId}_output.xml`);

		let filePath = null;
		let tempPath = null;

		if (fs.existsSync(unencryptedPath)) {
			filePath = unencryptedPath;
		} else if (fs.existsSync(encryptedPath)) {
			// Decrypt file to temporary location
			tempPath = config.getOutputPath(`temp_${fileId}.xml`);
			encryption.decryptFile(encryptedPath, tempPath);
			filePath = tempPath;
		} else {
			auditLogger.logFileOperation(
				"system",
				"download",
				`${fileId}.xml`,
				0,
				"error",
				{ error: "File not found" }
			);
			return res.status(404).json({ detail: "File not found" });
		}

		const fileSize = fs.statSync(filePath).size;

		// Log download
		auditLogger.logFileOperation(
			"system",
			"file_download",
			`${fileId}.xml`,
			fileSize,
			"success"
		);

		logger.info(`File download success: filename=${fileId}`);

		// Send file
		res.download(filePath, `converted_${fileId}.xml`, (err) => {
			// Cleanup temporary file after download
			if (tempPath && fs.existsSync(tempPath)) {
				fs.unlinkSync(tempPath);
			}
			// Cleanup original output file
			if (fs.existsSync(unencryptedPath)) {
				fs.unlinkSync(unencryptedPath);
			}
			if (fs.existsSync(encryptedPath)) {
				fs.unlinkSync(encryptedPath);
			}
		});
	} catch (error) {
		logger.error(
			`File download failed: filename=${fileId}, error=${error.message}`
		);
		auditLogger.logError("system", "download_file", error, { file_id: fileId });
		res.status(400).json({ detail: error.message });
	}
});

// Error handling for multer
router.use((error, req, res, next) => {
	if (error instanceof multer.MulterError) {
		if (error.code === "LIMIT_FILE_SIZE") {
			return res.status(413).json({
				detail: `File size exceeds ${config.MAX_UPLOAD_SIZE_MB}MB limit`,
			});
		}
	}
	if (error.message && error.message.includes("Invalid file type")) {
		return res.status(400).json({ detail: error.message });
	}
	next(error);
});

module.exports = router;
