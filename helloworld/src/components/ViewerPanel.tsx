import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { PDFDocumentProxy } from "pdfjs-dist";
import * as pdfjsLib from "pdfjs-dist";
import { MediaPayload, VideoState, ViewerSettings } from "../types";
import { normalizeMediaPayload } from "../state/mediaState";
import { getVideoResumeSeconds, setVideoResumeSeconds } from "../state/videoResumeState";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

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
    pdfjsLib.getDocument(mediaUrl).promise.then((doc) => {
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
    const render = async () => {
      const safePage = Math.max(1, Math.min(currentPage, pdfDoc.numPages));
      const page = await pdfDoc.getPage(safePage);
      const viewport = page.getViewport({ scale: zoom, rotation });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;
    };
    void render();
  }, [pdfDoc, currentPage, zoom, rotation, normalizedMedia.mediaType]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || normalizedMedia.mediaType !== "video") return;
    const unlisten: Promise<(() => void)[]> = Promise.all([
      listen<number>("viewer:video-seek", (event) => {
        video.currentTime = event.payload;
      }),
      listen<number>("viewer:video-volume", (event) => {
        video.volume = event.payload;
      }),
      listen("viewer:video-play", () => {
        void video.play();
      }),
      listen("viewer:video-pause", () => {
        video.pause();
      })
    ]);
    return () => {
      void unlisten.then((fns) => fns.forEach((fn) => fn()));
    };
  }, [normalizedMedia.mediaType, normalizedMedia.url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const mediaPath = normalizedMedia.path;
    const isVideo = normalizedMedia.mediaType === "video";

    const update = () => {
      onVideoStateChange({
        playing: !video.paused,
        currentTime: video.currentTime || 0,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        volume: video.volume
      });
      if (isVideo && mediaPath) {
        setVideoResumeSeconds(mediaPath, video.currentTime || 0);
      }
    };

    const applyResumePosition = () => {
      if (!isVideo || !mediaPath) return;
      const resumeSeconds = getVideoResumeSeconds(mediaPath);
      if (resumeSeconds <= 0) return;
      const duration = Number.isFinite(video.duration) ? video.duration : resumeSeconds;
      video.currentTime = Math.min(resumeSeconds, Math.max(0, duration));
      update();
    };

    video.addEventListener("play", update);
    video.addEventListener("pause", update);
    video.addEventListener("timeupdate", update);
    video.addEventListener("loadedmetadata", update);
    video.addEventListener("loadedmetadata", applyResumePosition);
    video.addEventListener("volumechange", update);
    return () => {
      video.removeEventListener("play", update);
      video.removeEventListener("pause", update);
      video.removeEventListener("timeupdate", update);
      video.removeEventListener("loadedmetadata", update);
      video.removeEventListener("loadedmetadata", applyResumePosition);
      video.removeEventListener("volumechange", update);
    };
  }, [normalizedMedia.mediaType, normalizedMedia.path, normalizedMedia.url, onVideoStateChange]);

  const wrapperStyle: React.CSSProperties = {
    backgroundColor: settings.backgroundColor,
    backgroundImage: settings.backgroundImagePath ? `url("${convertFileSrc(settings.backgroundImagePath)}")` : "none",
    backgroundSize: "cover",
    backgroundPosition: "center"
  };

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
          style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
        />
      )}
      {normalizedMedia.mediaType === "video" && (
        <video
          ref={videoRef}
          className="media-video"
          src={mediaUrl}
          autoPlay
          controls={false}
          style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
        />
      )}
      {normalizedMedia.mediaType === "none" && <p className="empty">表示するファイルを選択してください</p>}

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
