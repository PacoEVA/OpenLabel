/**
 * Selection parser for batch production record ranges.
 * Supports:
 * - 'all': all records from 0 to totalAvailable - 1
 * - 'selected': explicitly selected record indices
 * - 'range': 1-indexed user strings like "1-500", "1, 3, 5-10"
 */

export interface ParsedSelectionResult {
  indices: number[];
  isValid: boolean;
  errorMessage?: string;
}

export function parseRecordSelection(
  mode: 'all' | 'selected' | 'range',
  totalAvailable: number,
  rangeStr?: string,
  selectedIndices?: number[]
): ParsedSelectionResult {
  if (totalAvailable <= 0) {
    return { indices: [], isValid: false, errorMessage: 'No records available in dataset' };
  }

  if (mode === 'all') {
    const indices = Array.from({ length: totalAvailable }, (_, i) => i);
    return { indices, isValid: true };
  }

  if (mode === 'selected') {
    const indices = (selectedIndices || []).filter((idx) => idx >= 0 && idx < totalAvailable);
    if (indices.length === 0) {
      return { indices: [], isValid: false, errorMessage: 'No records selected' };
    }
    return { indices, isValid: true };
  }

  if (mode === 'range') {
    if (!rangeStr || !rangeStr.trim()) {
      return { indices: [], isValid: false, errorMessage: 'Range cannot be empty (e.g. 1-100)' };
    }

    const set = new Set<number>();
    const parts = rangeStr.split(',').map((p) => p.trim()).filter(Boolean);

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map((s) => s.trim());
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        if (isNaN(start) || isNaN(end) || start <= 0 || end <= 0 || start > end) {
          return {
            indices: [],
            isValid: false,
            errorMessage: `Invalid range syntax: "${part}". Expected format like "1-50" where start <= end.`,
          };
        }

        // Convert 1-indexed to 0-indexed
        for (let i = start; i <= end; i++) {
          const zeroIdx = i - 1;
          if (zeroIdx < totalAvailable) {
            set.add(zeroIdx);
          }
        }
      } else {
        const single = parseInt(part, 10);
        if (isNaN(single) || single <= 0) {
          return {
            indices: [],
            isValid: false,
            errorMessage: `Invalid row number: "${part}". Must be a positive integer.`,
          };
        }
        const zeroIdx = single - 1;
        if (zeroIdx < totalAvailable) {
          set.add(zeroIdx);
        }
      }
    }

    const indices = Array.from(set).sort((a, b) => a - b);
    if (indices.length === 0) {
      return {
        indices: [],
        isValid: false,
        errorMessage: `Specified range contains no valid rows (available: 1-${totalAvailable})`,
      };
    }

    return { indices, isValid: true };
  }

  return { indices: [], isValid: false, errorMessage: 'Unknown selection mode' };
}
