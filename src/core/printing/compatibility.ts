import type { PrintArtifact } from './print-artifact.types';
import type { PrinterProfile } from './printer-profile.schema';

export interface CompatibilityResult {
  readonly compatible: boolean;
  readonly reason?: string;
}

/**
 * Pure function to verify whether a compiled print artifact can be delivered
 * to the given printer profile.
 */
export function isArtifactCompatibleWithProfile(
  artifact: PrintArtifact,
  profile: PrinterProfile
): CompatibilityResult {
  // 1. Profile must be enabled
  if (!profile.enabled) {
    return {
      compatible: false,
      reason: `Printer profile "${profile.name}" is disabled`,
    };
  }

  // 2. Language compatibility
  if (profile.language !== artifact.type) {
    return {
      compatible: false,
      reason: `Profile language "${profile.language}" does not match artifact type "${artifact.type}"`,
    };
  }

  // 3. Hardware DPI compatibility for ZPL
  if (artifact.type === 'zpl') {
    if (!profile.dpi) {
      return {
        compatible: false,
        reason: `Profile "${profile.name}" does not specify a hardware DPI for ZPL`,
      };
    }
    if (profile.dpi !== artifact.dpi) {
      return {
        compatible: false,
        reason: `Artifact compiled for ${artifact.dpi} DPI cannot be printed on a ${profile.dpi} DPI profile without recompilation`,
      };
    }
  }

  // 4. Connection transport rules
  if (profile.connection.type === 'tcp') {
    if (artifact.type !== 'zpl') {
      return {
        compatible: false,
        reason: `TCP Raw connection only supports ZPL artifacts in Phase 5`,
      };
    }
  } else if (profile.connection.type === 'system') {
    if (artifact.type !== 'pdf') {
      return {
        compatible: false,
        reason: `System spooler connection only supports PDF artifacts in Phase 5`,
      };
    }
  }

  return { compatible: true };
}
