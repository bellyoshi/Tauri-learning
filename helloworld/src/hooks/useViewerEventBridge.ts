import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { MediaPayload, ViewerSettings } from "../types";
import { VIEWER_EVENTS } from "../events/viewerEvents";
import { clampZoom, isValidRotation, zoomIn, zoomOut } from "../lib/viewTransform";

interface Handlers {
  setMedia: (media: MediaPayload) => void;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  setTotalPages: Dispatch<SetStateAction<number>>;
  setZoom: Dispatch<SetStateAction<number>>;
  setRotation: Dispatch<SetStateAction<number>>;
  setSettings: Dispatch<SetStateAction<ViewerSettings>>;
}

export function useViewerEventBridge(totalPages: number, handlers: Handlers) {
  const totalPagesRef = useRef(totalPages);
  totalPagesRef.current = totalPages;

  useEffect(() => {
    const unlisten = Promise.all([
      listen<MediaPayload>(VIEWER_EVENTS.OPEN_MEDIA, (event) => {
        handlers.setMedia(event.payload);
        handlers.setCurrentPage(1);
        handlers.setTotalPages(1);
        handlers.setZoom(1);
        handlers.setRotation(0);
      }),
      listen(VIEWER_EVENTS.PAGE_NEXT, () =>
        handlers.setCurrentPage((prev) => Math.min(prev + 1, totalPagesRef.current))
      ),
      listen(VIEWER_EVENTS.PAGE_PREV, () => handlers.setCurrentPage((prev) => Math.max(prev - 1, 1))),
      listen(VIEWER_EVENTS.PAGE_FIRST, () => handlers.setCurrentPage(1)),
      listen(VIEWER_EVENTS.PAGE_LAST, () =>
        handlers.setCurrentPage(Math.max(1, totalPagesRef.current))
      ),
      listen<number>(VIEWER_EVENTS.PAGE_SET, (event) =>
        handlers.setCurrentPage(
          Math.min(Math.max(1, event.payload), Math.max(1, totalPagesRef.current))
        )
      ),
      listen(VIEWER_EVENTS.ZOOM_IN, () => handlers.setZoom((prev) => zoomIn(prev))),
      listen(VIEWER_EVENTS.ZOOM_OUT, () => handlers.setZoom((prev) => zoomOut(prev))),
      listen(VIEWER_EVENTS.ZOOM_RESET, () => handlers.setZoom(1)),
      listen<number>(VIEWER_EVENTS.ZOOM_SET, (event) => handlers.setZoom(clampZoom(event.payload))),
      listen<number>(VIEWER_EVENTS.ROTATION_SET, (event) => {
        if (isValidRotation(event.payload)) {
          handlers.setRotation(event.payload);
        }
      }),
      listen<Partial<ViewerSettings>>(VIEWER_EVENTS.SETTINGS_UPDATED, (event) =>
        handlers.setSettings((prev) => ({ ...prev, ...event.payload }))
      )
    ]);

    return () => {
      void unlisten.then((fns) => fns.forEach((fn) => fn()));
    };
  }, [
    handlers.setCurrentPage,
    handlers.setMedia,
    handlers.setRotation,
    handlers.setSettings,
    handlers.setTotalPages,
    handlers.setZoom
  ]);
}
