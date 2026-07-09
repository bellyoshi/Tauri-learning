export interface HelpSection {
  title: string;
  items: { keys: string; description: string; note?: string }[];
}

export const KEYBOARD_SHORTCUTS_HELP: HelpSection[] = [
  {
    title: "ページ移動（PDF）",
    items: [
      { keys: "← / PageUp", description: "前のページへ" },
      { keys: "→ / PageDown", description: "次のページへ" },
      { keys: "Home", description: "先頭ページへ" },
      { keys: "End", description: "最終ページへ" }
    ]
  },
  {
    title: "ズーム",
    items: [
      { keys: "+ / =", description: "拡大", note: "ファイル選択時" },
      { keys: "- / _", description: "縮小", note: "ファイル選択時" },
      { keys: "0", description: "100% にリセット", note: "ファイル選択時" }
    ]
  },
  {
    title: "回転",
    items: [
      { keys: "R", description: "右に 90° 回転", note: "PDF・画像表示時" }
    ]
  },
  {
    title: "ファイル",
    items: [
      { keys: "Delete", description: "選択中のファイルを削除", note: "ファイル選択時" }
    ]
  }
];

export const HELP_NOTES = [
  "入力欄にフォーカスがあるときはショートカットは無効です。",
  "Ctrl / Alt / Meta と組み合わせたキーは使用しません。"
];
