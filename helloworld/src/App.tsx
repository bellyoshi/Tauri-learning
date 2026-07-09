import { useEffect, useMemo, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ControlPanel } from "./components/ControlPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ViewerPanel } from "./components/ViewerPanel";
import { VIEWER_EVENTS } from "./events/viewerEvents";
import { EMPTY_MEDIA, normalizeMediaPayload } from "./state/mediaState";
import { loadSettings, saveSettings } from "./state/settingsState";
import { useViewerEventBridge } from "./hooks/useViewerEventBridge";
import { ManagedMediaItem, MonitorInfo, VideoState, ViewerSettings } from "./types";

export default function App() {
  const label = useMemo(() => getCurrentWebviewWindow().label, []);
  const [media, setMedia] = useState(EMPTY_MEDIA);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [settings, setSettings] = useState<ViewerSettings>(loadSettings());
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [managedMedia, setManagedMedia] = useState<ManagedMediaItem[]>([]);
  const [videoState, setVideoState] = useState<VideoState>({
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 1
  });

  useEffect(() => {
    void invoke<MonitorInfo[]>("list_monitors").then(setMonitors);
    void invoke("apply_viewer_settings", { settings: loadSettings() });
    void invoke<ManagedMediaItem[]>("list_managed_media").then(setManagedMedia);
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useViewerEventBridge(totalPages, {
    setMedia: (payload) => setMedia(normalizeMediaPayload(payload)),
    setCurrentPage,
    setTotalPages,
    setZoom,
    setRotation,
    setSettings
  });

  const resetCurrentMedia = () => {
    setMedia(EMPTY_MEDIA);
    setCurrentPage(1);
    setTotalPages(1);
    setZoom(1);
    setRotation(0);
  };

  if (label === "viewer") {
    return (
      <ViewerPanel
        media={media}
        currentPage={currentPage}
        zoom={zoom}
        rotation={rotation}
        settings={settings}
        onPdfMeta={(pages) => setTotalPages(Math.max(1, pages))}
        onVideoStateChange={setVideoState}
      />
    );
  }

  if (label === "settings") {
    return (
      <SettingsPanel
        settings={settings}
        monitors={monitors}
        onChange={(next) => {
          setSettings(next);
        }}
      />
    );
  }

  return (
    <ControlPanel
      media={media}
      currentPage={currentPage}
      totalPages={totalPages}
      zoom={zoom}
      rotation={rotation}
      mediaPath={media.path}
      managedMedia={managedMedia}
      monitors={monitors}
      settings={settings}
      videoState={videoState}
      onSettingsOpen={() => invoke("open_settings_window")}
      onManagedMediaChange={setManagedMedia}
      onCurrentMediaDeleted={resetCurrentMedia}
      onPdfMeta={(pages) => setTotalPages(Math.max(1, pages))}
    />
  );
}
