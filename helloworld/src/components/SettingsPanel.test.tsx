import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "./SettingsPanel";
import { DEFAULT_SETTINGS } from "../state/settingsState";

const invokeMock = vi.fn();
const openMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  convertFileSrc: (path: string) => `asset://localhost/${path}`
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args)
}));

function renderSettingsPanel(overrides: Partial<React.ComponentProps<typeof SettingsPanel>> = {}) {
  const onChange = vi.fn();
  const props: React.ComponentProps<typeof SettingsPanel> = {
    settings: DEFAULT_SETTINGS,
    monitors: [
      { index: 0, name: "Monitor 1" },
      { index: 1, name: "Monitor 2" }
    ],
    onChange,
    ...overrides
  };

  const view = render(<SettingsPanel {...props} />);
  return { ...view, onChange, props };
}

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockResolvedValue(undefined);
    openMock.mockResolvedValue(null);
  });

  it("背景色変更で onChange と apply_viewer_settings を呼ぶ", async () => {
    const { onChange } = renderSettingsPanel();

    fireEvent.change(screen.getByDisplayValue("#101820"), { target: { value: "#ff0000" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        ...DEFAULT_SETTINGS,
        backgroundColor: "#ff0000"
      });
      expect(invokeMock).toHaveBeenCalledWith("apply_viewer_settings", {
        settings: { ...DEFAULT_SETTINGS, backgroundColor: "#ff0000" }
      });
    });
  });

  it("モニター選択で monitorIndex を更新する", async () => {
    const { onChange } = renderSettingsPanel();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        ...DEFAULT_SETTINGS,
        monitorIndex: 1
      });
    });
  });

  it("表示モードボタンで viewerMode を更新する", async () => {
    const { onChange } = renderSettingsPanel();

    fireEvent.click(screen.getByRole("button", { name: "フルスクリーン" }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        ...DEFAULT_SETTINGS,
        viewerMode: "fullscreen"
      });
    });
  });

  it("背景画像クリアで backgroundImagePath を空にする", async () => {
    const settings = { ...DEFAULT_SETTINGS, backgroundImagePath: "C:\\bg.png" };
    const { onChange } = renderSettingsPanel({ settings });

    fireEvent.click(screen.getByRole("button", { name: "クリア" }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        ...settings,
        backgroundImagePath: ""
      });
    });
  });

  it("画像選択ダイアログで選んだパスを反映する", async () => {
    openMock.mockResolvedValue("C:\\images\\wallpaper.png");
    const { onChange } = renderSettingsPanel();

    fireEvent.click(screen.getByRole("button", { name: "画像を選択" }));

    await waitFor(() => {
      expect(openMock).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith({
        ...DEFAULT_SETTINGS,
        backgroundImagePath: "C:\\images\\wallpaper.png"
      });
    });
  });

  it("背景画像があるときプレビューを表示する", () => {
    renderSettingsPanel({
      settings: { ...DEFAULT_SETTINGS, backgroundImagePath: "C:\\bg.png" }
    });

    expect(screen.getByLabelText("背景プレビュー")).toHaveStyle({
      backgroundImage: 'url("asset://localhost/C:\\bg.png")'
    });
  });

  it("背景画像がないときは背景色をプレビュー表示する", () => {
    renderSettingsPanel({
      settings: { ...DEFAULT_SETTINGS, backgroundColor: "#ff0000" }
    });

    expect(screen.getByLabelText("背景プレビュー")).toHaveStyle({
      backgroundColor: "rgb(255, 0, 0)"
    });
  });
});
