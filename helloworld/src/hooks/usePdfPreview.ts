import { RefObject, useEffect } from "react";
import { loadPdfDocument, renderPdfPageToCanvas } from "../lib/pdf/renderPdfPage";

interface Options {
  mediaType: string;
  mediaUrl: string;
  page: number;
  zoom: number;
  rotation: number;
  onPageCount?: (pages: number) => void;
}

export function usePdfPreview(canvasRef: RefObject<HTMLCanvasElement | null>, options: Options) {
  const { mediaType, mediaUrl, page, zoom, rotation, onPageCount } = options;

  useEffect(() => {
    if (mediaType !== "pdf" || !mediaUrl) return;

    let active = true;
    const renderPreview = async () => {
      const doc = await loadPdfDocument(mediaUrl);
      if (!active) return;
      onPageCount?.(doc.numPages);

      const canvas = canvasRef.current;
      if (!canvas) return;
      await renderPdfPageToCanvas(canvas, { doc, page, zoom, rotation });
    };

    void renderPreview();
    return () => {
      active = false;
    };
  }, [canvasRef, mediaType, mediaUrl, onPageCount, page, rotation, zoom]);
}
