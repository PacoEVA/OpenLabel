import { LabelDocument } from '../schemas/label.schema';
import { extractFieldNames, renameFieldInTemplate } from './template-parser';

export interface FieldUsage {
  elementId: string;
  elementType: 'text' | 'barcode' | 'qrcode';
  property: 'content' | 'data';
}

/**
 * Searches a LabelDocument for all elements referencing a given fieldName.
 */
export function findFieldUsages(document: LabelDocument, fieldName: string): FieldUsage[] {
  const usages: FieldUsage[] = [];

  for (const el of document.elements) {
    if (el.type === 'text') {
      const names = extractFieldNames(el.content);
      if (names.includes(fieldName)) {
        usages.push({ elementId: el.id, elementType: 'text', property: 'content' });
      }
    } else if (el.type === 'barcode') {
      const names = extractFieldNames(el.data);
      if (names.includes(fieldName)) {
        usages.push({ elementId: el.id, elementType: 'barcode', property: 'data' });
      }
    } else if (el.type === 'qrcode') {
      const names = extractFieldNames(el.data);
      if (names.includes(fieldName)) {
        usages.push({ elementId: el.id, elementType: 'qrcode', property: 'data' });
      }
    }
  }

  return usages;
}

/**
 * Atomically renames a variable field within document.dataModel and updates
 * all references in text, barcode, and qrcode templates.
 */
export function renameFieldInDocument(
  document: LabelDocument,
  oldName: string,
  newName: string
): LabelDocument {
  const fields = document.dataModel?.fields ?? [];
  const updatedFields = fields.map((f) => (f.name === oldName ? { ...f, name: newName } : f));

  const updatedElements = document.elements.map((el) => {
    if (el.type === 'text') {
      return { ...el, content: renameFieldInTemplate(el.content, oldName, newName) };
    }
    if (el.type === 'barcode') {
      return { ...el, data: renameFieldInTemplate(el.data, oldName, newName) };
    }
    if (el.type === 'qrcode') {
      return { ...el, data: renameFieldInTemplate(el.data, oldName, newName) };
    }
    return el;
  });

  return {
    ...document,
    elements: updatedElements,
    dataModel: {
      fields: updatedFields,
    },
  };
}
