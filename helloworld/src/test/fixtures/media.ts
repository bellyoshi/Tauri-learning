import { MediaPayload, MediaType } from "../types";

const MEDIA_FILE_NAMES: Record<Exclude<MediaType, "none">, string> = {
  pdf: "sample.pdf",
  image: "photo.png",
  video: "clip.mp4"
};

export function createMedia(
  mediaType: MediaPayload["mediaType"],
  basePath = "C:\\media\\file"
): MediaPayload {
  if (mediaType === "none") {
    return { path: "", url: "", mediaType: "none" };
  }

  const fileName = MEDIA_FILE_NAMES[mediaType];
  const path = `${basePath}\\${fileName}`;
  return {
    path,
    url: `asset://localhost/${path}`,
    mediaType
  };
}
