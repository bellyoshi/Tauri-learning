import { VideoState } from "../../types";
import { PanelSection } from "./PanelSection";

interface Props {
  videoState: VideoState;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (value: number) => void;
  onVolume: (value: number) => void;
}

export function VideoControls({ videoState, onPlay, onPause, onSeek, onVolume }: Props) {
  return (
    <PanelSection title="動画再生">
      <div className="row">
        <button onClick={onPlay}>再生</button>
        <button onClick={onPause}>停止</button>
      </div>
      <div className="row">
        <label>シーク</label>
        <input
          type="range"
          min={0}
          max={Math.max(videoState.duration, 0)}
          value={Math.min(videoState.currentTime, videoState.duration || 0)}
          step={0.1}
          onChange={(e) => onSeek(Number(e.currentTarget.value))}
        />
      </div>
      <div className="row">
        <label>音量</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={videoState.volume}
          onChange={(e) => onVolume(Number(e.currentTarget.value))}
        />
      </div>
    </PanelSection>
  );
}
