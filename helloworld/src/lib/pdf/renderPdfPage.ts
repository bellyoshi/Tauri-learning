import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfjsLib } from "./setup";

export async function loadPdfDocument(url: string): Promise<PDFDocumentProxy> {
  return pdfjsLib.getDocument(url).promise;
}

export async function renderPdfPageToCanvas(
  canvas: HTMLCanvasElement,
  source: { doc: PDFDocumentProxy; page: number; zoom: number; rotation: number }
): Promise<void> {
  const safePage = Math.max(1, Math.min(source.page, source.doc.numPages));
  const page = await source.doc.getPage(safePage);
  const viewport = page.getViewport({ scale: source.zoom, rotation: source.rotation });
  const context = canvas.getContext("2d");
  if (!context) return;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
}
