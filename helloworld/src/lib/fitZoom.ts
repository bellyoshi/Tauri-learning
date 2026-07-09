import { clampZoom } from "./viewTransform";

const FIT_WIDTH_MARGIN = 0.98;

export function calculateFitZoom(
  mode: "width" | "whole",
  viewerSize: { width: number; height: number },
  mediaSize: { width: number; height: number },
  rotation: number
): number | null {
  if (viewerSize.width <= 0 || viewerSize.height <= 0) return null;

  const rotated = rotation % 180 !== 0;
  const mediaWidth = rotated ? mediaSize.height : mediaSize.width;
  const mediaHeight = rotated ? mediaSize.width : mediaSize.height;
  if (mediaWidth <= 0) return null;

  const nextZoom =
    mode === "width"
      ? (viewerSize.width * FIT_WIDTH_MARGIN) / mediaWidth
      : Math.min(viewerSize.width / mediaWidth, viewerSize.height / mediaHeight);

  return clampZoom(nextZoom);
}
