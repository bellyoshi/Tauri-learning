import { afterEach, describe, expect, it } from "vitest";
import { getVideoResumeSeconds, setVideoResumeSeconds } from "./videoResumeState";

const STORAGE_KEY = "video-resume-seconds";

describe("videoResumeState", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("空の path では 0 を返す", () => {
    expect(getVideoResumeSeconds("")).toBe(0);
  });

  it("保存した再生位置を取得できる", () => {
    const path = "C:\\media\\clip.mp4";
    setVideoResumeSeconds(path, 42.5);
    expect(getVideoResumeSeconds(path)).toBe(42.5);
  });

  it("ファイルごとに別の再生位置を保持する", () => {
    setVideoResumeSeconds("a.mp4", 10);
    setVideoResumeSeconds("b.mp4", 20);
    expect(getVideoResumeSeconds("a.mp4")).toBe(10);
    expect(getVideoResumeSeconds("b.mp4")).toBe(20);
  });

  it("不正な秒数は保存しない", () => {
    const path = "clip.mp4";
    setVideoResumeSeconds(path, -1);
    setVideoResumeSeconds(path, Number.NaN);
    expect(getVideoResumeSeconds(path)).toBe(0);
  });

  it("秒数は小数第1位まで丸める", () => {
    const path = "clip.mp4";
    setVideoResumeSeconds(path, 12.34);
    expect(getVideoResumeSeconds(path)).toBe(12.3);
  });

  it("破損した localStorage は無視して 0 を返す", () => {
    localStorage.setItem(STORAGE_KEY, "{invalid");
    expect(getVideoResumeSeconds("clip.mp4")).toBe(0);
  });
});
