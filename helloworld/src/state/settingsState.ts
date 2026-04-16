import { ViewerSettings } from "../types";

const KEY = "viewer-settings";

export const DEFAULT_SETTINGS: ViewerSettings = {
  backgroundColor: "#101820",
  backgroundImagePath: "",
  monitorIndex: 0,
  viewerMode: "windowed"
};

export function loadSettings(): ViewerSettings {
  const raw = localStorage.getItem(KEY);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<ViewerSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ViewerSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
