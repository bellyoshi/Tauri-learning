import { PanelSection } from "./PanelSection";

interface Props {
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomReset: () => void;
  onFitWidth: () => void;
  onFitWhole: () => void;
}

export function ZoomControls({ zoom, onZoomOut, onZoomIn, onZoomReset, onFitWidth, onFitWhole }: Props) {
  return (
    <PanelSection title="拡大縮小">
      <div className="row wrap">
        <button onClick={onZoomOut}>-</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={onZoomIn}>+</button>
        <button onClick={onZoomReset}>100%</button>
        <button onClick={onFitWidth}>ウインドウ幅</button>
        <button onClick={onFitWhole}>全体を表示</button>
      </div>
    </PanelSection>
  );
}
