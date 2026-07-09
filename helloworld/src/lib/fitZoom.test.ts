import { describe, expect, it } from "vitest";
import { calculateFitZoom } from "./fitZoom";

describe("calculateFitZoom", () => {
  const viewerSize = { width: 1200, height: 900 };
  const mediaSize = { width: 600, height: 800 };

  it("ウインドウ幅に合わせてズームを計算する", () => {
    expect(calculateFitZoom("width", viewerSize, mediaSize, 0)).toBeCloseTo(1.96);
  });

  it("全体表示のズームは縦横の小さい方に合わせる", () => {
    expect(calculateFitZoom("whole", viewerSize, mediaSize, 0)).toBeCloseTo(1.125);
  });

  it("90度回転時は縦横を入れ替えて計算する", () => {
    expect(calculateFitZoom("width", viewerSize, mediaSize, 90)).toBeCloseTo(1.47);
  });

  it("ビューワーサイズが不正なとき null を返す", () => {
    expect(calculateFitZoom("width", { width: 0, height: 900 }, mediaSize, 0)).toBeNull();
  });
});
