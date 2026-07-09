import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { buildViewerBackgroundStyle } from "../lib/viewerBackground";
import { MonitorInfo, ViewerSettings } from "../types";

interface Props {
  settings: ViewerSettings;
  monitors: MonitorInfo[];
  onChange: (next: ViewerSettings) => void;
}

export function SettingsPanel({ settings, monitors, onChange }: Props) {
  const applySettings = async (patch: Partial<ViewerSettings>) => {
    const next = { ...settings, ...patch };
    onChange(next);
    await invoke("apply_viewer_settings", { settings: next });
  };

  const chooseBackground = async () => {
    const imagePath = await open({
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] }]
    });
    if (!imagePath || Array.isArray(imagePath)) return;
    await applySettings({ backgroundImagePath: imagePath });
  };

  return (
    <div className="panel">
      <header className="toolbar">
        <strong>設定</strong>
      </header>
      <section className="block">
        <label>背景色</label>
        <input
          type="color"
          value={settings.backgroundColor}
          onChange={(e) => void applySettings({ backgroundColor: e.currentTarget.value })}
        />
      </section>

      <section className="block">
        <label>背景画像</label>
        <div className="row">
          <button onClick={chooseBackground}>画像を選択</button>
          <button onClick={() => void applySettings({ backgroundImagePath: "" })}>クリア</button>
        </div>
      </section>

      <section className="block">
        <label>背景プレビュー</label>
        <div
          className="background-preview"
          style={buildViewerBackgroundStyle(settings)}
          aria-label="背景プレビュー"
        />
      </section>

      <section className="block">
        <label>Viewer配置モニター</label>
        <select
          value={settings.monitorIndex}
          onChange={(e) => void applySettings({ monitorIndex: Number(e.currentTarget.value) })}
        >
          {monitors.map((monitor) => (
            <option key={monitor.index} value={monitor.index}>
              {monitor.name}
            </option>
          ))}
        </select>
      </section>

      <section className="block">
        <label>表示モード</label>
        <div className="row">
          <button onClick={() => void applySettings({ viewerMode: "windowed" })}>ウインドウ</button>
          <button onClick={() => void applySettings({ viewerMode: "fullscreen" })}>フルスクリーン</button>
        </div>
      </section>
    </div>
  );
}
