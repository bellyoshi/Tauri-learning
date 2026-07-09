import { useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { ManagedMediaItem, MediaPayload, MonitorInfo, VideoState, ViewerSettings } from "../types";
import { buildMediaPayload, normalizeMediaPayload } from "../state/mediaState";
import { getVideoResumeSeconds, setVideoResumeSeconds } from "../state/videoResumeState";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

async function getMediaBaseSize(
  media: ReturnType<typeof normalizeMediaPayload>,
  page: number
): Promise<{ width: number; height: number } | null> {
  if (!media.url) return null;
  if (media.mediaType === "pdf") {
    const doc = await pdfjsLib.getDocument(media.url).promise;
    const pdfPage = await doc.getPage(Math.max(1, page));
    const viewport = pdfPage.getViewport({ scale: 1 });
    return { width: viewport.width, height: viewport.height };
  }
  if (media.mediaType === "image") {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("画像サイズの取得に失敗しました"));
      element.src = media.url;
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  }
  if (media.mediaType === "video") {
    const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
      const element = document.createElement("video");
      element.preload = "metadata";
      element.onloadedmetadata = () => resolve(element);
      element.onerror = () => reject(new Error("動画サイズの取得に失敗しました"));
      element.src = media.url;
    });
    return { width: video.videoWidth, height: video.videoHeight };
  }
  return null;
}

interface Props {
  media: MediaPayload;
  currentPage: number;
  totalPages: number;
  zoom: number;
  rotation: number;
  mediaPath: string;
  managedMedia: ManagedMediaItem[];
  monitors: MonitorInfo[];
  settings: ViewerSettings;
  videoState: VideoState;
  onSettingsOpen: () => void;
  onManagedMediaChange: (items: ManagedMediaItem[]) => void;
  onPdfMeta: (pages: number) => void;
}

export function ControlPanel(props: Props) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [viewerAspectRatio, setViewerAspectRatio] = useState(1200 / 900);
  const [autoDisplay, setAutoDisplay] = useState(true);
  const [previewMedia, setPreviewMedia] = useState<MediaPayload | null>(null);
  const [previewPage, setPreviewPage] = useState(props.currentPage);
  const [previewTotalPages, setPreviewTotalPages] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(props.zoom);
  const [previewRotation, setPreviewRotation] = useState(props.rotation);
  const [previewVideoState, setPreviewVideoState] = useState<VideoState>({
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 1
  });
  const activeMedia = autoDisplay ? props.media : (previewMedia ?? props.media);
  const normalizedMedia = normalizeMediaPayload(activeMedia);
  const mediaUrl = normalizedMedia.url;
  const isVideoMedia = normalizedMedia.mediaType === "video";
  const effectivePage = autoDisplay ? props.currentPage : previewPage;
  const effectiveTotalPages = autoDisplay ? props.totalPages : previewTotalPages;
  const effectiveZoom = autoDisplay ? props.zoom : previewZoom;
  const effectiveRotation = autoDisplay ? props.rotation : previewRotation;
  const effectiveVideoState = autoDisplay ? props.videoState : previewVideoState;

  useEffect(() => {
    const updateViewerSize = async () => {
      const size = await invoke<{ width: number; height: number } | null>("get_viewer_window_size");
      if (!size) return;
      if (size.width <= 0 || size.height <= 0) return;
      setViewerAspectRatio(size.width / size.height);
    };

    void updateViewerSize();

    const unlisten: Promise<() => void> = listen<{ width: number; height: number }>(
      "viewer:window-resized",
      (event) => {
        const { width, height } = event.payload;
        if (width > 0 && height > 0) {
          setViewerAspectRatio(width / height);
        }
      }
    );

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (normalizedMedia.mediaType !== "pdf" || !mediaUrl) return;
    let active = true;
    const renderPreview = async () => {
      const doc = await pdfjsLib.getDocument(mediaUrl).promise;
      if (!active) return;
      if (autoDisplay) {
        props.onPdfMeta(doc.numPages);
      } else {
        setPreviewTotalPages(Math.max(1, doc.numPages));
      }
      const page = await doc.getPage(Math.max(1, effectivePage));
      if (!active) return;
      const viewport = page.getViewport({ scale: effectiveZoom, rotation: effectiveRotation });
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;
    };
    void renderPreview();
    return () => {
      active = false;
    };
  }, [autoDisplay, normalizedMedia.mediaType, mediaUrl, effectivePage, effectiveZoom, effectiveRotation, props.onPdfMeta]);

  useEffect(() => {
    if (!autoDisplay) return;
    setPreviewMedia(null);
    setPreviewTotalPages(props.totalPages);
    setPreviewPage(props.currentPage);
    setPreviewZoom(props.zoom);
    setPreviewRotation(props.rotation);
  }, [autoDisplay, props.currentPage, props.totalPages, props.zoom, props.rotation]);

  useEffect(() => {
    if (normalizedMedia.mediaType !== "pdf") {
      setPreviewTotalPages(1);
      setPreviewPage(1);
    }
  }, [normalizedMedia.mediaType, mediaUrl]);

  useEffect(() => {
    if (isVideoMedia) {
      setAutoDisplay(true);
    }
  }, [isVideoMedia]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    const mediaPath = normalizedMedia.path;
    const isVideo = normalizedMedia.mediaType === "video";

    const update = () => {
      setPreviewVideoState({
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
  }, [mediaUrl, normalizedMedia.mediaType, normalizedMedia.path]);

  const handlePagePrev = () => {
    if (autoDisplay) {
      void emit("viewer:page-prev");
      return;
    }
    setPreviewPage((prev) => Math.max(prev - 1, 1));
  };

  const handlePageFirst = () => {
    if (autoDisplay) {
      void emit("viewer:page-first");
      return;
    }
    setPreviewPage(1);
  };

  const handlePageNext = () => {
    if (autoDisplay) {
      void emit("viewer:page-next");
      return;
    }
    setPreviewPage((prev) => Math.min(prev + 1, effectiveTotalPages));
  };

  const handlePageLast = () => {
    if (autoDisplay) {
      void emit("viewer:page-last");
      return;
    }
    setPreviewPage(Math.max(1, effectiveTotalPages));
  };

  const handleZoomOut = () => {
    if (autoDisplay) {
      void emit("viewer:zoom-out");
      return;
    }
    setPreviewZoom((prev) => Math.max(prev - 0.1, 0.2));
  };

  const handleZoomIn = () => {
    if (autoDisplay) {
      void emit("viewer:zoom-in");
      return;
    }
    setPreviewZoom((prev) => Math.min(prev + 0.1, 10));
  };

  const handleZoomReset = () => {
    if (autoDisplay) {
      void emit("viewer:zoom-reset");
      return;
    }
    setPreviewZoom(1);
  };

  const handleZoomSet = (nextZoom: number) => {
    const clamped = Math.max(0.2, Math.min(nextZoom, 10));
    if (autoDisplay) {
      void emit("viewer:zoom-set", clamped);
      return;
    }
    setPreviewZoom(clamped);
  };

  const handleRotationSet = (nextRotation: number) => {
    if (autoDisplay) {
      void emit("viewer:rotation-set", nextRotation);
      return;
    }
    setPreviewRotation(nextRotation);
  };

  const handleRotateRight90 = () => {
    const next = (effectiveRotation + 90) % 360;
    handleRotationSet(next);
  };

  const handleFitWidth = async () => {
    if (normalizedMedia.mediaType === "none") return;
    const size = await invoke<{ width: number; height: number } | null>("get_viewer_window_size");
    if (!size || size.width <= 0 || size.height <= 0) return;
    const mediaSize = await getMediaBaseSize(normalizedMedia, effectivePage);
    if (!mediaSize) return;
    const rotated = effectiveRotation % 180 !== 0;
    const mediaWidth = rotated ? mediaSize.height : mediaSize.width;
    if (mediaWidth <= 0) return;
    handleZoomSet(size.width / mediaWidth);
  };

  const handleFitWhole = async () => {
    if (normalizedMedia.mediaType === "none") return;
    const size = await invoke<{ width: number; height: number } | null>("get_viewer_window_size");
    if (!size || size.width <= 0 || size.height <= 0) return;
    const mediaSize = await getMediaBaseSize(normalizedMedia, effectivePage);
    if (!mediaSize) return;
    const rotated = effectiveRotation % 180 !== 0;
    const mediaWidth = rotated ? mediaSize.height : mediaSize.width;
    const mediaHeight = rotated ? mediaSize.width : mediaSize.height;
    if (mediaWidth <= 0 || mediaHeight <= 0) return;
    handleZoomSet(Math.min(size.width / mediaWidth, size.height / mediaHeight));
  };

  const handleVideoPlay = () => {
    if (autoDisplay) {
      void emit("viewer:video-play");
      return;
    }
    void previewVideoRef.current?.play();
  };

  const handleVideoPause = () => {
    if (autoDisplay) {
      void emit("viewer:video-pause");
      return;
    }
    previewVideoRef.current?.pause();
  };

  const handleVideoSeek = (value: number) => {
    if (autoDisplay) {
      void emit("viewer:video-seek", value);
      return;
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = value;
    }
  };

  const handleVideoVolume = (value: number) => {
    if (autoDisplay) {
      void emit("viewer:video-volume", value);
      return;
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.volume = value;
    }
  };

  const handleShowInViewer = async () => {
    if (autoDisplay) return;
    if (!normalizedMedia.path || normalizedMedia.mediaType === "none") return;

    await invoke("ensure_viewer_window");
    await invoke("apply_viewer_settings", { settings: props.settings });
    const payload = await buildMediaPayload(normalizedMedia.path);
    await emit("viewer:open-media", payload);
    await emit("viewer:zoom-set", effectiveZoom);
    await emit("viewer:rotation-set", effectiveRotation);
    if (normalizedMedia.mediaType === "pdf") {
      await emit("viewer:page-set", effectivePage);
    }
    if (normalizedMedia.mediaType === "video") {
      await emit("viewer:video-seek", effectiveVideoState.currentTime);
      await emit("viewer:video-volume", effectiveVideoState.volume);
    }
  };

  const openFile = async () => {
    const items = await invoke<ManagedMediaItem[]>("pick_and_import_media");
    props.onManagedMediaChange(items);
    const latest = items.at(-1);
    if (!latest) return;
    const payload = await buildMediaPayload(latest.path);
    setPreviewPage(1);
    if (autoDisplay) {
      await emit("viewer:open-media", payload);
      return;
    }
    setPreviewMedia(payload);
  };

  const openManagedItem = async (item: ManagedMediaItem) => {
    const payload = await buildMediaPayload(item.path);
    setPreviewPage(1);
    if (autoDisplay) {
      await emit("viewer:open-media", payload);
      return;
    }
    setPreviewMedia(payload);
  };

  return (
    <div className="panel">
      <header className="toolbar">
        <strong>操作画面</strong>
        <div className="menu-group">
          <label className="row">
            <input
              type="checkbox"
              checked={autoDisplay}
              disabled={isVideoMedia}
              onChange={(event) => setAutoDisplay(event.currentTarget.checked)}
            />
            <span>操作中に自動表示</span>
          </label>
          <button onClick={() => void handleShowInViewer()} disabled={autoDisplay || normalizedMedia.mediaType === "none"}>
            ビュワーに表示
          </button>
          <button onClick={() => invoke("toggle_viewer_mode")}>Viewer全画面切替</button>
        </div>
      </header>

      <div className="control-layout">
        <div className="control-left">
          <section className="block">
            <h3>ファイル取り込み</h3>
            <button onClick={openFile}>ファイルをアプリに取り込む</button>
            <p className="hint">{props.mediaPath || "未選択"}</p>
          </section>

          <section className="block">
            <h3>取り込んだファイル一覧</h3>
            <div className="managed-list">
              {props.managedMedia.length === 0 && <p className="hint">ファイルがありません</p>}
              {props.managedMedia.map((item) => (
                <button key={item.path} className="managed-item" onClick={() => openManagedItem(item)}>
                  {item.name}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="control-center">
          <section className="block">
            <h3>プレビュー</h3>
            <div className="preview-stage" style={{ aspectRatio: String(viewerAspectRatio) }}>
              {normalizedMedia.mediaType === "image" && (
                <img
                  className="media-image"
                  src={mediaUrl}
                  alt="preview image"
                  style={{ transform: `scale(${effectiveZoom}) rotate(${effectiveRotation}deg)`, transformOrigin: "center center" }}
                />
              )}
              {normalizedMedia.mediaType === "video" && (
                <video
                  ref={previewVideoRef}
                  className="media-video"
                  src={mediaUrl}
                  controls
                  muted
                  style={{ transform: `scale(${effectiveZoom}) rotate(${effectiveRotation}deg)` }}
                />
              )}
              {normalizedMedia.mediaType === "pdf" && <canvas className="preview-pdf-canvas" ref={previewCanvasRef} />}
              {normalizedMedia.mediaType === "none" && <p className="hint">表示するファイルを選択してください</p>}
            </div>
            {isVideoMedia && <p className="hint">動画では自動表示の切り替えはできません</p>}
          </section>

          {normalizedMedia.mediaType === "pdf" && (
            <section className="block">
              <h3>ページ移動</h3>
              <div className="row">
                <button onClick={handlePageFirst}>先頭</button>
                <button onClick={handlePagePrev}>前ページ</button>
                <button onClick={handlePageNext}>次ページ</button>
                <button onClick={handlePageLast}>最後</button>
              </div>
              <p className="hint">
                {effectivePage} / {effectiveTotalPages}
              </p>
            </section>
          )}

          {normalizedMedia.mediaType === "video" && (
            <section className="block">
              <h3>動画再生</h3>
              <div className="row">
                <button onClick={handleVideoPlay}>再生</button>
                <button onClick={handleVideoPause}>停止</button>
              </div>
              <div className="row">
                <label>シーク</label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(effectiveVideoState.duration, 0)}
                  value={Math.min(effectiveVideoState.currentTime, effectiveVideoState.duration || 0)}
                  step={0.1}
                  onChange={(e) => handleVideoSeek(Number(e.currentTarget.value))}
                />
              </div>
              <div className="row">
                <label>音量</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={effectiveVideoState.volume}
                  onChange={(e) => handleVideoVolume(Number(e.currentTarget.value))}
                />
              </div>
            </section>
          )}
        </div>

        <div className="control-right">
          <section className="block">
            <h3>拡大縮小</h3>
            <div className="row wrap">
              <button onClick={handleZoomOut}>-</button>
              <span>{Math.round(effectiveZoom * 100)}%</span>
              <button onClick={handleZoomIn}>+</button>
              <button onClick={handleZoomReset}>100%</button>
              <button onClick={() => void handleFitWidth()}>ウインドウ幅</button>
              <button onClick={() => void handleFitWhole()}>全体を表示</button>
            </div>
          </section>

          <section className="block">
            <h3>回転</h3>
            <div className="row wrap">
              <button onClick={handleRotateRight90}>右へ90度</button>
              <button onClick={() => handleRotationSet(180)}>180度</button>
              <button onClick={() => handleRotationSet(270)}>270度</button>
              <button onClick={() => handleRotationSet(0)}>元の位置</button>
            </div>
          </section>
        </div>
      </div>

      <section className="block">
        <div className="row">
          <h3>現在設定</h3>
          <button onClick={props.onSettingsOpen}>設定変更</button>
        </div>
        <p className="hint">モニター: {props.monitors.find((m) => m.index === props.settings.monitorIndex)?.name ?? "不明"}</p>
        <p className="hint">モード: {props.settings.viewerMode}</p>
      </section>
    </div>
  );
}
