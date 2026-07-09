import { MediaPayload, ViewerSettings } from "../types";

export const VIEWER_EVENTS = {
  OPEN_MEDIA: "viewer:open-media",
  PAGE_NEXT: "viewer:page-next",
  PAGE_PREV: "viewer:page-prev",
  PAGE_FIRST: "viewer:page-first",
  PAGE_LAST: "viewer:page-last",
  PAGE_SET: "viewer:page-set",
  ZOOM_IN: "viewer:zoom-in",
  ZOOM_OUT: "viewer:zoom-out",
  ZOOM_RESET: "viewer:zoom-reset",
  ZOOM_SET: "viewer:zoom-set",
  ROTATION_SET: "viewer:rotation-set",
  VIDEO_SEEK: "viewer:video-seek",
  VIDEO_VOLUME: "viewer:video-volume",
  VIDEO_PLAY: "viewer:video-play",
  VIDEO_PAUSE: "viewer:video-pause",
  SETTINGS_UPDATED: "viewer:settings-updated",
  WINDOW_RESIZED: "viewer:window-resized"
} as const;

export type ViewerEventName = (typeof VIEWER_EVENTS)[keyof typeof VIEWER_EVENTS];

export type ViewerEventPayloads = {
  [VIEWER_EVENTS.OPEN_MEDIA]: MediaPayload;
  [VIEWER_EVENTS.PAGE_SET]: number;
  [VIEWER_EVENTS.ZOOM_SET]: number;
  [VIEWER_EVENTS.ROTATION_SET]: number;
  [VIEWER_EVENTS.VIDEO_SEEK]: number;
  [VIEWER_EVENTS.VIDEO_VOLUME]: number;
  [VIEWER_EVENTS.SETTINGS_UPDATED]: Partial<ViewerSettings>;
  [VIEWER_EVENTS.WINDOW_RESIZED]: { width: number; height: number };
};
