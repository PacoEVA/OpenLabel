import { LabelDocument } from '../schemas/label.schema';
import { PrinterProfile } from '../printing/printer-profile.schema';
import {
  ProductionRecord,
  ProductionPreflightResult,
  ProductionPreflightIssue,
} from './production.schema';
import { validateBarcodeData } from '../barcodes/barcode-validator';
import { resolveTemplate } from '../data/template-resolver';
import { extractFieldNames } from '../data/template-parser';

export interface ProductionPreflightInput {
  document: LabelDocument;
  printerProfile: PrinterProfile;
  records: ProductionRecord[];
  copiesPerRecord?: number;
  skipInvalidRows?: boolean;
}

/**
 * Computes a fast, deterministic preflight fingerprint based purely on
 * immutable template, printer, and record content (excluding execution timestamps).
 */
export function computePreflightFingerprint(
  document: LabelDocument,
  printerProfile: PrinterProfile,
  records: ProductionRecord[],
  copiesPerRecord: number = 1
): string {
  // Deterministic DJB2 hash for pure TS core
  const payload = JSON.stringify({
    docVersion: document.version,
    dimensions: document.dimensions,
    elements: document.elements,
    printerDpi: printerProfile.dpi,
    printerLanguage: printerProfile.language,
    recordCount: records.length,
    firstRecord: records[0]?.values,
    lastRecord: records[records.length - 1]?.values,
    copiesPerRecord,
  });

  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
  }
  return `fp-${(hash >>> 0).toString(16)}`;
}

/**
 * Runs preflight validation across all records in cold memory before creating a ProductionPlan.
 * Does not cause any physical effects or printer calls.
 */
export function runProductionPreflight(input: ProductionPreflightInput): ProductionPreflightResult {
  const {
    document,
    printerProfile,
    records,
    copiesPerRecord = 1,
  } = input;

  const issues: ProductionPreflightIssue[] = [];

  // 1. Validate copies
  if (copiesPerRecord < 1 || !Number.isInteger(copiesPerRecord)) {
    issues.push({
      level: 'error',
      code: 'INVALID_COPIES',
      message: `copiesPerRecord must be an integer >= 1, received ${copiesPerRecord}`,
    });
  }

  // 2. Validate records count
  if (!records || records.length === 0) {
    issues.push({
      level: 'error',
      code: 'EMPTY_RECORDS',
      message: 'Production preflight requires at least one record',
    });
  }

  // 3. Validate printer profile compatibility
  if (printerProfile.dpi !== undefined && printerProfile.dpi !== document.dimensions.dpi) {
    issues.push({
      level: 'error',
      code: 'DPI_MISMATCH',
      message: `Document DPI (${document.dimensions.dpi}) does not match printer profile DPI (${printerProfile.dpi})`,
    });
  }

  // Check static element bounds against document dimensions
  for (const element of document.elements) {
    if (element.x + element.width > document.dimensions.width) {
      issues.push({
        level: 'warning',
        elementId: element.id,
        code: 'ELEMENT_OUT_OF_BOUNDS_X',
        message: `Element ${element.id} exceeds label width boundary (${element.x + element.width} > ${document.dimensions.width})`,
      });
    }
    if (element.y + element.height > document.dimensions.height) {
      issues.push({
        level: 'warning',
        elementId: element.id,
        code: 'ELEMENT_OUT_OF_BOUNDS_Y',
        message: `Element ${element.id} exceeds label height boundary (${element.y + element.height} > ${document.dimensions.height})`,
      });
    }
  }

  // 4. Validate records & per-record dynamic resolution
  let invalidRecordsCount = 0;

  const counterFields = (document.dataModel?.fields || []).filter(
    (f): f is import('../data/data.schema').CounterField => f.type === 'counter'
  );

  for (const record of records) {
    let recordHasError = false;

    // Simulate counters in cold memory for this record index so preflight can validate barcode/text
    const simulatedCounters = counterFields.length > 0 ? (await_or_sync_counters => {
      const res: Record<string, string> = {};
      for (const field of counterFields) {
        const numericValue = field.start + record.index * field.step;
        const isNegative = numericValue < 0;
        const absStr = Math.abs(numericValue).toString().padStart(field.padding, '0');
        const formatted = isNegative ? `-${absStr}` : absStr;
        res[field.name] = `${field.prefix ?? ''}${formatted}${field.suffix ?? ''}`;
      }
      return res;
    })() : {};

    const effectiveValues = {
      ...simulatedCounters,
      ...record.values,
    };

    // Check each element in document
    for (const element of document.elements) {
      if (element.type === 'text') {
        const requiredVars = extractFieldNames(element.content);
        for (const varName of requiredVars) {
          if (!(varName in effectiveValues)) {
            issues.push({
              level: 'error',
              recordIndex: record.index,
              elementId: element.id,
              fieldName: varName,
              code: 'MISSING_VARIABLE_VALUE',
              message: `Row ${record.index}: Variable '{${varName}}' is required by text element '${element.id}' but missing in record`,
            });
            recordHasError = true;
          }
        }
      } else if (element.type === 'barcode') {
        const requiredVars = extractFieldNames(element.data);
        for (const varName of requiredVars) {
          if (!(varName in effectiveValues)) {
            issues.push({
              level: 'error',
              recordIndex: record.index,
              elementId: element.id,
              fieldName: varName,
              code: 'MISSING_BARCODE_VARIABLE',
              message: `Row ${record.index}: Variable '{${varName}}' is required by barcode element '${element.id}' but missing in record`,
            });
            recordHasError = true;
          }
        }

        // If all variables are present, resolve and validate barcode syntax
        const res = resolveTemplate(element.data, effectiveValues);
        if (res.success) {
          const barcodeValidation = validateBarcodeData(element.symbology, res.value);
          if (!barcodeValidation.valid) {
            issues.push({
              level: 'error',
              recordIndex: record.index,
              elementId: element.id,
              code: barcodeValidation.errorCode || 'INVALID_BARCODE',
              message: `Row ${record.index}: Barcode validation failed for '${element.symbology}': ${barcodeValidation.error}`,
            });
            recordHasError = true;
          }
        }
      } else if (element.type === 'qrcode') {
        const requiredVars = extractFieldNames(element.data);
        for (const varName of requiredVars) {
          if (!(varName in effectiveValues)) {
            issues.push({
              level: 'error',
              recordIndex: record.index,
              elementId: element.id,
              fieldName: varName,
              code: 'MISSING_QRCODE_VARIABLE',
              message: `Row ${record.index}: Variable '{${varName}}' is required by qrcode element '${element.id}' but missing in record`,
            });
            recordHasError = true;
          }
        }

        const res = resolveTemplate(element.data, effectiveValues);
        if (res.success) {
          const qrValidation = validateBarcodeData('qrcode', res.value);
          if (!qrValidation.valid) {
            issues.push({
              level: 'error',
              recordIndex: record.index,
              elementId: element.id,
              code: qrValidation.errorCode || 'INVALID_QRCODE',
              message: `Row ${record.index}: QRCode validation failed: ${qrValidation.error}`,
            });
            recordHasError = true;
          }
        }
      }
    }

    if (recordHasError) {
      invalidRecordsCount++;
    }
  }

  const hasErrors = issues.some((iss) => iss.level === 'error');
  const validItems = Math.max(0, records.length - invalidRecordsCount);

  return {
    success: !hasErrors,
    validItems,
    invalidItems: invalidRecordsCount,
    fingerprint: computePreflightFingerprint(document, printerProfile, records, copiesPerRecord),
    issues,
    executedAt: new Date().toISOString(),
  };
}
