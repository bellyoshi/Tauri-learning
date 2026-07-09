import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../state/settingsState";
import { buildViewerBackgroundStyle } from "./viewerBackground";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://localhost/${path}`
}));

describe("buildViewerBackgroundStyle", () => {
  it("背景画像がないときは背景色のみを返す", () => {
    expect(buildViewerBackgroundStyle(DEFAULT_SETTINGS)).toEqual({
      backgroundColor: "#101820",
      backgroundImage: undefined,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    });
  });

  it("背景画像があるときは画像URLを返す", () => {
    const style = buildViewerBackgroundStyle({
      ...DEFAULT_SETTINGS,
      backgroundImagePath: "C:\\bg.png"
    });

    expect(style.backgroundImage).toBe('url("asset://localhost/C:\\bg.png")');
    expect(style.backgroundColor).toBe("#101820");
  });
});
