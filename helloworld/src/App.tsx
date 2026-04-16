import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ControlPanel } from "./components/ControlPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ViewerPanel } from "./components/ViewerPanel";
import { EMPTY_MEDIA, normalizeMediaPayload } from "./state/mediaState";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./state/settingsState";
import { ManagedMediaItem, MediaPayload, MonitorInfo, VideoState, ViewerSettings } from "./types";

export default function App() {
  const label = useMemo(() => getCurrentWebviewWindow().label, []);
  const [media, setMedia] = useState(EMPTY_MEDIA);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(1);
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

  useEffect(() => {
    const unlisten: Promise<(() => void)[]> = Promise.all([
      listen<MediaPayload>("viewer:open-media", (event) => {
        setMedia(normalizeMediaPayload(event.payload));
        setCurrentPage(1);
      }),
      listen("viewer:page-next", () => setCurrentPage((prev) => Math.min(prev + 1, totalPages))),
      listen("viewer:page-prev", () => setCurrentPage((prev) => Math.max(prev - 1, 1))),
      listen("viewer:zoom-in", () => setZoom((prev) => Math.min(prev + 0.1, 3))),
      listen("viewer:zoom-out", () => setZoom((prev) => Math.max(prev - 0.1, 0.2))),
      listen("viewer:zoom-reset", () => setZoom(1)),
      listen<number>("viewer:video-seek", (event) => {
        const video = document.querySelector("video");
        if (video) video.currentTime = event.payload;
      }),
      listen<number>("viewer:video-volume", (event) => {
        const video = document.querySelector("video");
        if (video) video.volume = event.payload;
      }),
      listen("viewer:video-play", () => {
        const video = document.querySelector("video");
        if (video) void video.play();
      }),
      listen("viewer:video-pause", () => {
        const video = document.querySelector("video");
        if (video) video.pause();
      }),
      listen<Partial<ViewerSettings>>("viewer:settings-updated", (event) =>
        setSettings((prev) => ({ ...prev, ...event.payload }))
      )
    ]);

    return () => {
      void unlisten.then((fns) => fns.forEach((fn) => fn()));
    };
  }, [totalPages]);

  if (label === "viewer") {
    return (
      <ViewerPanel
        media={media}
        currentPage={Math.min(currentPage, totalPages)}
        zoom={zoom}
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
      currentPage={Math.min(currentPage, totalPages)}
      totalPages={totalPages}
      zoom={zoom}
      mediaPath={media.path}
      managedMedia={managedMedia}
      monitors={monitors}
      settings={settings}
      videoState={videoState}
      onSettingsOpen={() => invoke("open_settings_window")}
      onManagedMediaChange={setManagedMedia}
    />
  );
}
