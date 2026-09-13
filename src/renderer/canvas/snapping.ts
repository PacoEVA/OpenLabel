import { Point, mmToCanvasPx, canvasPxToMm } from './coordinates';

/**
 * OpenLabels - Pure Snapping Engine
 * Decoupled from Konva and DOM for absolute testability.
 */

export interface SnapResult {
  value: number;
  snapped: boolean;
  guidePosition?: number;
}

export interface SnapPointResult {
  point: Point;
  snappedX: boolean;
  snappedY: boolean;
}

/**
 * Snaps a 1D physical value (in mm) to the nearest target grid line or border
 * if the distance in visual screen pixels is within the specified threshold.
 */
export function snapValue(
  valueMm: number,
  targetMm: number,
  thresholdPx: number,
  zoom: number = 1
): SnapResult {
  const diffMm = Math.abs(valueMm - targetMm);
  const diffPx = mmToCanvasPx(diffMm, zoom);

  if (diffPx <= thresholdPx) {
    return {
      value: targetMm,
      snapped: true,
      guidePosition: targetMm,
    };
  }

  return {
    value: valueMm,
    snapped: false,
  };
}

/**
 * Snaps a 1D physical value (in mm) to the nearest step of a grid (e.g. 1mm grid).
 */
export function snapToGrid(
  valueMm: number,
  gridSizeMm: number,
  thresholdPx: number,
  zoom: number = 1
): SnapResult {
  if (gridSizeMm <= 0) {
    return { value: valueMm, snapped: false };
  }

  const nearestGridStep = Math.round(valueMm / gridSizeMm) * gridSizeMm;
  return snapValue(valueMm, nearestGridStep, thresholdPx, zoom);
}

/**
 * Snaps a 2D physical point {x, y} to document boundaries (0, document width/height)
 * and to the user-configured grid.
 */
export function snapPointToBoundsAndGrid(
  pointMm: Point,
  elementDimsMm: { width: number; height: number },
  docDimsMm: { width: number; height: number },
  gridSizeMm: number,
  thresholdPx: number,
  zoom: number = 1,
  snapEnabled: boolean = true,
  gridEnabled: boolean = true
): SnapPointResult {
  if (!snapEnabled) {
    return {
      point: { ...pointMm },
      snappedX: false,
      snappedY: false,
    };
  }

  let finalX = pointMm.x;
  let finalY = pointMm.y;
  let snappedX = false;
  let snappedY = false;

  // 1. Snap X to Document Left Border (x = 0)
  const leftBorderSnap = snapValue(finalX, 0, thresholdPx, zoom);
  if (leftBorderSnap.snapped) {
    finalX = leftBorderSnap.value;
    snappedX = true;
  } else {
    // Snap X to Document Right Border (x + width = doc.width -> x = doc.width - width)
    const rightTarget = docDimsMm.width - elementDimsMm.width;
    const rightBorderSnap = snapValue(finalX, rightTarget, thresholdPx, zoom);
    if (rightBorderSnap.snapped) {
      finalX = rightBorderSnap.value;
      snappedX = true;
    } else if (gridEnabled) {
      // Snap X to Grid
      const gridSnapX = snapToGrid(finalX, gridSizeMm, thresholdPx, zoom);
      if (gridSnapX.snapped) {
        finalX = gridSnapX.value;
        snappedX = true;
      }
    }
  }

  // 2. Snap Y to Document Top Border (y = 0)
  const topBorderSnap = snapValue(finalY, 0, thresholdPx, zoom);
  if (topBorderSnap.snapped) {
    finalY = topBorderSnap.value;
    snappedY = true;
  } else {
    // Snap Y to Document Bottom Border (y + height = doc.height -> y = doc.height - height)
    const bottomTarget = docDimsMm.height - elementDimsMm.height;
    const bottomBorderSnap = snapValue(finalY, bottomTarget, thresholdPx, zoom);
    if (bottomBorderSnap.snapped) {
      finalY = bottomBorderSnap.value;
      snappedY = true;
    } else if (gridEnabled) {
      // Snap Y to Grid
      const gridSnapY = snapToGrid(finalY, gridSizeMm, thresholdPx, zoom);
      if (gridSnapY.snapped) {
        finalY = gridSnapY.value;
        snappedY = true;
      }
    }
  }

  return {
    point: {
      x: Math.max(0, Math.min(finalX, docDimsMm.width - elementDimsMm.width)),
      y: Math.max(0, Math.min(finalY, docDimsMm.height - elementDimsMm.height)),
    },
    snappedX,
    snappedY,
  };
}
