import { LabelRotation } from '../../schemas/label.schema';

export type ZplOrientation = 'N' | 'R' | 'I' | 'B';

/**
 * Maps orthogonal degree rotations to ZPL native orientation flags:
 * - 0°   -> 'N' (Normal)
 * - 90°  -> 'R' (Rotated 90° clockwise)
 * - 180° -> 'I' (Inverted 180°)
 * - 270° -> 'B' (Bottom-up 270°)
 */
export function toZplOrientation(rotation: LabelRotation): ZplOrientation {
  switch (rotation) {
    case 0:
      return 'N';
    case 90:
      return 'R';
    case 180:
      return 'I';
    case 270:
      return 'B';
    default:
      throw new Error(`Unsupported rotation angle for ZPL: ${rotation}. Must be 0, 90, 180, or 270.`);
  }
}
