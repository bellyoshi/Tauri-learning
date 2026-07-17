import { type Dispatch, type SetStateAction, useCallback } from "react";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { ManagedMediaItem, MediaPayload, ViewerSettings } from "../types";
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
    setPreviewMedia,
    resetPreview,
    zoomSet
  } = preview;

  const ensureViewerWindow = useCallback(async () => {
    await invoke("ensure_viewer_window");
  }, []);

  const ensureViewerReady = useCallback(async () => {
    await ensureViewerWindow();
    await invoke("apply_viewer_settings", { settings });
  }, [ensureViewerWindow, settings]);

  const syncClearToViewer = useCallback(async () => {
    resetPreview();
    onCurrentMediaDeleted();
    if (autoDisplay) {
      await emit(VIEWER_EVENTS.OPEN_MEDIA, EMPTY_MEDIA);
    }
  }, [autoDisplay, onCurrentMediaDeleted, resetPreview]);

  const openMedia = useCallback(
    async (path: string) => {
      const payload = await buildMediaPayload(path);
      setPreviewMedia(payload);
      setPreviewPage(1);
      if (autoDisplay) {
        await ensureViewerReady();
        await emit(VIEWER_EVENTS.OPEN_MEDIA, payload);
      }
    },
    [autoDisplay, ensureViewerReady, setPreviewMedia, setPreviewPage]
  );

  const openFile = useCallback(async () => {
    try {
      const items = await invoke<ManagedMediaItem[]>("pick_and_import_media");
      onManagedMediaChange(items);
      const latest = items.at(-1);
      if (!latest) return;
      await openMedia(latest.path);
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

        if (mediaPath !== item.path) return;
        await syncClearToViewer();
      } catch (error) {
        notifyActionError(`「${item.name}」の削除`, error);
      }
    },
    [mediaPath, onManagedMediaChange, syncClearToViewer]
  );

  const deleteCurrentManagedItem = useCallback(() => {
    const current = managedMedia.find((item) => item.path === mediaPath);
    if (!current) return;
    void deleteManagedItem(current);
  }, [deleteManagedItem, managedMedia, mediaPath]);

  const clearSelection = useCallback(async () => {
    if (!mediaPath) return;
    try {
      await syncClearToViewer();
    } catch (error) {
      notifyActionError("選択解除", error);
    }
  }, [mediaPath, syncClearToViewer]);

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
