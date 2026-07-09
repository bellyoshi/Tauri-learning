import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VIEWER_EVENTS } from "../events/viewerEvents";
import { usePreviewState } from "./usePreviewState";
import { MediaPayload } from "../types";

const emitMock = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  emit: (...args: unknown[]) => emitMock(...args)
}));

function createMedia(mediaType: MediaPayload["mediaType"]): MediaPayload {
  const names: Record<MediaPayload["mediaType"], string> = {
    none: "",
    pdf: "sample.pdf",
    image: "photo.png",
    video: "clip.mp4"
  };
  const fileName = names[mediaType];
  const path = fileName ? `C:\\media\\${fileName}` : "";
  return {
    path,
    url: path ? `asset://localhost/${path}` : "",
    mediaType
  };
}

function createSource(overrides: Partial<Parameters<typeof usePreviewState>[0]> = {}) {
  return {
    media: createMedia("pdf"),
    currentPage: 2,
    totalPages: 10,
    zoom: 1.5,
    rotation: 90,
    videoState: { playing: false, currentTime: 0, duration: 100, volume: 1 },
    ...overrides
  };
}

describe("usePreviewState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("自動表示ONのときソースの値をそのまま使う", () => {
    const source = createSource();
    const { result } = renderHook(() => usePreviewState(source));

    expect(result.current.effectivePage).toBe(2);
    expect(result.current.effectiveTotalPages).toBe(10);
    expect(result.current.effectiveZoom).toBe(1.5);
    expect(result.current.effectiveRotation).toBe(90);
  });

  it("自動表示OFFのときプレビュー側の値を使う", () => {
    const source = createSource();
    const { result } = renderHook(() => usePreviewState(source));

    act(() => {
      result.current.setAutoDisplay(false);
      result.current.setPreviewPage(5);
      result.current.setPreviewTotalPages(8);
      result.current.setPreviewZoom(2);
      result.current.setPreviewRotation(180);
    });

    expect(result.current.effectivePage).toBe(5);
    expect(result.current.effectiveTotalPages).toBe(8);
    expect(result.current.effectiveZoom).toBe(2);
    expect(result.current.effectiveRotation).toBe(180);
  });

  it("自動表示ONのときdispatchはイベントをemitする", () => {
    const { result } = renderHook(() => usePreviewState(createSource()));

    act(() => {
      result.current.dispatch(VIEWER_EVENTS.PAGE_NEXT, undefined, () => {});
    });

    expect(emitMock).toHaveBeenCalledWith(VIEWER_EVENTS.PAGE_NEXT);
  });

  it("自動表示OFFのときdispatchはローカル処理を実行する", () => {
    const local = vi.fn();
    const { result } = renderHook(() => usePreviewState(createSource()));

    act(() => {
      result.current.setAutoDisplay(false);
    });
    act(() => {
      result.current.dispatch(VIEWER_EVENTS.PAGE_NEXT, { page: 3 }, local);
    });

    expect(local).toHaveBeenCalledTimes(1);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("動画メディアに切り替えると自動表示を強制ONにする", async () => {
    const { result, rerender } = renderHook(({ source }) => usePreviewState(source), {
      initialProps: { source: createSource({ media: createMedia("image") }) }
    });

    act(() => {
      result.current.setAutoDisplay(false);
    });
    expect(result.current.autoDisplay).toBe(false);

    rerender({ source: createSource({ media: createMedia("video") }) });

    await waitFor(() => {
      expect(result.current.autoDisplay).toBe(true);
    });
    expect(result.current.isVideoMedia).toBe(true);
  });

  it("PDF以外のメディアに切り替えるとプレビューページを1にリセットする", async () => {
    const { result, rerender } = renderHook(({ source }) => usePreviewState(source), {
      initialProps: { source: createSource() }
    });

    act(() => {
      result.current.setAutoDisplay(false);
      result.current.setPreviewPage(4);
      result.current.setPreviewTotalPages(6);
    });

    rerender({ source: createSource({ media: createMedia("image") }) });

    await waitFor(() => {
      expect(result.current.previewPage).toBe(1);
      expect(result.current.previewTotalPages).toBe(1);
    });
  });
});
