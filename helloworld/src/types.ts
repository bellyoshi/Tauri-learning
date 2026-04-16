export type ViewerMode = "windowed" | "fullscreen";
export type MediaType = "none" | "pdf" | "image" | "video";

export interface MediaPayload {
  path: string;
  url: string;
  mediaType: MediaType;
}

export interface ViewerSettings {
  backgroundColor: string;
  backgroundImagePath: string;
  monitorIndex: number;
  viewerMode: ViewerMode;
}

export interface MonitorInfo {
  index: number;
  name: string;
}

export interface VideoState {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

export interface ManagedMediaItem {
  name: string;
  path: string;
}
