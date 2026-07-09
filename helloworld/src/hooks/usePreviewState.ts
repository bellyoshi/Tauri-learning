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
  const [previewMedia, setPreviewMedia] = useState<MediaPayload | null>(null);
  const [previewPage, setPreviewPage] = useState(source.currentPage);
  const [previewTotalPages, setPreviewTotalPages] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(source.zoom);
  const [previewRotation, setPreviewRotation] = useState(source.rotation);
  const [previewVideoState, setPreviewVideoState] = useState<VideoState>({
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 1
  });

  const activeMedia = autoDisplay ? source.media : (previewMedia ?? source.media);
  const normalizedMedia = normalizeMediaPayload(activeMedia);
  const isVideoMedia = normalizedMedia.mediaType === "video";

  const effectivePage = autoDisplay ? source.currentPage : previewPage;
  const effectiveTotalPages = autoDisplay ? source.totalPages : previewTotalPages;
  const effectiveZoom = autoDisplay ? source.zoom : previewZoom;
  const effectiveRotation = autoDisplay ? source.rotation : previewRotation;
  const effectiveVideoState = autoDisplay ? source.videoState : previewVideoState;

  useEffect(() => {
    if (!autoDisplay) return;
    setPreviewMedia(null);
    setPreviewTotalPages(source.totalPages);
    setPreviewPage(source.currentPage);
    setPreviewZoom(source.zoom);
    setPreviewRotation(source.rotation);
  }, [autoDisplay, source.currentPage, source.totalPages, source.zoom, source.rotation]);

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
      if (autoDisplay) {
        if (payload === undefined) void emit(event);
        else void emit(event, payload);
        return;
      }
      local();
    },
    [autoDisplay]
  );

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
    events: VIEWER_EVENTS
  };
}
