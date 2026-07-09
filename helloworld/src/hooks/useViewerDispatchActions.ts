import { RefObject, useMemo, type Dispatch, type SetStateAction } from "react";
import { VIEWER_EVENTS } from "../events/viewerEvents";
import { zoomIn, zoomOut } from "../lib/viewTransform";

type Dispatch = (event: string, payload: unknown | undefined, local: () => void) => void;

interface PreviewSetters {
  setPreviewPage: Dispatch<SetStateAction<number>>;
  setPreviewZoom: Dispatch<SetStateAction<number>>;
  setPreviewRotation: Dispatch<SetStateAction<number>>;
}

interface Params extends PreviewSetters {
  dispatch: Dispatch;
  effectiveTotalPages: number;
  effectiveRotation: number;
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function useViewerDispatchActions({
  dispatch,
  effectiveTotalPages,
  effectiveRotation,
  setPreviewPage,
  setPreviewZoom,
  setPreviewRotation,
  videoRef
}: Params) {
  return useMemo(
    () => ({
      pageFirst: () => dispatch(VIEWER_EVENTS.PAGE_FIRST, undefined, () => setPreviewPage(1)),
      pagePrev: () =>
        dispatch(VIEWER_EVENTS.PAGE_PREV, undefined, () =>
          setPreviewPage((prev) => Math.max(prev - 1, 1))
        ),
      pageNext: () =>
        dispatch(VIEWER_EVENTS.PAGE_NEXT, undefined, () =>
          setPreviewPage((prev) => Math.min(prev + 1, effectiveTotalPages))
        ),
      pageLast: () =>
        dispatch(VIEWER_EVENTS.PAGE_LAST, undefined, () =>
          setPreviewPage(Math.max(1, effectiveTotalPages))
        ),
      zoomIn: () => dispatch(VIEWER_EVENTS.ZOOM_IN, undefined, () => setPreviewZoom((prev) => zoomIn(prev))),
      zoomOut: () => dispatch(VIEWER_EVENTS.ZOOM_OUT, undefined, () => setPreviewZoom((prev) => zoomOut(prev))),
      zoomReset: () => dispatch(VIEWER_EVENTS.ZOOM_RESET, undefined, () => setPreviewZoom(1)),
      zoomSet: (value: number) => dispatch(VIEWER_EVENTS.ZOOM_SET, value, () => setPreviewZoom(value)),
      rotateRight90: () => {
        const next = (effectiveRotation + 90) % 360;
        dispatch(VIEWER_EVENTS.ROTATION_SET, next, () => setPreviewRotation(next));
      },
      rotate180: () => dispatch(VIEWER_EVENTS.ROTATION_SET, 180, () => setPreviewRotation(180)),
      rotate270: () => dispatch(VIEWER_EVENTS.ROTATION_SET, 270, () => setPreviewRotation(270)),
      rotateReset: () => dispatch(VIEWER_EVENTS.ROTATION_SET, 0, () => setPreviewRotation(0)),
      videoPlay: () =>
        dispatch(VIEWER_EVENTS.VIDEO_PLAY, undefined, () => void videoRef.current?.play()),
      videoPause: () =>
        dispatch(VIEWER_EVENTS.VIDEO_PAUSE, undefined, () => videoRef.current?.pause()),
      videoSeek: (value: number) =>
        dispatch(VIEWER_EVENTS.VIDEO_SEEK, value, () => {
          if (videoRef.current) videoRef.current.currentTime = value;
        }),
      videoVolume: (value: number) =>
        dispatch(VIEWER_EVENTS.VIDEO_VOLUME, value, () => {
          if (videoRef.current) videoRef.current.volume = value;
        })
    }),
    [
      dispatch,
      effectiveRotation,
      effectiveTotalPages,
      setPreviewPage,
      setPreviewRotation,
      setPreviewZoom,
      videoRef
    ]
  );
}
