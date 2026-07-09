import { PanelSection } from "./PanelSection";

interface Props {
  onRotateRight90: () => void;
  onRotate180: () => void;
  onRotate270: () => void;
  onReset: () => void;
}

export function RotationControls({ onRotateRight90, onRotate180, onRotate270, onReset }: Props) {
  return (
    <PanelSection title="回転">
      <div className="row wrap">
        <button onClick={onRotateRight90}>右へ90度</button>
        <button onClick={onRotate180}>180度</button>
        <button onClick={onRotate270}>270度</button>
        <button onClick={onReset}>元の位置</button>
      </div>
    </PanelSection>
  );
}
