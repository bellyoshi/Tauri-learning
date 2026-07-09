import { RefObject, useEffect } from "react";
import { getVideoResumeSeconds, setVideoResumeSeconds } from "../state/videoResumeState";
import { VideoState } from "../types";

interface Options {
  mediaPath: string;
  mediaType: string;
  onStateChange?: (state: VideoState) => void;
}

export function useVideoElement(videoRef: RefObject<HTMLVideoElement | null>, options: Options) {
  const { mediaPath, mediaType, onStateChange } = options;
  const isVideo = mediaType === "video";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const update = () => {
      const state: VideoState = {
        playing: !video.paused,
        currentTime: video.currentTime || 0,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        volume: video.volume
      };
      onStateChange?.(state);
      if (isVideo && mediaPath) {
        setVideoResumeSeconds(mediaPath, video.currentTime || 0);
      }
    };

    const applyResumePosition = () => {
      if (!isVideo || !mediaPath) return;
      const resumeSeconds = getVideoResumeSeconds(mediaPath);
      if (resumeSeconds <= 0) return;
      const duration = Number.isFinite(video.duration) ? video.duration : resumeSeconds;
      video.currentTime = Math.min(resumeSeconds, Math.max(0, duration));
      update();
    };

    video.addEventListener("play", update);
    video.addEventListener("pause", update);
    video.addEventListener("timeupdate", update);
    video.addEventListener("loadedmetadata", update);
    video.addEventListener("loadedmetadata", applyResumePosition);
    video.addEventListener("volumechange", update);

    return () => {
      video.removeEventListener("play", update);
      video.removeEventListener("pause", update);
      video.removeEventListener("timeupdate", update);
      video.removeEventListener("loadedmetadata", update);
      video.removeEventListener("loadedmetadata", applyResumePosition);
      video.removeEventListener("volumechange", update);
    };
  }, [isVideo, mediaPath, mediaType, onStateChange, videoRef]);
}
