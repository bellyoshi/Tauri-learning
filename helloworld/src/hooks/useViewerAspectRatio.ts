import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { VIEWER_EVENTS } from "../events/viewerEvents";

export function useViewerAspectRatio() {
  const [aspectRatio, setAspectRatio] = useState(1200 / 900);

  useEffect(() => {
    const updateViewerSize = async () => {
      const size = await invoke<{ width: number; height: number } | null>("get_viewer_window_size");
      if (!size || size.width <= 0 || size.height <= 0) return;
      setAspectRatio(size.width / size.height);
    };

    void updateViewerSize();

    const unlisten = listen<{ width: number; height: number }>(VIEWER_EVENTS.WINDOW_RESIZED, (event) => {
      const { width, height } = event.payload;
      if (width > 0 && height > 0) {
        setAspectRatio(width / height);
      }
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  return aspectRatio;
}
