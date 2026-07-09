import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ControlPanel } from "./ControlPanel";
import { EMPTY_MEDIA } from "../state/mediaState";
import { DEFAULT_SETTINGS } from "../state/settingsState";
import { createMedia } from "../test/fixtures/media";
const invokeMock = vi.fn();
const emitMock = vi.fn();
const listenMock = vi.fn(() => Promise.resolve(() => {}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (path: string) => `asset://localhost/${path}`
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: (...args: unknown[]) => emitMock(...args),
  listen: (...args: unknown[]) => listenMock(...args)
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 5,
      getPage: vi.fn(async () => ({
        getViewport: vi.fn(() => ({ width: 100, height: 100 })),
        render: vi.fn(() => ({ promise: Promise.resolve() }))
      }))
    })
  }))
}));

function renderControlPanel(overrides: Partial<React.ComponentProps<typeof ControlPanel>> = {}) {
  const onSettingsOpen = vi.fn();
  const onManagedMediaChange = vi.fn();
  const onCurrentMediaDeleted = vi.fn();
  const onPdfMeta = vi.fn();

  const props: React.ComponentProps<typeof ControlPanel> = {
    media: EMPTY_MEDIA,
    currentPage: 1,
    totalPages: 5,
    zoom: 1,
    rotation: 0,
    mediaPath: "",
    managedMedia: [],
    monitors: [{ index: 0, name: "Monitor 1" }],
    settings: DEFAULT_SETTINGS,
    settingsOpenError: "",
    videoState: { playing: false, currentTime: 0, duration: 120, volume: 1 },
    onSettingsOpen,
    onManagedMediaChange,
    onCurrentMediaDeleted,
    onPdfMeta,
    ...overrides
  };

  const view = render(<ControlPanel {...props} />);
  return { ...view, onSettingsOpen, onManagedMediaChange, onCurrentMediaDeleted, onPdfMeta, props };
}

describe("ControlPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockImplementation((command: string) => {
      if (command === "get_viewer_window_size") {
        return Promise.resolve({ width: 1200, height: 900 });
      }
      return Promise.resolve(null);
    });

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillRect: vi.fn()
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it("PDF表示時にページ移動セクションを表示する", () => {
    renderControlPanel({ media: createMedia("pdf"), mediaPath: "sample.pdf" });
    expect(screen.getByRole("heading", { name: "ページ移動" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "先頭" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最後" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "動画再生" })).not.toBeInTheDocument();
  });

  it("動画表示時に動画再生セクションを表示する", () => {
    renderControlPanel({ media: createMedia("video"), mediaPath: "clip.mp4" });
    expect(screen.getByRole("heading", { name: "動画再生" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再生" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "ページ移動" })).not.toBeInTheDocument();
  });

  it("画像表示時はページ移動と動画再生を表示しない", () => {
    renderControlPanel({ media: createMedia("image"), mediaPath: "photo.png" });
    expect(screen.queryByRole("heading", { name: "ページ移動" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "動画再生" })).not.toBeInTheDocument();
  });

  it("自動表示ONのときビュワーに表示ボタンを無効化する", () => {
    renderControlPanel({ media: createMedia("pdf"), mediaPath: "sample.pdf" });
    expect(screen.getByRole("button", { name: "ビュワーに表示" })).toBeDisabled();
  });

  it("自動表示OFFのときビュワーに表示ボタンを有効化する", () => {
    renderControlPanel({ media: createMedia("image"), mediaPath: "photo.png" });

    const checkbox = screen.getByRole("checkbox", { name: /操作中に自動表示/ });
    fireEvent.click(checkbox);

    expect(screen.getByRole("button", { name: "ビュワーに表示" })).toBeEnabled();
  });

  it("自動表示OFFなら未選択でもビュワーに表示ボタンを有効化する", () => {
    renderControlPanel({ media: EMPTY_MEDIA, mediaPath: "" });

    const checkbox = screen.getByRole("checkbox", { name: /操作中に自動表示/ });
    fireEvent.click(checkbox);

    expect(screen.getByRole("button", { name: "ビュワーに表示" })).toBeEnabled();
  });

  it("自動表示OFFで未選択時にビュワーに表示すると背景表示で開く", async () => {
    renderControlPanel({ media: EMPTY_MEDIA, mediaPath: "" });

    fireEvent.click(screen.getByRole("checkbox", { name: /操作中に自動表示/ }));
    vi.clearAllMocks();
    fireEvent.click(screen.getByRole("button", { name: "ビュワーに表示" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("ensure_viewer_window");
      expect(invokeMock).toHaveBeenCalledWith("apply_viewer_settings", { settings: DEFAULT_SETTINGS });
      expect(emitMock).toHaveBeenCalledWith("viewer:open-media", EMPTY_MEDIA);
    });
  });

  it("自動表示OFFでファイル選択後にビュワーへプレビュー内容を送る", async () => {
    const media = createMedia("pdf");
    const managedItem = { name: "sample.pdf", path: media.path };

    renderControlPanel({
      media: EMPTY_MEDIA,
      mediaPath: "",
      managedMedia: [managedItem],
      totalPages: 5
    });

    fireEvent.click(screen.getByRole("checkbox", { name: /操作中に自動表示/ }));
    fireEvent.click(screen.getByRole("button", { name: "sample.pdf" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "ビュワーに表示" })).toBeEnabled();
    });

    vi.clearAllMocks();
    fireEvent.click(screen.getByRole("button", { name: "ビュワーに表示" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("ensure_viewer_window");
      expect(invokeMock).toHaveBeenCalledWith("apply_viewer_settings", { settings: DEFAULT_SETTINGS });
      expect(emitMock).toHaveBeenCalledWith(
        "viewer:open-media",
        expect.objectContaining({ path: media.path, mediaType: "pdf" })
      );
      expect(emitMock).toHaveBeenCalledWith("viewer:zoom-set", 1);
      expect(emitMock).toHaveBeenCalledWith("viewer:rotation-set", 0);
      expect(emitMock).toHaveBeenCalledWith("viewer:page-set", 1);
    });
  });

  it("自動表示OFFで既存選択をビュワーへ状態同期する", async () => {
    const media = createMedia("image");

    renderControlPanel({
      media,
      mediaPath: media.path
    });

    fireEvent.click(screen.getByRole("checkbox", { name: /操作中に自動表示/ }));

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /操作中に自動表示/ })).not.toBeChecked();
    });

    vi.clearAllMocks();
    fireEvent.click(screen.getByRole("button", { name: "ビュワーに表示" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("ensure_viewer_window");
      expect(emitMock).toHaveBeenCalledWith("viewer:zoom-set", 1);
      expect(emitMock).toHaveBeenCalledWith("viewer:rotation-set", 0);
    });
  });

  it("動画表示時は自動表示チェックボックスを無効化する", () => {
    renderControlPanel({ media: createMedia("video"), mediaPath: "clip.mp4" });
    expect(screen.getByRole("checkbox", { name: /操作中に自動表示/ })).toBeDisabled();
    expect(screen.getByText("動画では自動表示の切り替えはできません")).toBeInTheDocument();
  });

  it("設定変更ボタンで onSettingsOpen を呼ぶ", () => {
    const { onSettingsOpen } = renderControlPanel();

    const settingsSection = screen.getByRole("heading", { name: "現在設定" }).closest("section");
    expect(settingsSection).not.toBeNull();
    fireEvent.click(within(settingsSection!).getByRole("button", { name: "設定変更" }));

    expect(onSettingsOpen).toHaveBeenCalledTimes(1);
  });

  it("未選択時は背景色をプレビュー表示する", () => {
    renderControlPanel({
      settings: { ...DEFAULT_SETTINGS, backgroundColor: "#ff0000" }
    });

    const preview = document.querySelector(".preview-stage");
    expect(preview).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" });
    expect(screen.queryByText("表示するファイルを選択してください")).not.toBeInTheDocument();
  });

  it("選択解除ボタンで現在の選択をクリアする", async () => {
    const { onCurrentMediaDeleted } = renderControlPanel({
      media: createMedia("image"),
      mediaPath: "C:\\media\\file\\photo.png"
    });

    fireEvent.click(screen.getByRole("button", { name: "選択解除" }));

    expect(onCurrentMediaDeleted).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith("viewer:open-media", EMPTY_MEDIA);
  });

  it("未選択時は選択解除ボタンを無効化する", () => {
    renderControlPanel();
    expect(screen.getByRole("button", { name: "選択解除" })).toBeDisabled();
  });

  it("ヘルプボタンでショートカット一覧を表示する", () => {
    renderControlPanel();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("キーボードショートカット")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ヘルプ" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "キーボードショートカット" })).toBeInTheDocument();
    expect(screen.getByText("ページ移動（PDF）")).toBeInTheDocument();
    expect(screen.queryByText(/ショートカット: ←→/)).not.toBeInTheDocument();
  });

  it("ヘルプダイアログを閉じられる", () => {
    renderControlPanel();
    fireEvent.click(screen.getByRole("button", { name: "ヘルプ" }));
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
