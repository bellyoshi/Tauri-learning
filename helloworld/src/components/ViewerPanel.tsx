import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { MediaPayload, VideoState, ViewerSettings, ViewportState } from "../types";
import { normalizeMediaPayload } from "../state/mediaState";
import { buildViewerBackgroundStyle } from "../lib/viewerBackground";
import { mediaTransformStyle } from "../lib/viewTransform";
import { loadPdfDocument, renderPdfPageToCanvas } from "../lib/pdf/renderPdfPage";
import { VIEWER_EVENTS } from "../events/viewerEvents";
import { useVideoElement } from "../hooks/useVideoElement";
import { useViewerVideoCommands } from "../hooks/useViewerVideoCommands";
import { ViewerContextMenu } from "./viewer/ViewerContextMenu";
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const normalizedMedia = normalizeMediaPayload(media);
  const mediaUrl = normalizedMedia.url;
  const runWindowCommand = (command: "toggle_titlebar" | "toggle_viewer_mode" | "close_viewer_window") => {
    // 先にメニューを閉じて、コマンド成否に関わらずUIを操作可能な状態に戻す
    setContextPos(null);
    setCommandError(null);
    void (async () => {
      try {
        const currentWindow = getCurrentWebviewWindow();
        if (command === "toggle_titlebar") {
          const decorated = await currentWindow.isDecorated();
          await currentWindow.setDecorations(!decorated);
          return;
        }
        if (command === "toggle_viewer_mode") {
          const fullscreen = await currentWindow.isFullscreen();
          const next = !fullscreen;
          await currentWindow.setFullscreen(next);
          await emit(VIEWER_EVENTS.SETTINGS_UPDATED, { viewerMode: next ? "fullscreen" : "windowed" });
          return;
        }
        await currentWindow.close();
      } catch (error) {
        // 環境差でWindow APIが弾かれる場合に備えて、Rustコマンドへフォールバック
        try {
          await invoke(command);
        } catch (invokeError) {
          const windowApiMessage = error instanceof Error ? error.message : String(error);
          const invokeMessage = invokeError instanceof Error ? invokeError.message : String(invokeError);
          setCommandError(`コマンド実行失敗: ${command} (${windowApiMessage} / ${invokeMessage})`);
          console.error(`Viewer context menu command failed: ${command}`, {
            windowApiError: error,
            invokeError
          });
        }
      }
    })();
  };

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

  useViewerVideoCommands(videoRef, normalizedMedia.mediaType === "video");

  useVideoElement(videoRef, {
    mediaPath: normalizedMedia.path,
    mediaType: normalizedMedia.mediaType,
    onStateChange: onVideoStateChange
  });

  useEffect(() => {
    const unlisten = listen<ViewportState>(VIEWER_EVENTS.VIEWPORT_SYNC, (event) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const payload = event.payload;
      const previewMaxLeft = Math.max(0, payload.scrollWidth - payload.clientWidth);
      const previewMaxTop = Math.max(0, payload.scrollHeight - payload.clientHeight);
      const viewerMaxLeft = Math.max(0, wrapper.scrollWidth - wrapper.clientWidth);
      const viewerMaxTop = Math.max(0, wrapper.scrollHeight - wrapper.clientHeight);

      const leftRatio = previewMaxLeft > 0 ? payload.scrollLeft / previewMaxLeft : 0;
      const topRatio = previewMaxTop > 0 ? payload.scrollTop / previewMaxTop : 0;

      wrapper.scrollLeft = viewerMaxLeft * leftRatio;
      wrapper.scrollTop = viewerMaxTop * topRatio;
    });

    return () => {
      void unlisten.then((cleanup) => cleanup());
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="viewer-wrapper"
      style={buildViewerBackgroundStyle(settings)}
      onContextMenu={(event) => {
        event.preventDefault();
        setContextPos({ x: event.clientX, y: event.clientY });
      }}
      onMouseDown={(event) => {
        if (event.button === 0) {
          setContextPos(null);
        }
      }}
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
        <ViewerContextMenu
          position={contextPos}
          onToggleTitlebar={() => runWindowCommand("toggle_titlebar")}
          onToggleViewerMode={() => runWindowCommand("toggle_viewer_mode")}
          onCloseViewer={() => runWindowCommand("close_viewer_window")}
        />
      )}
      {commandError && <div className="hint">{commandError}</div>}
    </div>
  );
}
