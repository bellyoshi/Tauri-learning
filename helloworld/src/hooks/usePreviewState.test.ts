import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VIEWER_EVENTS } from "../events/viewerEvents";
import { usePreviewState } from "./usePreviewState";
import { createMedia } from "../test/fixtures/media";

const emitMock = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  emit: (...args: unknown[]) => emitMock(...args)
}));

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

  it("初期状態でプレビュー値を有効値として使う", () => {
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

  it("自動表示ONのときdispatchはローカル更新とイベントemitを行う", () => {
    const { result } = renderHook(() => usePreviewState(createSource()));
    const local = vi.fn(() => {
      result.current.setPreviewPage(3);
    });

    act(() => {
      result.current.dispatch(VIEWER_EVENTS.PAGE_NEXT, undefined, local);
    });

    expect(local).toHaveBeenCalledTimes(1);
    expect(result.current.effectivePage).toBe(3);
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

  it("プレビューを動画に切り替えると自動表示を強制ONにする", async () => {
    const { result } = renderHook(({ source }) => usePreviewState(source), {
      initialProps: { source: createSource({ media: createMedia("image") }) }
    });

    act(() => {
      result.current.setAutoDisplay(false);
    });
    expect(result.current.autoDisplay).toBe(false);

    act(() => {
      result.current.setPreviewMedia(createMedia("video"));
    });

    await waitFor(() => {
      expect(result.current.autoDisplay).toBe(true);
    });
    expect(result.current.isVideoMedia).toBe(true);
  });

  it("プレビューをPDF以外へ切り替えるとページを1にリセットする", async () => {
    const { result } = renderHook(({ source }) => usePreviewState(source), {
      initialProps: { source: createSource() }
    });

    act(() => {
      result.current.setAutoDisplay(false);
      result.current.setPreviewPage(4);
      result.current.setPreviewTotalPages(6);
    });

    act(() => {
      result.current.setPreviewMedia(createMedia("image"));
    });

    await waitFor(() => {
      expect(result.current.previewPage).toBe(1);
      expect(result.current.previewTotalPages).toBe(1);
    });
  });

  it("resetPreview でプレビュー状態を初期化する", () => {
    const { result } = renderHook(() => usePreviewState(createSource()));

    act(() => {
      result.current.setAutoDisplay(false);
      result.current.setPreviewPage(4);
      result.current.setPreviewTotalPages(6);
      result.current.setPreviewZoom(2);
      result.current.setPreviewRotation(180);
      result.current.resetPreview();
    });

    expect(result.current.previewPage).toBe(1);
    expect(result.current.previewTotalPages).toBe(1);
    expect(result.current.previewZoom).toBe(1);
    expect(result.current.previewRotation).toBe(0);
    expect(result.current.previewMedia).toBeNull();
    expect(result.current.previewVideoState).toEqual({
      playing: false,
      currentTime: 0,
      duration: 0,
      volume: 1
    });
  });

  it("編集中はソース側が変わってもプレビューを維持する", () => {
    const { result, rerender } = renderHook(({ source }) => usePreviewState(source), {
      initialProps: { source: createSource({ media: createMedia("pdf"), currentPage: 2 }) }
    });

    rerender({
      source: createSource({
        media: createMedia("image"),
        currentPage: 1,
        totalPages: 1,
        zoom: 1,
        rotation: 0
      })
    });

    expect(result.current.normalizedMedia.mediaType).toBe("pdf");
    expect(result.current.effectivePage).toBe(2);
  });
});
