import type { CSSProperties } from "react";

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 10;
export const ZOOM_STEP = 0.1;
export const VALID_ROTATIONS = [0, 90, 180, 270] as const;

export type Rotation = (typeof VALID_ROTATIONS)[number];

export function clampZoom(value: number): number {
  return Math.max(ZOOM_MIN, Math.min(value, ZOOM_MAX));
}

export function zoomIn(current: number): number {
  return clampZoom(current + ZOOM_STEP);
}

export function zoomOut(current: number): number {
  return clampZoom(current - ZOOM_STEP);
}

export function isValidRotation(value: number): value is Rotation {
  return (VALID_ROTATIONS as readonly number[]).includes(value);
}

export function mediaTransformStyle(zoom: number, rotation: number): CSSProperties {
  return {
    zoom,
    transform: `rotate(${rotation}deg)`,
    transformOrigin: "top center"
  };
}
