import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { MediaPayload, VideoState, ViewerSettings } from "../types";
import { normalizeMediaPayload } from "../state/mediaState";
import { VIEWER_EVENTS } from "../events/viewerEvents";
import { buildViewerBackgroundStyle } from "../lib/viewerBackground";
import { mediaTransformStyle } from "../lib/viewTransform";
import { loadPdfDocument, renderPdfPageToCanvas } from "../lib/pdf/renderPdfPage";
import { useVideoElement } from "../hooks/useVideoElement";
import "../lib/pdf/setup";

interface Props {
  media: MediaPayload;
  currentPage: number;
  zoom: number;
  rotation: number;
  settings: ViewerSettings;
  onPdfMeta: (totalPages: number) => void;
  onVideoStateChange: (state: VideoState) => void;
}

export function ViewerPanel({ media, currentPage, zoom, rotation, settings, onPdfMeta, onVideoStateChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const normalizedMedia = normalizeMediaPayload(media);
  const mediaUrl = normalizedMedia.url;

  useEffect(() => {
    if (normalizedMedia.mediaType !== "pdf" || !mediaUrl) {
      setPdfDoc(null);
      return;
    }
    let mounted = true;
    loadPdfDocument(mediaUrl).then((doc) => {
      if (!mounted) return;
      setPdfDoc(doc);
      onPdfMeta(doc.numPages);
    });
    return () => {
      mounted = false;
    };
  }, [normalizedMedia.mediaType, mediaUrl, onPdfMeta]);

  useEffect(() => {
    if (!pdfDoc || normalizedMedia.mediaType !== "pdf") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    void renderPdfPageToCanvas(canvas, { doc: pdfDoc, page: currentPage, zoom, rotation });
  }, [pdfDoc, currentPage, zoom, rotation, normalizedMedia.mediaType]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || normalizedMedia.mediaType !== "video") return;
    const unlisten = Promise.all([
      listen<number>(VIEWER_EVENTS.VIDEO_SEEK, (event) => {
        video.currentTime = event.payload;
      }),
      listen<number>(VIEWER_EVENTS.VIDEO_VOLUME, (event) => {
        video.volume = event.payload;
      }),
      listen(VIEWER_EVENTS.VIDEO_PLAY, () => {
        void video.play();
      }),
      listen(VIEWER_EVENTS.VIDEO_PAUSE, () => {
        video.pause();
      })
    ]);
    return () => {
      void unlisten.then((fns) => fns.forEach((fn) => fn()));
    };
  }, [normalizedMedia.mediaType, normalizedMedia.url]);

  useVideoElement(videoRef, {
    mediaPath: normalizedMedia.path,
    mediaType: normalizedMedia.mediaType,
    onStateChange: onVideoStateChange
  });

  const wrapperStyle = buildViewerBackgroundStyle(settings);

  return (
    <div
      className="viewer-wrapper"
      style={wrapperStyle}
      onContextMenu={(event) => {
        event.preventDefault();
        setContextPos({ x: event.clientX, y: event.clientY });
      }}
      onClick={() => setContextPos(null)}
    >
      {normalizedMedia.mediaType === "pdf" && <canvas ref={canvasRef} />}
      {normalizedMedia.mediaType === "image" && (
        <img
          className="media-image"
          src={mediaUrl}
          alt="viewer media"
          style={mediaTransformStyle(zoom, rotation)}
        />
      )}
      {normalizedMedia.mediaType === "video" && (
        <video
          ref={videoRef}
          className="media-video"
          src={mediaUrl}
          autoPlay
          controls={false}
          style={mediaTransformStyle(zoom, rotation)}
        />
      )}

      {contextPos && (
        <div className="context-menu" style={{ left: contextPos.x, top: contextPos.y }}>
          <button onClick={() => invoke("toggle_titlebar")}>タイトルバー表示/非表示</button>
          <button onClick={() => invoke("toggle_viewer_mode")}>フルスクリーン/ウインドウ切替</button>
          <button onClick={() => invoke("close_viewer_window")}>ウインドウを閉じる</button>
        </div>
      )}
    </div>
  );
}
