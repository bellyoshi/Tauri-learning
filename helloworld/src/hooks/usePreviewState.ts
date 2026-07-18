import { useCallback, useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { MediaPayload, VideoState } from "../types";
import { normalizeMediaPayload } from "../state/mediaState";
import { VIEWER_EVENTS } from "../events/viewerEvents";

interface PreviewSource {
  media: MediaPayload;
  currentPage: number;
  totalPages: number;
  zoom: number;
  rotation: number;
  videoState: VideoState;
}

export function usePreviewState(source: PreviewSource) {
  const [autoDisplay, setAutoDisplay] = useState(true);
  const [previewMedia, setPreviewMedia] = useState<MediaPayload | null>(
    source.media.mediaType === "none" ? null : source.media
  );
  const [previewPage, setPreviewPage] = useState(source.currentPage);
  const [previewTotalPages, setPreviewTotalPages] = useState(source.totalPages);
  const [previewZoom, setPreviewZoom] = useState(source.zoom);
  const [previewRotation, setPreviewRotation] = useState(source.rotation);
  const [previewVideoState, setPreviewVideoState] = useState<VideoState>({
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 1
  });

  const activeMedia = previewMedia ?? source.media;
  const normalizedMedia = normalizeMediaPayload(activeMedia);
  const isVideoMedia = normalizedMedia.mediaType === "video";

  const effectivePage = previewPage;
  const effectiveTotalPages = previewTotalPages;
  const effectiveZoom = previewZoom;
  const effectiveRotation = previewRotation;
  const effectiveVideoState = previewVideoState;

  useEffect(() => {
    if (!autoDisplay) return;
    if (source.media.mediaType === "none") return;
    if (previewMedia) return;
    setPreviewMedia(source.media);
    setPreviewPage(source.currentPage);
    setPreviewTotalPages(source.totalPages);
    setPreviewZoom(source.zoom);
    setPreviewRotation(source.rotation);
    setPreviewVideoState(source.videoState);
  }, [
    autoDisplay,
    previewMedia,
    source.currentPage,
    source.media,
    source.rotation,
    source.totalPages,
    source.videoState,
    source.zoom
  ]);

  useEffect(() => {
    if (normalizedMedia.mediaType !== "pdf") {
      setPreviewTotalPages(1);
      setPreviewPage(1);
    }
  }, [normalizedMedia.mediaType, normalizedMedia.url]);

  useEffect(() => {
    if (isVideoMedia) {
      setAutoDisplay(true);
    }
  }, [isVideoMedia]);

  const dispatch = useCallback(
    (event: string, payload: unknown | undefined, local: () => void) => {
      local();
      if (autoDisplay) {
        if (payload === undefined) void emit(event);
        else void emit(event, payload);
      }
    },
    [autoDisplay]
  );

  const resetPreview = useCallback(() => {
    setPreviewMedia(null);
    setPreviewPage(1);
    setPreviewTotalPages(1);
    setPreviewZoom(1);
    setPreviewRotation(0);
    setPreviewVideoState({
      playing: false,
      currentTime: 0,
      duration: 0,
      volume: 1
    });
  }, []);

  return {
    autoDisplay,
    setAutoDisplay,
    previewMedia,
    setPreviewMedia,
    previewPage,
    setPreviewPage,
    previewTotalPages,
    setPreviewTotalPages,
    previewZoom,
    setPreviewZoom,
    previewRotation,
    setPreviewRotation,
    previewVideoState,
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
    events: VIEWER_EVENTS
  };
}
