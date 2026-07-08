import { useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { ManagedMediaItem, MediaPayload, MonitorInfo, VideoState, ViewerSettings } from "../types";
import { buildMediaPayload, normalizeMediaPayload } from "../state/mediaState";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

interface Props {
  media: MediaPayload;
  currentPage: number;
  totalPages: number;
  zoom: number;
  mediaPath: string;
  managedMedia: ManagedMediaItem[];
  monitors: MonitorInfo[];
  settings: ViewerSettings;
  videoState: VideoState;
  onSettingsOpen: () => void;
  onManagedMediaChange: (items: ManagedMediaItem[]) => void;
}

export function ControlPanel(props: Props) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [viewerAspectRatio, setViewerAspectRatio] = useState(1200 / 900);
  const normalizedMedia = normalizeMediaPayload(props.media);
  const mediaUrl = normalizedMedia.url;

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
      const page = await doc.getPage(Math.max(1, props.currentPage));
      if (!active) return;
      const viewport = page.getViewport({ scale: 0.35 });
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
  }, [normalizedMedia.mediaType, mediaUrl, props.currentPage]);

  const openFile = async () => {
    const items = await invoke<ManagedMediaItem[]>("pick_and_import_media");
    props.onManagedMediaChange(items);
    const latest = items.at(-1);
    if (!latest) return;
    const payload = await buildMediaPayload(latest.path);
    await emit("viewer:open-media", payload);
  };

  const openManagedItem = async (item: ManagedMediaItem) => {
    const payload = await buildMediaPayload(item.path);
    await emit("viewer:open-media", payload);
  };

  return (
    <div className="panel">
      <header className="toolbar">
        <strong>操作画面</strong>
        <div className="menu-group">
          <button onClick={props.onSettingsOpen}>設定</button>
          <button onClick={() => invoke("toggle_viewer_mode")}>Viewer全画面切替</button>
        </div>
      </header>

      <div className="control-layout">
        <div className="control-left">
          <section className="block">
            <h3>ファイル取り込み（Rust側ダイアログ）</h3>
            <button onClick={openFile}>ファイルを選択して直下フォルダへコピー</button>
            <p className="hint">{props.mediaPath || "未選択"}</p>
          </section>

          <section className="block">
            <h3>直下 managed-media 一覧</h3>
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

        <div className="control-right">
          <section className="block">
            <h3>プレビュー</h3>
            <div className="preview-stage" style={{ aspectRatio: String(viewerAspectRatio) }}>
              {normalizedMedia.mediaType === "image" && (
                <img className="preview-fit" src={mediaUrl} alt="preview image" />
              )}
              {normalizedMedia.mediaType === "video" && (
                <video className="preview-fit" src={mediaUrl} controls muted />
              )}
              {normalizedMedia.mediaType === "pdf" && <canvas className="preview-fit preview-pdf-canvas" ref={previewCanvasRef} />}
              {normalizedMedia.mediaType === "none" && <p className="hint">表示するファイルを選択してください</p>}
            </div>
          </section>
        </div>
      </div>

      {normalizedMedia.mediaType === "pdf" && (
        <section className="block">
          <h3>PDF操作</h3>
          <div className="row">
            <button onClick={() => emit("viewer:page-prev")}>前ページ</button>
            <button onClick={() => emit("viewer:page-next")}>次ページ</button>
          </div>
          <p className="hint">
            {props.currentPage} / {props.totalPages}
          </p>
        </section>
      )}

      <section className="block">
        <h3>拡大縮小</h3>
        <div className="row">
          <button onClick={() => emit("viewer:zoom-out")}>-</button>
          <span>{Math.round(props.zoom * 100)}%</span>
          <button onClick={() => emit("viewer:zoom-in")}>+</button>
          <button onClick={() => emit("viewer:zoom-reset")}>100%</button>
        </div>
      </section>

      <section className="block">
        <h3>動画操作</h3>
        <div className="row">
          <button onClick={() => emit("viewer:video-play")}>再生</button>
          <button onClick={() => emit("viewer:video-pause")}>停止</button>
        </div>
        <div className="row">
          <label>シーク</label>
          <input
            type="range"
            min={0}
            max={Math.max(props.videoState.duration, 0)}
            value={Math.min(props.videoState.currentTime, props.videoState.duration || 0)}
            step={0.1}
            onChange={(e) => emit("viewer:video-seek", Number(e.currentTarget.value))}
          />
        </div>
        <div className="row">
          <label>音量</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={props.videoState.volume}
            onChange={(e) => emit("viewer:video-volume", Number(e.currentTarget.value))}
          />
        </div>
      </section>

      <section className="block">
        <h3>現在設定</h3>
        <p className="hint">モニター: {props.monitors.find((m) => m.index === props.settings.monitorIndex)?.name ?? "不明"}</p>
        <p className="hint">モード: {props.settings.viewerMode}</p>
      </section>
    </div>
  );
}
