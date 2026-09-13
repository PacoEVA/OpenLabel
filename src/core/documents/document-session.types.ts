/**
 * State representing the currently open document in the user session.
 */
export interface DocumentSession {
  /**
   * Absolute path on the filesystem where this document was opened from or saved to.
   * null indicates an unsaved new document.
   */
  readonly filePath: string | null;

  /**
   * Human-readable label for the document (e.g. filename or "Untitled Label").
   */
  readonly displayName: string;

  /**
   * Indicates whether the document has modifications relative to its saved disk state.
   */
  readonly isDirty: boolean;

  /**
   * True if the document was loaded from an older format version and migrated in memory.
   */
  readonly isMigrated: boolean;

  /**
   * ISO 8601 timestamp of the last successful save operation.
   */
  readonly lastSavedAt: string | null;
}

/**
 * Derives a human-friendly display name for a document session.
 */
export function getDocumentDisplayName(
  title: string | undefined,
  filePath: string | null
): string {
  if (filePath) {
    // Extract base name without path
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || 'Untitled.label';
  }
  return title && title.trim().length > 0 ? title.trim() : 'Untitled Label';
}
