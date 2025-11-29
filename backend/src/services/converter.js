/**
 * Excel to XML Converter Service
 *
 * Converts Excel files to XML format with custom header fields
 */

const XLSX = require("xlsx");
const { create } = require("xmlbuilder2");
const fs = require("fs");
const path = require("path");
const config = require("../config");
const { auditLogger } = require("../utils/logger");
const { encryption } = require("../utils/encryption");

// XML element name constants
const XML_ROOT_ELEMENT = "CALLREPORT";
const XML_HEADER_ELEMENT = "HEADER";
const XML_BODY_ELEMENT = "BODY";
const XML_ROW_ELEMENT = "CALLREPORT_DATA";

/**
 * Excel to XML Converter Class
 */
class ExcelToXMLConverter {
	constructor() {
		this.namespace = config.XML_NAMESPACE;
		this.schemaVersion = config.XML_SCHEMA_VERSION;
		this.rowElementName = XML_ROW_ELEMENT;
	}

	/**
	 * Sanitize XML tag name to ensure it's valid
	 */
	_sanitizeXmlTag(tag) {
		if (!tag) {
			return "EMPTY_TAG";
		}

		// Convert to string and trim
		tag = String(tag).trim();

		// Replace spaces with underscores
		tag = tag.replace(/\s+/g, "_");

		// Remove invalid characters (allow only letters, digits, underscore, hyphen, period)
		tag = tag.replace(/[^a-zA-Z0-9_.-]/g, "");

		// Ensure tag starts with a letter or underscore
		if (!/^[a-zA-Z_]/.test(tag)) {
			tag = "_" + tag;
		}

		// If tag is empty after sanitization, use a fallback
		if (!tag) {
			tag = "EMPTY_TAG";
		}

		return tag;
	}

	/**
	 * Create XML header section with provided fields
	 */
	_createHeader(root, headerFields) {
		if (!headerFields || Object.keys(headerFields).length === 0) {
			return;
		}

		const header = root.ele(XML_HEADER_ELEMENT);

		for (const [key, value] of Object.entries(headerFields)) {
			try {
				// Replace spaces with underscores to maintain valid XML
				const tagName = key.replace(/\s+/g, "_");
				header
					.ele(tagName)
					.txt(value !== null && value !== undefined ? String(value) : "");
			} catch (error) {
				throw new Error(
					`Error processing header field ${key}: ${error.message}`
				);
			}
		}
	}

	/**
	 * Process Excel data and handle various data types
	 */
	_processExcelData(worksheet) {
		// Get exactly what's displayed in Excel - treat everything as text
		const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

		const getDisplay = (cell) => {
			if (!cell) return "";
			// Use the formatted display text from Excel (cell.w)
			// This preserves leading zeros, date formats, phone numbers, etc.
			if (cell.w !== undefined && cell.w !== "") return String(cell.w);
			// Fallback to raw value as string
			return cell.v !== undefined ? String(cell.v) : "";
		};

		const headerMap = {};
		for (let c = range.s.c; c <= range.e.c; c++) {
			const addr = XLSX.utils.encode_cell({ r: range.s.r, c });
			const cell = worksheet[addr];
			if (cell) {
				const headerName = getDisplay(cell).trim();
				headerMap[c] = headerName || `COL_${c + 1}`;
			} else {
				headerMap[c] = `COL_${c + 1}`;
			}
		}

		const records = [];
		for (let r = range.s.r + 1; r <= range.e.r; r++) {
			const rowRecord = {};
			let hasData = false;
			for (let c = range.s.c; c <= range.e.c; c++) {
				const addr = XLSX.utils.encode_cell({ r, c });
				const cell = worksheet[addr];
				const colName = headerMap[c];
				if (cell) {
					const text = getDisplay(cell);
					rowRecord[colName] = text;
					if (text !== "") hasData = true;
				} else {
					rowRecord[colName] = "";
				}
			}
			if (hasData) records.push(rowRecord);
		}
		return records;
	}

	/**
	 * Create XML data section from processed records
	 */
	_createDataSection(body, records) {
		for (const record of records) {
			const row = body.ele(this.rowElementName);
			for (const [fieldName, value] of Object.entries(record)) {
				// Sanitize field name
				const sanitizedName = this._sanitizeXmlTag(fieldName);
				row.ele(sanitizedName).txt(value);
			}
		}
	}

	/**
	 * Convert Excel file to XML with optional header fields and encryption
	 */
	convert(
		inputFile,
		outputFile,
		headerFields = null,
		sheetName = null,
		encryptOutput = false,
		userId = "system"
	) {
		const startTime = Date.now();

		try {
			// Validate input file exists
			if (!fs.existsSync(inputFile)) {
				throw new Error(`Input file not found: ${inputFile}`);
			}

			// Read Excel file
			let workbook;
			try {
				// Read as raw text - no formatting, no date conversion
				workbook = XLSX.readFile(inputFile, {
					type: "file",
					raw: false,
					cellText: true,
					cellDates: false,
					cellNF: false,
					cellStyles: false,
				});
			} catch (error) {
				throw new Error(`Failed to read Excel file: ${error.message}`);
			}

			// Get the sheet to process
			const sheetToProcess = sheetName || workbook.SheetNames[0];
			if (!workbook.SheetNames.includes(sheetToProcess)) {
				throw new Error(`Sheet "${sheetToProcess}" not found in workbook`);
			}

			const worksheet = workbook.Sheets[sheetToProcess];

			// Check if sheet is empty
			const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
			if (range.e.r === 0 && range.e.c === 0 && !worksheet["A1"]) {
				throw new Error("Excel file is empty");
			}

			// Process Excel data
			const records = this._processExcelData(worksheet);

			if (records.length === 0) {
				throw new Error("Excel file is empty");
			}

			// Create root element
			const root = create({ version: "1.0", encoding: "utf-8" }).ele(
				XML_ROOT_ELEMENT
			);

			// Add header fields if provided
			if (headerFields && Object.keys(headerFields).length > 0) {
				this._createHeader(root, headerFields);
			}

			// Create BODY element
			const body = root.ele(XML_BODY_ELEMENT);

			// Create data section
			this._createDataSection(body, records);

			// Convert to pretty-printed XML
			const xmlContent = root.end({ prettyPrint: true });

			// Write to file
			fs.writeFileSync(outputFile, xmlContent, "utf-8");

			// Get columns from first record
			const columns = records.length > 0 ? Object.keys(records[0]) : [];

			// Encrypt the output file if requested
			let finalOutput = outputFile;
			if (encryptOutput) {
				const encryptedOutput = outputFile.replace(".xml", ".xml.enc");
				encryption.encryptFile(outputFile, encryptedOutput);
				finalOutput = encryptedOutput;
				// Remove unencrypted file
				fs.unlinkSync(outputFile);
			}

			// Calculate conversion time
			const conversionTime = Date.now() - startTime;

			// Log successful conversion
			auditLogger.logConversionEvent(
				userId,
				String(inputFile),
				String(finalOutput),
				conversionTime,
				"success",
				{
					rows_processed: records.length,
					columns: columns,
					sheet_name: sheetToProcess,
					encrypted: encryptOutput,
				}
			);

			return {
				success: true,
				rowsProcessed: records.length,
				conversionTime,
			};
		} catch (error) {
			// Log conversion error
			auditLogger.logError(userId, "convert_excel_to_xml", error, {
				input_file: String(inputFile),
				output_file: String(outputFile),
				sheet_name: sheetName,
				encrypted: encryptOutput,
			});
			throw error;
		}
	}

	/**
	 * Validate Excel file format and content
	 */
	validateExcelFile(filePath) {
		try {
			// Check file extension
			if (!config.validateFileExtension(filePath)) {
				return false;
			}

			// Try to read the file
			const workbook = XLSX.readFile(filePath);

			// Check if file has sheets
			if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
				return false;
			}

			// Check if first sheet has data
			const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
			const jsonData = XLSX.utils.sheet_to_json(firstSheet);

			if (!jsonData || jsonData.length === 0) {
				return false;
			}

			return true;
		} catch (error) {
			auditLogger.logError("system", "validate_excel_file", error, {
				file: filePath,
			});
			return false;
		}
	}
}

// Create singleton instance
const converter = new ExcelToXMLConverter();

module.exports = {
	converter,
	ExcelToXMLConverter,
};
