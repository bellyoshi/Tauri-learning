import type { CSSProperties } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ViewerSettings } from "../types";

export function buildViewerBackgroundStyle(settings: ViewerSettings): CSSProperties {
  return {
    backgroundColor: settings.backgroundColor,
    backgroundImage: settings.backgroundImagePath
      ? `url("${convertFileSrc(settings.backgroundImagePath)}")`
      : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat"
  };
}
