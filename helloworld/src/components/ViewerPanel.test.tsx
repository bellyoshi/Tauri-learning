import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ViewerPanel } from "./ViewerPanel";
import { DEFAULT_SETTINGS } from "../state/settingsState";
import { EMPTY_MEDIA } from "../state/mediaState";

const emitMock = vi.fn();
const listenMock = vi.fn(() => Promise.resolve(() => {}));
const invokeMock = vi.fn(async () => {});
const windowApiMock = {
  isDecorated: vi.fn(async () => true),
  setDecorations: vi.fn(async () => {}),
  isFullscreen: vi.fn(async () => false),
  setFullscreen: vi.fn(async () => {}),
  close: vi.fn(async () => {})
};

vi.mock("@tauri-apps/api/event", () => ({
  emit: (...args: unknown[]) => Promise.resolve(emitMock(...(args as []))),
  listen: (...args: unknown[]) => Promise.resolve(listenMock(...(args as [])))
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => windowApiMock
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => Promise.resolve(invokeMock(...(args as []))),
  convertFileSrc: (path: string) => `asset://localhost/${path}`
}));

vi.mock("../hooks/useVideoElement", () => ({
  useVideoElement: vi.fn()
}));

vi.mock("../hooks/useViewerVideoCommands", () => ({
  useViewerVideoCommands: vi.fn()
}));

vi.mock("../lib/pdf/renderPdfPage", () => ({
  loadPdfDocument: vi.fn(async () => ({
    numPages: 1,
    getPage: vi.fn(async () => ({
      getViewport: vi.fn(() => ({ width: 100, height: 100 })),
      render: vi.fn(() => ({ promise: Promise.resolve() }))
    }))
  })),
  renderPdfPageToCanvas: vi.fn(async () => {})
}));

function renderViewer() {
  return render(
    <ViewerPanel
      media={EMPTY_MEDIA}
      currentPage={1}
      zoom={1}
      rotation={0}
      settings={DEFAULT_SETTINGS}
      onPdfMeta={vi.fn()}
      onVideoStateChange={vi.fn()}
    />
  );
}

describe("ViewerPanel context menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    windowApiMock.isDecorated.mockResolvedValue(true);
    windowApiMock.isFullscreen.mockResolvedValue(false);
    invokeMock.mockResolvedValue(undefined);
  });

  it("右クリックでポップアップメニューを表示する", () => {
    const { container } = renderViewer();
    const wrapper = container.querySelector(".viewer-wrapper");
    expect(wrapper).not.toBeNull();

    fireEvent.contextMenu(wrapper!, { clientX: 120, clientY: 180 });

    expect(screen.getByRole("button", { name: "タイトルバー表示/非表示" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "フルスクリーン/ウインドウ切替" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ウインドウを閉じる" })).toBeInTheDocument();
  });

  it("メニュー項目押下でウィンドウ操作を実行する", async () => {
    const { container } = renderViewer();
    const wrapper = container.querySelector(".viewer-wrapper");
    expect(wrapper).not.toBeNull();

    fireEvent.contextMenu(wrapper!, { clientX: 120, clientY: 180 });
    fireEvent.click(screen.getByRole("button", { name: "タイトルバー表示/非表示" }));
    fireEvent.contextMenu(wrapper!, { clientX: 120, clientY: 180 });
    fireEvent.click(screen.getByRole("button", { name: "フルスクリーン/ウインドウ切替" }));
    fireEvent.contextMenu(wrapper!, { clientX: 120, clientY: 180 });
    fireEvent.click(screen.getByRole("button", { name: "ウインドウを閉じる" }));

    await vi.waitFor(() => {
      expect(windowApiMock.setDecorations).toHaveBeenCalledWith(false);
      expect(windowApiMock.setFullscreen).toHaveBeenCalledWith(true);
      expect(windowApiMock.close).toHaveBeenCalled();
      expect(emitMock).toHaveBeenCalledWith("viewer:settings-updated", { viewerMode: "fullscreen" });
      expect(invokeMock).not.toHaveBeenCalled();
    });
  });

  it("メニュー項目押下でポップアップメニューを閉じる", () => {
    const { container } = renderViewer();
    const wrapper = container.querySelector(".viewer-wrapper");
    expect(wrapper).not.toBeNull();

    fireEvent.contextMenu(wrapper!, { clientX: 120, clientY: 180 });
    fireEvent.click(screen.getByRole("button", { name: "タイトルバー表示/非表示" }));

    expect(screen.queryByRole("button", { name: "タイトルバー表示/非表示" })).not.toBeInTheDocument();
  });

  it("Window API が失敗したら invoke にフォールバックする", async () => {
    const { container } = renderViewer();
    const wrapper = container.querySelector(".viewer-wrapper");
    expect(wrapper).not.toBeNull();
    windowApiMock.isDecorated.mockRejectedValueOnce(new Error("blocked"));

    fireEvent.contextMenu(wrapper!, { clientX: 120, clientY: 180 });
    fireEvent.click(screen.getByRole("button", { name: "タイトルバー表示/非表示" }));

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("toggle_titlebar");
    });
  });
});
