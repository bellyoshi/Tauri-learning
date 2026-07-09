import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_MEDIA, normalizeMediaPayload, resolveMediaType } from "./mediaState";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://localhost/${path}`
}));

describe("resolveMediaType", () => {
  it("PDF拡張子を判定する", () => {
    expect(resolveMediaType("C:\\docs\\sample.pdf")).toBe("pdf");
  });

  it("画像拡張子を判定する", () => {
    expect(resolveMediaType("photo.png")).toBe("image");
    expect(resolveMediaType("photo.JPG")).toBe("image");
  });

  it("動画拡張子を判定する", () => {
    expect(resolveMediaType("clip.mp4")).toBe("video");
    expect(resolveMediaType("clip.webm")).toBe("video");
  });

  it("未対応拡張子は none を返す", () => {
    expect(resolveMediaType("notes.txt")).toBe("none");
    expect(resolveMediaType("no-extension")).toBe("none");
  });
});

describe("normalizeMediaPayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("url が空のとき path から url を生成する", () => {
    const result = normalizeMediaPayload({
      path: "C:\\media\\sample.pdf",
      url: "",
      mediaType: "pdf"
    });
    expect(result.url).toBe("asset://localhost/C:\\media\\sample.pdf");
  });

  it("既に有効な url がある場合はそのまま返す", () => {
    const payload = {
      path: "C:\\media\\sample.pdf",
      url: "asset://localhost/existing",
      mediaType: "pdf" as const
    };
    expect(normalizeMediaPayload(payload)).toEqual(payload);
  });

  it("Windows絶対パス形式の url は再生成する", () => {
    const result = normalizeMediaPayload({
      path: "C:\\media\\sample.pdf",
      url: "C:\\media\\sample.pdf",
      mediaType: "pdf"
    });
    expect(result.url).toBe("asset://localhost/C:\\media\\sample.pdf");
  });

  it("path が空のときは入力をそのまま返す", () => {
    expect(normalizeMediaPayload(EMPTY_MEDIA)).toEqual(EMPTY_MEDIA);
  });
});
