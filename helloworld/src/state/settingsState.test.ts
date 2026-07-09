import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settingsState";
import { ViewerSettings } from "../types";

const STORAGE_KEY = "viewer-settings";

describe("settingsState", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("未保存時はデフォルト設定を返す", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("保存した設定を読み込める", () => {
    const custom: ViewerSettings = {
      backgroundColor: "#ffffff",
      backgroundImagePath: "C:\\bg.png",
      monitorIndex: 1,
      viewerMode: "fullscreen"
    };
    saveSettings(custom);
    expect(loadSettings()).toEqual(custom);
  });

  it("一部だけ保存されていてもデフォルトで補完する", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ monitorIndex: 2 }));
    expect(loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      monitorIndex: 2
    });
  });

  it("破損した JSON はデフォルト設定を返す", () => {
    localStorage.setItem(STORAGE_KEY, "{broken");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
