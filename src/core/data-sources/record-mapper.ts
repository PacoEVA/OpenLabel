import { LabelDocument } from '../schemas/label.schema';
import { DataField } from '../data/data.schema';
import { ResolvedRecord } from '../data/template-resolver';
import { resolveDocument, ResolveDocumentResult } from '../data/document-resolver';
import { Dataset, DatasetRow } from './dataset.schema';
import { FieldMapping } from './field-mapping.schema';
import { applyMappingToRow } from './mapping-validator';

export interface RowMappingError {
  rowIndex: number;
  errors: string[];
}

export interface MapDatasetResult {
  success: boolean;
  records: ResolvedRecord[];
  errors: RowMappingError[];
}

/**
 * Transforms an entire tabular Dataset into an array of Phase-7-compatible ResolvedRecords
 * using the configured FieldMapping rules and data fields.
 */
export function mapDatasetToRecords(
  dataset: Dataset,
  mapping: FieldMapping,
  dataFields: DataField[]
): MapDatasetResult {
  const records: ResolvedRecord[] = [];
  const errors: RowMappingError[] = [];

  dataset.rows.forEach((row, rowIndex) => {
    const res = applyMappingToRow(row, mapping, dataFields);
    if (res.success) {
      records.push(res.record);
    } else {
      errors.push({
        rowIndex,
        errors: res.errors,
      });
    }
  });

  return {
    success: errors.length === 0,
    records,
    errors,
  };
}

/**
 * Resolves a LabelDocument directly from a single external DatasetRow,
 * bridging the external row through FieldMapping into a ResolvedRecord,
 * and then calling the Phase 7 document resolver.
 */
export function resolveDocumentFromRow(
  document: LabelDocument,
  row: DatasetRow,
  mapping: FieldMapping
): ResolveDocumentResult {
  const fields = document.dataModel?.fields ?? [];
  const mappingResult = applyMappingToRow(row, mapping, fields);

  if (!mappingResult.success) {
    return {
      success: false,
      errors: mappingResult.errors.map((msg) => ({
        elementId: '',
        elementType: 'text',
        code: 'MISSING_FIELD',
        message: msg,
      })),
    };
  }

  return resolveDocument(document, mappingResult.record);
}
