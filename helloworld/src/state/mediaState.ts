import { MediaPayload, MediaType } from "../types";
import { convertFileSrc } from "@tauri-apps/api/core";

export const EMPTY_MEDIA: MediaPayload = {
  path: "",
  url: "",
  mediaType: "none"
};

function isWindowsAbsolutePath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

export function resolveMediaType(path: string): MediaType {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "mkv"].includes(ext)) return "video";
  return "none";
}

export async function buildMediaPayload(path: string): Promise<MediaPayload> {
  const mediaType = resolveMediaType(path);
  return {
    path,
    url: convertFileSrc(path),
    mediaType
  };
}

export function normalizeMediaPayload(payload: MediaPayload): MediaPayload {
  const shouldNormalizeUrl = !payload.url || isWindowsAbsolutePath(payload.url);
  if (!payload.path || !shouldNormalizeUrl) {
    return payload;
  }
  return {
    ...payload,
    url: convertFileSrc(payload.path)
  };
}
