import { useEffect, useRef, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { ManagedMediaItem, MediaPayload, MonitorInfo, VideoState, ViewerSettings } from "../types";
import { usePreviewState } from "../hooks/usePreviewState";
import { useViewerAspectRatio } from "../hooks/useViewerAspectRatio";
import { usePdfPreview } from "../hooks/usePdfPreview";
import { useVideoElement } from "../hooks/useVideoElement";
import { useControlKeyboardShortcuts } from "../hooks/useControlKeyboardShortcuts";
import { useViewerDispatchActions } from "../hooks/useViewerDispatchActions";
import { useManagedMediaActions } from "../hooks/useManagedMediaActions";
import { PanelSection } from "./control/PanelSection";
import { MediaPreview } from "./control/MediaPreview";
import { PageControls } from "./control/PageControls";
import { ZoomControls } from "./control/ZoomControls";
import { RotationControls } from "./control/RotationControls";
import { VideoControls } from "./control/VideoControls";
import { ManagedMediaList } from "./control/ManagedMediaList";
import { HelpDialog } from "./control/HelpDialog";
import { ControlToolbar } from "./control/ControlToolbar";
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
  settingsOpenError: string;
  videoState: VideoState;
  onSettingsOpen: () => void;
  onManagedMediaChange: (items: ManagedMediaItem[]) => void;
  onCurrentMediaDeleted: () => void;
  onPdfMeta: (pages: number) => void;
}

export function ControlPanel(props: Props) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
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
    setPreviewTotalPages,
    setPreviewVideoState,
    normalizedMedia,
    isVideoMedia,
    effectivePage,
    effectiveTotalPages,
    effectiveZoom,
    effectiveRotation,
    effectiveVideoState,
    dispatch,
    resetPreview,
    setPreviewPage,
    setPreviewZoom,
    setPreviewRotation
  } = preview;

  const actions = useViewerDispatchActions({
    dispatch,
    effectiveTotalPages,
    effectiveRotation,
    setPreviewPage,
    setPreviewZoom,
    setPreviewRotation,
    videoRef: previewVideoRef
  });

  const mediaActions = useManagedMediaActions({
    preview: {
      autoDisplay,
      normalizedMedia,
      effectivePage,
      effectiveZoom,
      effectiveRotation,
      effectiveVideoState,
      setPreviewPage,
      setPreviewZoom,
      setPreviewRotation,
      setPreviewMedia,
      resetPreview,
      zoomSet: actions.zoomSet
    },
    settings: props.settings,
    mediaPath: props.mediaPath,
    managedMedia: props.managedMedia,
    onManagedMediaChange: props.onManagedMediaChange,
    onCurrentMediaDeleted: props.onCurrentMediaDeleted
  });

  usePdfPreview(previewCanvasRef, {
    mediaType: normalizedMedia.mediaType,
    mediaUrl: normalizedMedia.url,
    page: effectivePage,
    zoom: effectiveZoom,
    rotation: effectiveRotation,
    onPageCount: (pages) => {
      const total = Math.max(1, pages);
      setPreviewTotalPages(total);
      if (autoDisplay) {
        props.onPdfMeta(total);
      }
    }
  });

  useVideoElement(previewVideoRef, {
    mediaPath: normalizedMedia.path,
    mediaType: normalizedMedia.mediaType,
    persistResume: true,
    onStateChange: setPreviewVideoState
  });

  useControlKeyboardShortcuts({
    mediaType: normalizedMedia.mediaType,
    onPageFirst: actions.pageFirst,
    onPagePrev: actions.pagePrev,
    onPageNext: actions.pageNext,
    onPageLast: actions.pageLast,
    onZoomIn: actions.zoomIn,
    onZoomOut: actions.zoomOut,
    onZoomReset: actions.zoomReset,
    onRotateRight90: actions.rotateRight90,
    onDeleteCurrent: normalizedMedia.path ? mediaActions.deleteCurrentManagedItem : undefined
  });

  const handleAutoDisplayChange = (value: boolean) => {
    setAutoDisplay(value);
    if (value) {
      void mediaActions.syncPreviewToViewer();
    }
  };

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    let rafId = 0;
    const syncViewport = () => {
      rafId = 0;
      void emit(preview.events.VIEWPORT_SYNC, {
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
        scrollWidth: container.scrollWidth,
        scrollHeight: container.scrollHeight,
        clientWidth: container.clientWidth,
        clientHeight: container.clientHeight
      });
    };
    const scheduleSync = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(syncViewport);
    };

    container.addEventListener("scroll", scheduleSync);
    window.addEventListener("resize", scheduleSync);
    scheduleSync();

    return () => {
      container.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [
    preview.events.VIEWPORT_SYNC,
    normalizedMedia.mediaType,
    normalizedMedia.url,
    effectivePage,
    effectiveZoom,
    effectiveRotation
  ]);

  return (
    <div className="panel">
      <ControlToolbar
        autoDisplay={autoDisplay}
        isVideoMedia={isVideoMedia}
        canShowInViewer={!autoDisplay}
        onAutoDisplayChange={handleAutoDisplayChange}
        onShowInViewer={() => void mediaActions.handleShowInViewer()}
        onOpenHelp={() => setHelpOpen(true)}
      />

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
            <button type="button" onClick={() => void mediaActions.openFile()}>
              ファイルをアプリに取り込む
            </button>
          </PanelSection>

          <PanelSection title="取り込んだファイル一覧">
            <ManagedMediaList
              items={props.managedMedia}
              selectedPath={normalizedMedia.path}
              onOpen={(item) => void mediaActions.openManagedItem(item)}
              onDelete={(item) => void mediaActions.deleteManagedItem(item)}
            />
            <button
              type="button"
              disabled={!normalizedMedia.path}
              onClick={() => void mediaActions.clearSelection()}
            >
              選択解除
            </button>
          </PanelSection>
        </div>

        <div className="control-center">
          <PanelSection title="プレビュー">
            <p className="hint preview-selection">{normalizedMedia.path || "未選択"}</p>
            <MediaPreview
              mediaType={normalizedMedia.mediaType}
              mediaUrl={normalizedMedia.url}
              aspectRatio={viewerAspectRatio}
              zoom={effectiveZoom}
              rotation={effectiveRotation}
              settings={props.settings}
              canvasRef={previewCanvasRef}
              videoRef={previewVideoRef}
              containerRef={previewContainerRef}
            />
            {isVideoMedia && <p className="hint">動画では自動表示の切り替えはできません</p>}
          </PanelSection>

          {normalizedMedia.mediaType === "pdf" && (
            <PageControls
              page={effectivePage}
              totalPages={effectiveTotalPages}
              onFirst={actions.pageFirst}
              onPrev={actions.pagePrev}
              onNext={actions.pageNext}
              onLast={actions.pageLast}
            />
          )}

          {normalizedMedia.mediaType === "video" && (
            <VideoControls
              videoState={effectiveVideoState}
              onPlay={actions.videoPlay}
              onPause={actions.videoPause}
              onSeek={actions.videoSeek}
              onVolume={actions.videoVolume}
            />
          )}
        </div>

        <div className="control-right">
          <ZoomControls
            zoom={effectiveZoom}
            onZoomOut={actions.zoomOut}
            onZoomIn={actions.zoomIn}
            onZoomReset={actions.zoomReset}
            onFitWidth={() => void mediaActions.handleFitZoom("width")}
            onFitWhole={() => void mediaActions.handleFitZoom("whole")}
          />
          <RotationControls
            onRotateRight90={actions.rotateRight90}
            onRotate180={actions.rotate180}
            onRotate270={actions.rotate270}
            onReset={actions.rotateReset}
          />
        </div>
      </div>

      <PanelSection title="現在設定" action={<button onClick={props.onSettingsOpen}>設定変更</button>}>
        <p className="hint">
          モニター: {props.monitors.find((m) => m.index === props.settings.monitorIndex)?.name ?? "不明"}
        </p>
        <p className="hint">モード: {props.settings.viewerMode}</p>
        {props.settingsOpenError && <p className="hint error-text">{props.settingsOpenError}</p>}
      </PanelSection>
    </div>
  );
}
