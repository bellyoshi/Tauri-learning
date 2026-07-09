import { RefObject, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { VIEWER_EVENTS } from "../events/viewerEvents";

export function useViewerVideoCommands(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled) return;

    const unlisten = Promise.all([
      listen<number>(VIEWER_EVENTS.VIDEO_SEEK, (event) => {
        video.currentTime = event.payload;
      }),
      listen<number>(VIEWER_EVENTS.VIDEO_VOLUME, (event) => {
        video.volume = event.payload;
      }),
      listen(VIEWER_EVENTS.VIDEO_PLAY, () => {
        void video.play();
      }),
      listen(VIEWER_EVENTS.VIDEO_PAUSE, () => {
        video.pause();
      })
    ]);

    return () => {
      void unlisten.then((fns) => fns.forEach((fn) => fn()));
    };
  }, [enabled, videoRef]);
}
