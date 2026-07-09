const KEY = "video-resume-seconds";

function loadMap(): Record<string, number> {
  const raw = localStorage.getItem(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, number> = {};
    for (const [path, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        result[path] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function getVideoResumeSeconds(path: string): number {
  if (!path) return 0;
  const map = loadMap();
  return map[path] ?? 0;
}

export function setVideoResumeSeconds(path: string, seconds: number): void {
  if (!path || !Number.isFinite(seconds) || seconds < 0) return;
  const map = loadMap();
  map[path] = Math.max(0, Math.round(seconds * 10) / 10);
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function removeVideoResumeSeconds(path: string): void {
  if (!path) return;
  const map = loadMap();
  delete map[path];
  localStorage.setItem(KEY, JSON.stringify(map));
}
