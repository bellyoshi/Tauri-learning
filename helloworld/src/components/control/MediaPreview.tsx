import { RefObject } from "react";
import { buildViewerBackgroundStyle } from "../../lib/viewerBackground";
import { mediaTransformStyle } from "../../lib/viewTransform";
import { MediaType, ViewerSettings } from "../../types";

interface Props {
  mediaType: MediaType;
  mediaUrl: string;
  aspectRatio: number;
  zoom: number;
  rotation: number;
  settings: ViewerSettings;
  canvasRef: RefObject<HTMLCanvasElement>;
  videoRef: RefObject<HTMLVideoElement>;
  containerRef: RefObject<HTMLDivElement>;
}

export function MediaPreview({
  mediaType,
  mediaUrl,
  aspectRatio,
  zoom,
  rotation,
  settings,
  canvasRef,
  videoRef,
  containerRef
}: Props) {
  return (
    <div
      ref={containerRef}
      className="preview-stage"
      style={{ aspectRatio: String(aspectRatio), ...buildViewerBackgroundStyle(settings) }}
    >
      {mediaType === "image" && (
        <img className="media-image" src={mediaUrl} alt="preview image" style={mediaTransformStyle(zoom, rotation)} />
      )}
      {mediaType === "video" && (
        <video
          ref={videoRef}
          className="media-video"
          src={mediaUrl}
          controls={false}
          muted
          style={mediaTransformStyle(zoom, rotation)}
        />
      )}
      {mediaType === "pdf" && <canvas className="preview-pdf-canvas" ref={canvasRef} />}
    </div>
  );
}
