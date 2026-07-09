import { ManagedMediaItem } from "../../types";

interface Props {
  items: ManagedMediaItem[];
  selectedPath: string;
  onOpen: (item: ManagedMediaItem) => void;
  onDelete: (item: ManagedMediaItem) => void;
}

export function ManagedMediaList({ items, selectedPath, onOpen, onDelete }: Props) {
  if (items.length === 0) {
    return <p className="hint">ファイルがありません</p>;
  }

  return (
    <div className="managed-list">
      {items.map((item) => {
        const isSelected = item.path === selectedPath;
        return (
          <div key={item.path} className={`managed-item-row${isSelected ? " is-selected" : ""}`}>
            <button className="managed-item" onClick={() => onOpen(item)}>
              {item.name}
            </button>
            <button
              type="button"
              className="managed-item-delete"
              aria-label={`${item.name} を削除`}
              onClick={() => onDelete(item)}
            >
              削除
            </button>
          </div>
        );
      })}
    </div>
  );
}
