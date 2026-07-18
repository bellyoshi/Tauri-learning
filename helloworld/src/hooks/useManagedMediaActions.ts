import { type Dispatch, type SetStateAction, useCallback } from "react";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { ImportMediaResult, ManagedMediaItem, MediaPayload, ViewerSettings } from "../types";
import { buildMediaPayload, EMPTY_MEDIA } from "../state/mediaState";
import { removeVideoResumeSeconds } from "../state/videoResumeState";
import { getMediaBaseSize } from "../lib/pdf/getMediaBaseSize";
import { calculateFitZoom } from "../lib/fitZoom";
import { VIEWER_EVENTS } from "../events/viewerEvents";

interface PreviewControls {
  autoDisplay: boolean;
  normalizedMedia: MediaPayload;
  effectivePage: number;
  effectiveZoom: number;
  effectiveRotation: number;
  effectiveVideoState: { currentTime: number; volume: number };
  setPreviewPage: Dispatch<SetStateAction<number>>;
  setPreviewZoom: Dispatch<SetStateAction<number>>;
  setPreviewRotation: Dispatch<SetStateAction<number>>;
  setPreviewMedia: (media: MediaPayload | null) => void;
  resetPreview: () => void;
  zoomSet: (value: number) => void;
}

interface Params {
  preview: PreviewControls;
  settings: ViewerSettings;
  mediaPath: string;
  managedMedia: ManagedMediaItem[];
  onManagedMediaChange: (items: ManagedMediaItem[]) => void;
  onCurrentMediaDeleted: () => void;
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function notifyActionError(actionLabel: string, error: unknown) {
  const detail = describeError(error);
  console.error(`${actionLabel}に失敗しました:`, error);
  window.alert(`${actionLabel}に失敗しました。\n${detail}`);
}

export function useManagedMediaActions({
  preview,
  settings,
  mediaPath,
  managedMedia,
  onManagedMediaChange,
  onCurrentMediaDeleted
}: Params) {
  const {
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
    zoomSet
  } = preview;
  const selectedPath = normalizedMedia.path;

  const ensureViewerWindow = useCallback(async () => {
    await invoke("ensure_viewer_window");
  }, []);

  const ensureViewerReady = useCallback(async () => {
    await ensureViewerWindow();
    await invoke("apply_viewer_settings", { settings });
  }, [ensureViewerWindow, settings]);

  const clearViewerMedia = useCallback(async () => {
    onCurrentMediaDeleted();
    await emit(VIEWER_EVENTS.OPEN_MEDIA, EMPTY_MEDIA);
  }, [onCurrentMediaDeleted]);

  const openMedia = useCallback(
    async (path: string) => {
      const payload = await buildMediaPayload(path);
      setPreviewMedia(payload);
      setPreviewPage(1);
      setPreviewZoom(1);
      setPreviewRotation(0);
      if (autoDisplay) {
        await ensureViewerReady();
        await emit(VIEWER_EVENTS.OPEN_MEDIA, payload);
      }
    },
    [
      autoDisplay,
      ensureViewerReady,
      setPreviewMedia,
      setPreviewPage,
      setPreviewRotation,
      setPreviewZoom
    ]
  );

  const openFile = useCallback(async () => {
    try {
      const result = await invoke<ImportMediaResult | null>("pick_and_import_media");
      if (!result) return;
      onManagedMediaChange(result.items);
      await openMedia(result.imported.path);
    } catch (error) {
      notifyActionError("ファイルの取り込み", error);
    }
  }, [onManagedMediaChange, openMedia]);

  const openManagedItem = useCallback(
    async (item: ManagedMediaItem) => {
      try {
        await openMedia(item.path);
      } catch (error) {
        notifyActionError(`「${item.name}」の表示`, error);
      }
    },
    [openMedia]
  );

  const deleteManagedItem = useCallback(
    async (item: ManagedMediaItem) => {
      if (!window.confirm(`「${item.name}」を削除しますか？`)) return;
      try {
        const items = await invoke<ManagedMediaItem[]>("delete_managed_media", { path: item.path });
        onManagedMediaChange(items);
        removeVideoResumeSeconds(item.path);

        const wasPreview = selectedPath === item.path;
        const wasViewer = mediaPath === item.path;
        if (!wasPreview && !wasViewer) return;

        if (wasPreview) {
          resetPreview();
        }
        if (wasViewer || (wasPreview && autoDisplay)) {
          await clearViewerMedia();
        }
      } catch (error) {
        notifyActionError(`「${item.name}」の削除`, error);
      }
    },
    [
      autoDisplay,
      clearViewerMedia,
      mediaPath,
      onManagedMediaChange,
      resetPreview,
      selectedPath
    ]
  );

  const deleteCurrentManagedItem = useCallback(() => {
    const current = managedMedia.find((item) => item.path === selectedPath);
    if (!current) return;
    void deleteManagedItem(current);
  }, [deleteManagedItem, managedMedia, selectedPath]);

  const clearSelection = useCallback(async () => {
    if (!selectedPath) return;
    try {
      resetPreview();
      if (autoDisplay || mediaPath === selectedPath) {
        await clearViewerMedia();
      }
    } catch (error) {
      notifyActionError("選択解除", error);
    }
  }, [autoDisplay, clearViewerMedia, mediaPath, resetPreview, selectedPath]);

  const handleFitZoom = useCallback(
    async (mode: "width" | "whole") => {
      try {
        if (normalizedMedia.mediaType === "none") return;
        const size = await invoke<{ width: number; height: number } | null>("get_viewer_window_size");
        if (!size) return;
        const mediaSize = await getMediaBaseSize(normalizedMedia, effectivePage);
        if (!mediaSize) return;

        const nextZoom = calculateFitZoom(mode, size, mediaSize, effectiveRotation);
        if (nextZoom === null) return;
        zoomSet(nextZoom);
      } catch (error) {
        notifyActionError("フィット表示の計算", error);
      }
    },
    [effectivePage, effectiveRotation, normalizedMedia, zoomSet]
  );

  const syncPreviewToViewer = useCallback(async () => {
    try {
      if (!normalizedMedia.path || normalizedMedia.mediaType === "none") return;
      await ensureViewerReady();
      const shouldOpenMedia =
        mediaPath !== normalizedMedia.path || !mediaPath;
      if (shouldOpenMedia) {
        const payload = await buildMediaPayload(normalizedMedia.path);
        await emit(VIEWER_EVENTS.OPEN_MEDIA, payload);
      }
      await emit(VIEWER_EVENTS.ZOOM_SET, effectiveZoom);
      await emit(VIEWER_EVENTS.ROTATION_SET, effectiveRotation);
      if (normalizedMedia.mediaType === "pdf") {
        await emit(VIEWER_EVENTS.PAGE_SET, effectivePage);
      }
      if (normalizedMedia.mediaType === "video") {
        await emit(VIEWER_EVENTS.VIDEO_SEEK, effectiveVideoState.currentTime);
        await emit(VIEWER_EVENTS.VIDEO_VOLUME, effectiveVideoState.volume);
      }
    } catch (error) {
      notifyActionError("ビュワー同期", error);
      throw error;
    }
  }, [
    effectivePage,
    effectiveRotation,
    effectiveVideoState,
    effectiveZoom,
    ensureViewerReady,
    mediaPath,
    normalizedMedia
  ]);

  const handleShowInViewer = useCallback(async () => {
    if (autoDisplay) return;
    try {
      if (!normalizedMedia.path || normalizedMedia.mediaType === "none") {
        await ensureViewerReady();
        await emit(VIEWER_EVENTS.OPEN_MEDIA, EMPTY_MEDIA);
        return;
      }
      await syncPreviewToViewer();
    } catch (error) {
      console.error("ビュワー表示に失敗しました:", error);
      if (!normalizedMedia.path || normalizedMedia.mediaType === "none") {
        window.alert(`ビュワー表示に失敗しました: ${describeError(error)}`);
      }
    }
  }, [
    autoDisplay,
    ensureViewerReady,
    normalizedMedia,
    syncPreviewToViewer
  ]);

  return {
    openFile,
    openManagedItem,
    deleteManagedItem,
    deleteCurrentManagedItem,
    clearSelection,
    syncPreviewToViewer,
    handleFitZoom,
    handleShowInViewer
  };
}
