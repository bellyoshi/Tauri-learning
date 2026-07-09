import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useControlKeyboardShortcuts } from "./useControlKeyboardShortcuts";

function createHandlers(overrides: Partial<Parameters<typeof useControlKeyboardShortcuts>[0]> = {}) {
  return {
    mediaType: "pdf" as const,
    onPageFirst: vi.fn(),
    onPagePrev: vi.fn(),
    onPageNext: vi.fn(),
    onPageLast: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    onRotateRight90: vi.fn(),
    onDeleteCurrent: vi.fn(),
    ...overrides
  };
}

function pressKey(key: string, target: EventTarget = document.body) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true });
  Object.defineProperty(event, "target", { value: target });
  window.dispatchEvent(event);
}

describe("useControlKeyboardShortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PDF表示時にページ移動ショートカットを処理する", () => {
    const handlers = createHandlers();
    renderHook(() => useControlKeyboardShortcuts(handlers));

    pressKey("Home");
    pressKey("ArrowLeft");
    pressKey("ArrowRight");
    pressKey("End");

    expect(handlers.onPageFirst).toHaveBeenCalledTimes(1);
    expect(handlers.onPagePrev).toHaveBeenCalledTimes(1);
    expect(handlers.onPageNext).toHaveBeenCalledTimes(1);
    expect(handlers.onPageLast).toHaveBeenCalledTimes(1);
  });

  it("ズームと回転のショートカットを処理する", () => {
    const handlers = createHandlers({ mediaType: "image" });
    renderHook(() => useControlKeyboardShortcuts(handlers));

    pressKey("+");
    pressKey("-");
    pressKey("0");
    pressKey("r");

    expect(handlers.onZoomIn).toHaveBeenCalledTimes(1);
    expect(handlers.onZoomOut).toHaveBeenCalledTimes(1);
    expect(handlers.onZoomReset).toHaveBeenCalledTimes(1);
    expect(handlers.onRotateRight90).toHaveBeenCalledTimes(1);
  });

  it("入力欄フォーカス中はショートカットを無視する", () => {
    const handlers = createHandlers();
    renderHook(() => useControlKeyboardShortcuts(handlers));

    const input = document.createElement("input");
    pressKey("ArrowRight", input);

    expect(handlers.onPageNext).not.toHaveBeenCalled();
  });

  it("Delete で現在ファイル削除ハンドラを呼ぶ", () => {
    const handlers = createHandlers();
    renderHook(() => useControlKeyboardShortcuts(handlers));

    pressKey("Delete");

    expect(handlers.onDeleteCurrent).toHaveBeenCalledTimes(1);
  });

  it("未選択時はページ移動ショートカットを無視する", () => {
    const handlers = createHandlers({ mediaType: "none" });
    renderHook(() => useControlKeyboardShortcuts(handlers));

    pressKey("ArrowRight");

    expect(handlers.onPageNext).not.toHaveBeenCalled();
  });
});
