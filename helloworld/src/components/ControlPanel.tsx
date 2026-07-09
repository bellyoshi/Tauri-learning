import { useRef, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { ManagedMediaItem, MediaPayload, MonitorInfo, VideoState, ViewerSettings } from "../types";
import { buildMediaPayload, EMPTY_MEDIA } from "../state/mediaState";
import { removeVideoResumeSeconds } from "../state/videoResumeState";
import { getMediaBaseSize } from "../lib/pdf/getMediaBaseSize";
import { clampZoom, zoomIn, zoomOut } from "../lib/viewTransform";
import { usePreviewState } from "../hooks/usePreviewState";
import { useViewerAspectRatio } from "../hooks/useViewerAspectRatio";
import { usePdfPreview } from "../hooks/usePdfPreview";
import { useVideoElement } from "../hooks/useVideoElement";
import { useControlKeyboardShortcuts } from "../hooks/useControlKeyboardShortcuts";
import { PanelSection } from "./control/PanelSection";
import { MediaPreview } from "./control/MediaPreview";
import { PageControls } from "./control/PageControls";
import { ZoomControls } from "./control/ZoomControls";
import { RotationControls } from "./control/RotationControls";
import { VideoControls } from "./control/VideoControls";
import { ManagedMediaList } from "./control/ManagedMediaList";
import { HelpDialog } from "./control/HelpDialog";
import { KEYBOARD_SHORTCUTS_HELP } from "../help/keyboardShortcuts";

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
  onCurrentMediaDeleted: () => void;
  onPdfMeta: (pages: number) => void;
}

export function ControlPanel(props: Props) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const viewerAspectRatio = useViewerAspectRatio();
  const [helpOpen, setHelpOpen] = useState(false);

  const preview = usePreviewState({
    media: props.media,
    currentPage: props.currentPage,
    totalPages: props.totalPages,
    zoom: props.zoom,
    rotation: props.rotation,
    videoState: props.videoState
  });

  const {
    autoDisplay,
    setAutoDisplay,
    setPreviewMedia,
    setPreviewPage,
    setPreviewTotalPages,
    setPreviewZoom,
    setPreviewRotation,
    setPreviewVideoState,
    normalizedMedia,
    isVideoMedia,
    effectivePage,
    effectiveTotalPages,
    effectiveZoom,
    effectiveRotation,
    effectiveVideoState,
    dispatch,
    events
  } = preview;

  usePdfPreview(previewCanvasRef, {
    mediaType: normalizedMedia.mediaType,
    mediaUrl: normalizedMedia.url,
    page: effectivePage,
    zoom: effectiveZoom,
    rotation: effectiveRotation,
    onPageCount: (pages) => {
      if (autoDisplay) {
        props.onPdfMeta(pages);
      } else {
        setPreviewTotalPages(Math.max(1, pages));
      }
    }
  });

  useVideoElement(previewVideoRef, {
    mediaPath: normalizedMedia.path,
    mediaType: normalizedMedia.mediaType,
    onStateChange: setPreviewVideoState
  });

  const handleFitZoom = async (mode: "width" | "whole") => {
    if (normalizedMedia.mediaType === "none") return;
    const size = await invoke<{ width: number; height: number } | null>("get_viewer_window_size");
    if (!size || size.width <= 0 || size.height <= 0) return;
    const mediaSize = await getMediaBaseSize(normalizedMedia, effectivePage);
    if (!mediaSize) return;

    const rotated = effectiveRotation % 180 !== 0;
    const mediaWidth = rotated ? mediaSize.height : mediaSize.width;
    const mediaHeight = rotated ? mediaSize.width : mediaSize.height;
    if (mediaWidth <= 0) return;

    const nextZoom =
      mode === "width"
        ? size.width / mediaWidth
        : Math.min(size.width / mediaWidth, size.height / mediaHeight);

    const clamped = clampZoom(nextZoom);
    dispatch(events.ZOOM_SET, clamped, () => setPreviewZoom(clamped));
  };

  const handleShowInViewer = async () => {
    if (autoDisplay || !normalizedMedia.path || normalizedMedia.mediaType === "none") return;

    await invoke("ensure_viewer_window");
    await invoke("apply_viewer_settings", { settings: props.settings });
    const payload = await buildMediaPayload(normalizedMedia.path);
    await emit(events.OPEN_MEDIA, payload);
    await emit(events.ZOOM_SET, effectiveZoom);
    await emit(events.ROTATION_SET, effectiveRotation);
    if (normalizedMedia.mediaType === "pdf") {
      await emit(events.PAGE_SET, effectivePage);
    }
    if (normalizedMedia.mediaType === "video") {
      await emit(events.VIDEO_SEEK, effectiveVideoState.currentTime);
      await emit(events.VIDEO_VOLUME, effectiveVideoState.volume);
    }
  };

  const openMedia = async (path: string, autoOpen: boolean) => {
    const payload = await buildMediaPayload(path);
    setPreviewPage(1);
    if (autoOpen) {
      await emit(events.OPEN_MEDIA, payload);
      return;
    }
    setPreviewMedia(payload);
  };

  const openFile = async () => {
    const items = await invoke<ManagedMediaItem[]>("pick_and_import_media");
    props.onManagedMediaChange(items);
    const latest = items.at(-1);
    if (!latest) return;
    await openMedia(latest.path, autoDisplay);
  };

  const openManagedItem = async (item: ManagedMediaItem) => {
    await openMedia(item.path, autoDisplay);
  };

  const deleteManagedItem = async (item: ManagedMediaItem) => {
    if (!window.confirm(`「${item.name}」を削除しますか？`)) return;

    const items = await invoke<ManagedMediaItem[]>("delete_managed_media", { path: item.path });
    props.onManagedMediaChange(items);
    removeVideoResumeSeconds(item.path);

    if (props.mediaPath !== item.path) return;

    setPreviewMedia(null);
    setPreviewPage(1);
    setPreviewTotalPages(1);
    setPreviewZoom(1);
    setPreviewRotation(0);
    props.onCurrentMediaDeleted();
    if (autoDisplay) {
      await emit(events.OPEN_MEDIA, EMPTY_MEDIA);
    }
  };

  const deleteCurrentManagedItem = () => {
    const current = props.managedMedia.find((item) => item.path === props.mediaPath);
    if (!current) return;
    void deleteManagedItem(current);
  };

  const clearSelection = async () => {
    if (!props.mediaPath) return;

    setPreviewMedia(null);
    setPreviewPage(1);
    setPreviewTotalPages(1);
    setPreviewZoom(1);
    setPreviewRotation(0);
    props.onCurrentMediaDeleted();
    if (autoDisplay) {
      await emit(events.OPEN_MEDIA, EMPTY_MEDIA);
    }
  };

  useControlKeyboardShortcuts({
    mediaType: normalizedMedia.mediaType,
    onPageFirst: () => dispatch(events.PAGE_FIRST, undefined, () => setPreviewPage(1)),
    onPagePrev: () =>
      dispatch(events.PAGE_PREV, undefined, () => setPreviewPage((prev) => Math.max(prev - 1, 1))),
    onPageNext: () =>
      dispatch(events.PAGE_NEXT, undefined, () =>
        setPreviewPage((prev) => Math.min(prev + 1, effectiveTotalPages))
      ),
    onPageLast: () =>
      dispatch(events.PAGE_LAST, undefined, () => setPreviewPage(Math.max(1, effectiveTotalPages))),
    onZoomIn: () => dispatch(events.ZOOM_IN, undefined, () => setPreviewZoom((prev) => zoomIn(prev))),
    onZoomOut: () => dispatch(events.ZOOM_OUT, undefined, () => setPreviewZoom((prev) => zoomOut(prev))),
    onZoomReset: () => dispatch(events.ZOOM_RESET, undefined, () => setPreviewZoom(1)),
    onRotateRight90: () => {
      const next = (effectiveRotation + 90) % 360;
      dispatch(events.ROTATION_SET, next, () => setPreviewRotation(next));
    },
    onDeleteCurrent: props.mediaPath ? deleteCurrentManagedItem : undefined
  });

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
          <button
            onClick={() => void handleShowInViewer()}
            disabled={autoDisplay || normalizedMedia.mediaType === "none"}
          >
            ビュワーに表示
          </button>
          <button onClick={() => invoke("toggle_viewer_mode")}>Viewer全画面切替</button>
          <button type="button" onClick={() => setHelpOpen(true)}>
            ヘルプ
          </button>
        </div>
      </header>

      {helpOpen && (
        <HelpDialog
          title="キーボードショートカット"
          sections={KEYBOARD_SHORTCUTS_HELP}
          onClose={() => setHelpOpen(false)}
        />
      )}

      <div className="control-layout">
        <div className="control-left">
          <PanelSection title="ファイル取り込み">
            <button onClick={openFile}>ファイルをアプリに取り込む</button>
          </PanelSection>

          <PanelSection title="取り込んだファイル一覧">
            <ManagedMediaList
              items={props.managedMedia}
              selectedPath={props.mediaPath}
              onOpen={(item) => void openManagedItem(item)}
              onDelete={(item) => void deleteManagedItem(item)}
            />
            <button type="button" disabled={!props.mediaPath} onClick={() => void clearSelection()}>
              選択解除
            </button>
          </PanelSection>
        </div>

        <div className="control-center">
          <PanelSection title="プレビュー">
            <p className="hint preview-selection">{props.mediaPath || "未選択"}</p>
            <MediaPreview
              mediaType={normalizedMedia.mediaType}
              mediaUrl={normalizedMedia.url}
              aspectRatio={viewerAspectRatio}
              zoom={effectiveZoom}
              rotation={effectiveRotation}
              settings={props.settings}
              canvasRef={previewCanvasRef}
              videoRef={previewVideoRef}
            />
            {isVideoMedia && <p className="hint">動画では自動表示の切り替えはできません</p>}
          </PanelSection>

          {normalizedMedia.mediaType === "pdf" && (
            <PageControls
              page={effectivePage}
              totalPages={effectiveTotalPages}
              onFirst={() => dispatch(events.PAGE_FIRST, undefined, () => setPreviewPage(1))}
              onPrev={() =>
                dispatch(events.PAGE_PREV, undefined, () => setPreviewPage((prev) => Math.max(prev - 1, 1)))
              }
              onNext={() =>
                dispatch(events.PAGE_NEXT, undefined, () =>
                  setPreviewPage((prev) => Math.min(prev + 1, effectiveTotalPages))
                )
              }
              onLast={() =>
                dispatch(events.PAGE_LAST, undefined, () => setPreviewPage(Math.max(1, effectiveTotalPages)))
              }
            />
          )}

          {normalizedMedia.mediaType === "video" && (
            <VideoControls
              videoState={effectiveVideoState}
              onPlay={() => dispatch(events.VIDEO_PLAY, undefined, () => void previewVideoRef.current?.play())}
              onPause={() => dispatch(events.VIDEO_PAUSE, undefined, () => previewVideoRef.current?.pause())}
              onSeek={(value) =>
                dispatch(events.VIDEO_SEEK, value, () => {
                  if (previewVideoRef.current) previewVideoRef.current.currentTime = value;
                })
              }
              onVolume={(value) =>
                dispatch(events.VIDEO_VOLUME, value, () => {
                  if (previewVideoRef.current) previewVideoRef.current.volume = value;
                })
              }
            />
          )}
        </div>

        <div className="control-right">
          <ZoomControls
            zoom={effectiveZoom}
            onZoomOut={() => dispatch(events.ZOOM_OUT, undefined, () => setPreviewZoom((prev) => zoomOut(prev)))}
            onZoomIn={() => dispatch(events.ZOOM_IN, undefined, () => setPreviewZoom((prev) => zoomIn(prev)))}
            onZoomReset={() => dispatch(events.ZOOM_RESET, undefined, () => setPreviewZoom(1))}
            onFitWidth={() => void handleFitZoom("width")}
            onFitWhole={() => void handleFitZoom("whole")}
          />
          <RotationControls
            onRotateRight90={() => {
              const next = (effectiveRotation + 90) % 360;
              dispatch(events.ROTATION_SET, next, () => setPreviewRotation(next));
            }}
            onRotate180={() => dispatch(events.ROTATION_SET, 180, () => setPreviewRotation(180))}
            onRotate270={() => dispatch(events.ROTATION_SET, 270, () => setPreviewRotation(270))}
            onReset={() => dispatch(events.ROTATION_SET, 0, () => setPreviewRotation(0))}
          />
        </div>
      </div>

      <PanelSection title="現在設定" action={<button onClick={props.onSettingsOpen}>設定変更</button>}>
        <p className="hint">
          モニター: {props.monitors.find((m) => m.index === props.settings.monitorIndex)?.name ?? "不明"}
        </p>
        <p className="hint">モード: {props.settings.viewerMode}</p>
      </PanelSection>
    </div>
  );
}
