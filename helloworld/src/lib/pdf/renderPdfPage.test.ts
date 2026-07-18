import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdfDocument, renderPdfPageToCanvas } from "./renderPdfPage";

const getPageMock = vi.fn();
const getDocumentMock = vi.fn(() => ({
  promise: Promise.resolve({
    numPages: 3,
    getPage: getPageMock
  })
}));

vi.mock("./setup", () => ({
  pdfjsLib: {
    getDocument: (...args: unknown[]) => getDocumentMock(...(args as []))
  }
}));

describe("renderPdfPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loadPdfDocument は pdfjs からドキュメントを取得する", async () => {
    const doc = await loadPdfDocument("asset://localhost/sample.pdf");
    expect(getDocumentMock).toHaveBeenCalledWith("asset://localhost/sample.pdf");
    expect(doc.numPages).toBe(3);
  });

  it("ページ番号をドキュメント範囲内に収めて描画する", async () => {
    const renderMock = vi.fn(() => ({ promise: Promise.resolve() }));
    const getViewportMock = vi.fn(() => ({ width: 200, height: 300 }));
    getPageMock.mockResolvedValue({
      getViewport: getViewportMock,
      render: renderMock
    });

    const canvas = document.createElement("canvas");
    const context = { fillRect: vi.fn() };
    vi.spyOn(canvas, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);

    const doc = { numPages: 3, getPage: getPageMock } as unknown as PDFDocumentProxy;
    await renderPdfPageToCanvas(canvas, { doc, page: 99, zoom: 2, rotation: 90 });

    expect(getPageMock).toHaveBeenCalledWith(3);
    expect(getViewportMock).toHaveBeenCalledWith({ scale: 2, rotation: 90 });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(300);
    expect(renderMock).toHaveBeenCalledWith({
      canvasContext: context,
      viewport: { width: 200, height: 300 }
    });
  });

  it("0以下のページ番号は1ページ目として描画する", async () => {
    const renderMock = vi.fn(() => ({ promise: Promise.resolve() }));
    getPageMock.mockResolvedValue({
      getViewport: vi.fn(() => ({ width: 100, height: 100 })),
      render: renderMock
    });

    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue({} as CanvasRenderingContext2D);

    const doc = { numPages: 5, getPage: getPageMock } as unknown as PDFDocumentProxy;
    await renderPdfPageToCanvas(canvas, { doc, page: 0, zoom: 1, rotation: 0 });

    expect(getPageMock).toHaveBeenCalledWith(1);
  });

  it("2Dコンテキストが取得できないときはキャンバスを更新しない", async () => {
    const renderMock = vi.fn(() => ({ promise: Promise.resolve() }));
    getPageMock.mockResolvedValue({
      getViewport: vi.fn(() => ({ width: 100, height: 100 })),
      render: renderMock
    });

    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(null);

    const doc = { numPages: 1, getPage: getPageMock } as unknown as PDFDocumentProxy;
    await renderPdfPageToCanvas(canvas, { doc, page: 1, zoom: 1, rotation: 0 });

    expect(getPageMock).toHaveBeenCalledWith(1);
    expect(renderMock).not.toHaveBeenCalled();
  });
});
