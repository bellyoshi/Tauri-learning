import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { MonitorInfo, ViewerSettings } from "../types";

interface Props {
  settings: ViewerSettings;
  monitors: MonitorInfo[];
  onChange: (next: ViewerSettings) => void;
}

export function SettingsPanel({ settings, monitors, onChange }: Props) {
  const chooseBackground = async () => {
    const imagePath = await open({
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] }]
    });
    if (!imagePath || Array.isArray(imagePath)) return;
    onChange({ ...settings, backgroundImagePath: imagePath });
    await invoke("apply_viewer_settings", { settings: { ...settings, backgroundImagePath: imagePath } });
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
          onChange={async (e) => {
            const next = { ...settings, backgroundColor: e.currentTarget.value };
            onChange(next);
            await invoke("apply_viewer_settings", { settings: next });
          }}
        />
      </section>

      <section className="block">
        <label>背景画像</label>
        <div className="row">
          <button onClick={chooseBackground}>画像を選択</button>
          <button
            onClick={async () => {
              const next = { ...settings, backgroundImagePath: "" };
              onChange(next);
              await invoke("apply_viewer_settings", { settings: next });
            }}
          >
            クリア
          </button>
        </div>
        {settings.backgroundImagePath && (
          <img className="thumb" src={convertFileSrc(settings.backgroundImagePath)} alt="background preview" />
        )}
      </section>

      <section className="block">
        <label>Viewer配置モニター</label>
        <select
          value={settings.monitorIndex}
          onChange={async (e) => {
            const next = { ...settings, monitorIndex: Number(e.currentTarget.value) };
            onChange(next);
            await invoke("apply_viewer_settings", { settings: next });
          }}
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
          <button
            onClick={async () => {
              const next = { ...settings, viewerMode: "windowed" as const };
              onChange(next);
              await invoke("apply_viewer_settings", { settings: next });
            }}
          >
            ウインドウ
          </button>
          <button
            onClick={async () => {
              const next = { ...settings, viewerMode: "fullscreen" as const };
              onChange(next);
              await invoke("apply_viewer_settings", { settings: next });
            }}
          >
            フルスクリーン
          </button>
        </div>
      </section>
    </div>
  );
}
