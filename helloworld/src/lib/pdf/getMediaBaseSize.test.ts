import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeMediaPayload } from "../../state/mediaState";
import { getMediaBaseSize } from "./getMediaBaseSize";

const getPageMock = vi.fn();

vi.mock("./setup", () => ({
  pdfjsLib: {
    getDocument: vi.fn(() => ({
      promise: Promise.resolve({
        getPage: (...args: unknown[]) => getPageMock(...args)
      })
    }))
  }
}));

describe("getMediaBaseSize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPageMock.mockResolvedValue({
      getViewport: vi.fn(() => ({ width: 400, height: 600 }))
    });
  });

  it("url が空のとき null を返す", async () => {
    const media = normalizeMediaPayload({ path: "", url: "", mediaType: "none" });
    await expect(getMediaBaseSize(media, 1)).resolves.toBeNull();
  });

  it("PDFのページサイズを返す", async () => {
    const media = normalizeMediaPayload({
      path: "C:\\docs\\sample.pdf",
      url: "asset://localhost/sample.pdf",
      mediaType: "pdf"
    });

    await expect(getMediaBaseSize(media, 2)).resolves.toEqual({ width: 400, height: 600 });
    expect(getPageMock).toHaveBeenCalledWith(2);
  });

  it("0以下のページ番号は1ページ目として扱う", async () => {
    const media = normalizeMediaPayload({
      path: "C:\\docs\\sample.pdf",
      url: "asset://localhost/sample.pdf",
      mediaType: "pdf"
    });

    await getMediaBaseSize(media, 0);
    expect(getPageMock).toHaveBeenCalledWith(1);
  });

  it("画像の自然サイズを返す", async () => {
    class MockImage {
      naturalWidth = 800;
      naturalHeight = 600;
      onload: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal("Image", MockImage);

    const media = normalizeMediaPayload({
      path: "C:\\media\\photo.png",
      url: "asset://localhost/photo.png",
      mediaType: "image"
    });

    await expect(getMediaBaseSize(media, 1)).resolves.toEqual({ width: 800, height: 600 });
  });

  it("動画のメタデータサイズを返す", async () => {
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "video") {
        const element = originalCreateElement("div") as unknown as HTMLVideoElement;
        Object.defineProperty(element, "videoWidth", { value: 1920 });
        Object.defineProperty(element, "videoHeight", { value: 1080 });
        queueMicrotask(() => element.onloadedmetadata?.(new Event("loadedmetadata")));
        return element;
      }
      return originalCreateElement(tagName);
    });

    const media = normalizeMediaPayload({
      path: "C:\\media\\clip.mp4",
      url: "asset://localhost/clip.mp4",
      mediaType: "video"
    });

    await expect(getMediaBaseSize(media, 1)).resolves.toEqual({ width: 1920, height: 1080 });
  });

  it("未対応メディア種別は null を返す", async () => {
    const media = normalizeMediaPayload({ path: "", url: "", mediaType: "none" });
    await expect(getMediaBaseSize(media, 1)).resolves.toBeNull();
  });
});
