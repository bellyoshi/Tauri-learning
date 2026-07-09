import { PanelSection } from "./PanelSection";

interface Props {
  page: number;
  totalPages: number;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
}

export function PageControls({ page, totalPages, onFirst, onPrev, onNext, onLast }: Props) {
  return (
    <PanelSection title="ページ移動">
      <div className="row">
        <button onClick={onFirst}>先頭</button>
        <button onClick={onPrev}>前ページ</button>
        <button onClick={onNext}>次ページ</button>
        <button onClick={onLast}>最後</button>
      </div>
      <p className="hint">
        {page} / {totalPages}
      </p>
    </PanelSection>
  );
}
