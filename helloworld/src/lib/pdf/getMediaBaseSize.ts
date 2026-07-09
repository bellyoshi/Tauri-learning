import { normalizeMediaPayload } from "../../state/mediaState";
import { pdfjsLib } from "./setup";

export async function getMediaBaseSize(
  media: ReturnType<typeof normalizeMediaPayload>,
  page: number
): Promise<{ width: number; height: number } | null> {
  if (!media.url) return null;

  if (media.mediaType === "pdf") {
    const doc = await pdfjsLib.getDocument(media.url).promise;
    const pdfPage = await doc.getPage(Math.max(1, page));
    const viewport = pdfPage.getViewport({ scale: 1 });
    return { width: viewport.width, height: viewport.height };
  }

  if (media.mediaType === "image") {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("画像サイズの取得に失敗しました"));
      element.src = media.url;
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  }

  if (media.mediaType === "video") {
    const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
      const element = document.createElement("video");
      element.preload = "metadata";
      element.onloadedmetadata = () => resolve(element);
      element.onerror = () => reject(new Error("動画サイズの取得に失敗しました"));
      element.src = media.url;
    });
    return { width: video.videoWidth, height: video.videoHeight };
  }

  return null;
}
