import { describe, expect, it } from "vitest";
import {
  VALID_ROTATIONS,
  clampZoom,
  isValidRotation,
  mediaTransformStyle,
  zoomIn,
  zoomOut
} from "./viewTransform";

describe("viewTransform", () => {
  it("ズーム値を最小/最大の範囲に収める", () => {
    expect(clampZoom(0.1)).toBe(0.2);
    expect(clampZoom(5)).toBe(5);
    expect(clampZoom(99)).toBe(10);
  });

  it("ズームイン/アウトを刻み幅で変更する", () => {
    expect(zoomIn(1)).toBeCloseTo(1.1);
    expect(zoomOut(1)).toBeCloseTo(0.9);
  });

  it("有効な回転角のみ許可する", () => {
    for (const rotation of VALID_ROTATIONS) {
      expect(isValidRotation(rotation)).toBe(true);
    }
    expect(isValidRotation(45)).toBe(false);
  });

  it("ズームと回転を表示スタイルに変換する", () => {
    expect(mediaTransformStyle(1.5, 90)).toEqual({
      zoom: 1.5,
      transform: "rotate(90deg)",
      transformOrigin: "top center"
    });
  });
});
