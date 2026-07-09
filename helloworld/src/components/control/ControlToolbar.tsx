interface Props {
  autoDisplay: boolean;
  isVideoMedia: boolean;
  canShowInViewer: boolean;
  onAutoDisplayChange: (value: boolean) => void;
  onShowInViewer: () => void;
  onOpenHelp: () => void;
}

export function ControlToolbar({
  autoDisplay,
  isVideoMedia,
  canShowInViewer,
  onAutoDisplayChange,
  onShowInViewer,
  onOpenHelp
}: Props) {
  return (
    <header className="toolbar">
      <strong>操作画面</strong>
      <div className="menu-group">
        <label className="row">
          <input
            type="checkbox"
            checked={autoDisplay}
            disabled={isVideoMedia}
            onChange={(event) => onAutoDisplayChange(event.currentTarget.checked)}
          />
          <span>操作中に自動表示</span>
        </label>
        <button type="button" onClick={onShowInViewer} disabled={!canShowInViewer}>
          ビュワーに表示
        </button>
        <button type="button" onClick={onOpenHelp}>
          ヘルプ
        </button>
      </div>
    </header>
  );
}
