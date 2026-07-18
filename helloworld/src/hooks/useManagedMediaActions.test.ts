import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useManagedMediaActions } from "./useManagedMediaActions";
import { createMedia } from "../test/fixtures/media";
import { DEFAULT_SETTINGS } from "../state/settingsState";
import { EMPTY_MEDIA } from "../state/mediaState";
import { VIEWER_EVENTS } from "../events/viewerEvents";

const invokeMock = vi.fn();
const emitMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (path: string) => `asset://localhost/${path}`
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: (...args: unknown[]) => emitMock(...args)
}));

function createPreview(overrides: Partial<Parameters<typeof useManagedMediaActions>[0]["preview"]> = {}) {
  const media = createMedia("image");
  return {
    autoDisplay: false,
    normalizedMedia: media,
    effectivePage: 1,
    effectiveZoom: 1.5,
    effectiveRotation: 90,
    effectiveVideoState: { currentTime: 0, volume: 1 },
    setPreviewPage: vi.fn(),
    setPreviewZoom: vi.fn(),
    setPreviewRotation: vi.fn(),
    setPreviewMedia: vi.fn(),
    resetPreview: vi.fn(),
    zoomSet: vi.fn(),
    ...overrides
  };
}

describe("useManagedMediaActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockResolvedValue(null);
  });

  it("自動表示OFFのときビュワーへプレビュー内容を送る", async () => {
    const media = createMedia("image");
    const preview = createPreview({ normalizedMedia: media });

    const { result } = renderHook(() =>
      useManagedMediaActions({
        preview,
        settings: DEFAULT_SETTINGS,
        mediaPath: "",
        managedMedia: [],
        onManagedMediaChange: vi.fn(),
        onCurrentMediaDeleted: vi.fn()
      })
    );

    await act(async () => {
      await result.current.handleShowInViewer();
    });

    expect(invokeMock).toHaveBeenCalledWith("ensure_viewer_window");
    expect(invokeMock).toHaveBeenCalledWith("apply_viewer_settings", { settings: DEFAULT_SETTINGS });
    expect(emitMock).toHaveBeenCalledWith(
      VIEWER_EVENTS.OPEN_MEDIA,
      expect.objectContaining({ path: media.path, mediaType: "image" })
    );
    expect(emitMock).toHaveBeenCalledWith(VIEWER_EVENTS.ZOOM_SET, 1.5);
    expect(emitMock).toHaveBeenCalledWith(VIEWER_EVENTS.ROTATION_SET, 90);
  });

  it("自動表示OFFかつ未選択のときはビュワーを背景表示で開く", async () => {
    const preview = createPreview({ normalizedMedia: EMPTY_MEDIA });

    const { result } = renderHook(() =>
      useManagedMediaActions({
        preview,
        settings: DEFAULT_SETTINGS,
        mediaPath: "",
        managedMedia: [],
        onManagedMediaChange: vi.fn(),
        onCurrentMediaDeleted: vi.fn()
      })
    );

    await act(async () => {
      await result.current.handleShowInViewer();
    });

    expect(invokeMock).toHaveBeenCalledWith("ensure_viewer_window");
    expect(invokeMock).toHaveBeenCalledWith("apply_viewer_settings", { settings: DEFAULT_SETTINGS });
    expect(emitMock).toHaveBeenCalledWith(VIEWER_EVENTS.OPEN_MEDIA, EMPTY_MEDIA);
    expect(emitMock).not.toHaveBeenCalledWith(VIEWER_EVENTS.ZOOM_SET, expect.anything());
  });

  it("自動表示ONのときビュワーへ送らない", async () => {
    const media = createMedia("pdf");
    const preview = createPreview({
      autoDisplay: true,
      normalizedMedia: media,
      effectivePage: 3
    });

    const { result } = renderHook(() =>
      useManagedMediaActions({
        preview,
        settings: DEFAULT_SETTINGS,
        mediaPath: "",
        managedMedia: [],
        onManagedMediaChange: vi.fn(),
        onCurrentMediaDeleted: vi.fn()
      })
    );

    await act(async () => {
      await result.current.handleShowInViewer();
    });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("PDFのときページ番号も送る", async () => {
    const media = createMedia("pdf");
    const preview = createPreview({
      normalizedMedia: media,
      effectivePage: 4
    });

    const { result } = renderHook(() =>
      useManagedMediaActions({
        preview,
        settings: DEFAULT_SETTINGS,
        mediaPath: "",
        managedMedia: [],
        onManagedMediaChange: vi.fn(),
        onCurrentMediaDeleted: vi.fn()
      })
    );

    await act(async () => {
      await result.current.handleShowInViewer();
    });

    expect(emitMock).toHaveBeenCalledWith(VIEWER_EVENTS.PAGE_SET, 4);
  });

  it("自動表示ONでファイルを開くとViewerを再生成して表示する", async () => {
    const media = createMedia("image");
    const preview = createPreview({
      autoDisplay: true,
      normalizedMedia: media
    });
    const item = { name: "photo.png", path: media.path };

    const { result } = renderHook(() =>
      useManagedMediaActions({
        preview,
        settings: DEFAULT_SETTINGS,
        mediaPath: "",
        managedMedia: [item],
        onManagedMediaChange: vi.fn(),
        onCurrentMediaDeleted: vi.fn()
      })
    );

    await act(async () => {
      await result.current.openManagedItem(item);
    });

    expect(invokeMock).toHaveBeenCalledWith("ensure_viewer_window");
    expect(invokeMock).toHaveBeenCalledWith("apply_viewer_settings", { settings: DEFAULT_SETTINGS });
    expect(emitMock).toHaveBeenCalledWith(
      VIEWER_EVENTS.OPEN_MEDIA,
      expect.objectContaining({ path: media.path, mediaType: "image" })
    );
    expect(preview.setPreviewMedia).toHaveBeenCalledWith(expect.objectContaining({ path: media.path }));
    expect(preview.setPreviewPage).toHaveBeenCalledWith(1);
    expect(preview.setPreviewZoom).toHaveBeenCalledWith(1);
    expect(preview.setPreviewRotation).toHaveBeenCalledWith(0);
  });

  it("syncPreviewToViewer は自動表示状態に関係なく現在プレビューを送信する", async () => {
    const media = createMedia("pdf");
    const preview = createPreview({
      autoDisplay: false,
      normalizedMedia: media,
      effectivePage: 2
    });

    const { result } = renderHook(() =>
      useManagedMediaActions({
        preview,
        settings: DEFAULT_SETTINGS,
        mediaPath: "",
        managedMedia: [],
        onManagedMediaChange: vi.fn(),
        onCurrentMediaDeleted: vi.fn()
      })
    );

    await act(async () => {
      await result.current.syncPreviewToViewer();
    });

    expect(invokeMock).toHaveBeenCalledWith("ensure_viewer_window");
    expect(emitMock).toHaveBeenCalledWith(VIEWER_EVENTS.OPEN_MEDIA, expect.objectContaining({ path: media.path }));
    expect(emitMock).toHaveBeenCalledWith(VIEWER_EVENTS.PAGE_SET, 2);
  });

  it("syncPreviewToViewer は同一メディア表示中なら OPEN_MEDIA を再送しない", async () => {
    const media = createMedia("pdf");
    const preview = createPreview({
      autoDisplay: false,
      normalizedMedia: media,
      effectivePage: 3
    });

    const { result } = renderHook(() =>
      useManagedMediaActions({
        preview,
        settings: DEFAULT_SETTINGS,
        mediaPath: media.path,
        managedMedia: [],
        onManagedMediaChange: vi.fn(),
        onCurrentMediaDeleted: vi.fn()
      })
    );

    await act(async () => {
      await result.current.syncPreviewToViewer();
    });

    expect(emitMock).not.toHaveBeenCalledWith(
      VIEWER_EVENTS.OPEN_MEDIA,
      expect.objectContaining({ path: media.path })
    );
    expect(emitMock).toHaveBeenCalledWith(VIEWER_EVENTS.PAGE_SET, 3);
    expect(emitMock).toHaveBeenCalledWith(VIEWER_EVENTS.ZOOM_SET, 1.5);
    expect(emitMock).toHaveBeenCalledWith(VIEWER_EVENTS.ROTATION_SET, 90);
  });

  it("取り込みキャンセル時は一覧更新も表示もしない", async () => {
    const onManagedMediaChange = vi.fn();
    const preview = createPreview();
    invokeMock.mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useManagedMediaActions({
        preview,
        settings: DEFAULT_SETTINGS,
        mediaPath: "",
        managedMedia: [],
        onManagedMediaChange,
        onCurrentMediaDeleted: vi.fn()
      })
    );

    await act(async () => {
      await result.current.openFile();
    });

    expect(invokeMock).toHaveBeenCalledWith("pick_and_import_media");
    expect(onManagedMediaChange).not.toHaveBeenCalled();
    expect(preview.setPreviewMedia).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("取り込み成功時は取り込んだファイルを開く", async () => {
    const onManagedMediaChange = vi.fn();
    const preview = createPreview({ autoDisplay: true });
    const imported = { name: "apple.png", path: "C:/media/apple.png" };
    const items = [
      { name: "zebra.png", path: "C:/media/zebra.png" },
      imported
    ];
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "pick_and_import_media") {
        return { items, imported };
      }
      return null;
    });

    const { result } = renderHook(() =>
      useManagedMediaActions({
        preview,
        settings: DEFAULT_SETTINGS,
        mediaPath: "",
        managedMedia: [],
        onManagedMediaChange,
        onCurrentMediaDeleted: vi.fn()
      })
    );

    await act(async () => {
      await result.current.openFile();
    });

    expect(onManagedMediaChange).toHaveBeenCalledWith(items);
    expect(preview.setPreviewMedia).toHaveBeenCalledWith(
      expect.objectContaining({ path: imported.path, mediaType: "image" })
    );
    expect(preview.setPreviewZoom).toHaveBeenCalledWith(1);
    expect(preview.setPreviewRotation).toHaveBeenCalledWith(0);
    expect(emitMock).toHaveBeenCalledWith(
      VIEWER_EVENTS.OPEN_MEDIA,
      expect.objectContaining({ path: imported.path })
    );
  });

  it("選択解除はプレビュー選択を基準にし、ビュワーと一致するときだけクリアする", async () => {
    const media = createMedia("image");
    const onCurrentMediaDeleted = vi.fn();
    const preview = createPreview({
      autoDisplay: false,
      normalizedMedia: media,
      resetPreview: vi.fn()
    });

    const { result } = renderHook(() =>
      useManagedMediaActions({
        preview,
        settings: DEFAULT_SETTINGS,
        mediaPath: "",
        managedMedia: [{ name: "photo.png", path: media.path }],
        onManagedMediaChange: vi.fn(),
        onCurrentMediaDeleted
      })
    );

    await act(async () => {
      await result.current.clearSelection();
    });

    expect(preview.resetPreview).toHaveBeenCalled();
    expect(onCurrentMediaDeleted).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });
});
