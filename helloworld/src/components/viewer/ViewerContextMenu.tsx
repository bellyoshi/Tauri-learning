interface Props {
  position: { x: number; y: number };
  onToggleTitlebar: () => void;
  onToggleViewerMode: () => void;
  onCloseViewer: () => void;
}

export function ViewerContextMenu({ position, onToggleTitlebar, onToggleViewerMode, onCloseViewer }: Props) {
  return (
    <div
      className="context-menu"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button type="button" onClick={onToggleTitlebar}>
        タイトルバー表示/非表示
      </button>
      <button type="button" onClick={onToggleViewerMode}>
        フルスクリーン/ウインドウ切替
      </button>
      <button type="button" onClick={onCloseViewer}>
        ウインドウを閉じる
      </button>
    </div>
  );
}
