# テスト実行ガイド

このプロジェクトでは、フロントエンド（Vitest）と Rust バックエンド（`cargo test`）の2種類のテストを実行できます。

## 前提

- Node.js / npm がインストールされていること
- Rust / Cargo がインストールされていること（Rust テスト実行時）

初回は依存関係をインストールしてください。

```bash
npm install
```

## クイックリファレンス

| 目的 | コマンド |
|---|---|
| フロントエンドテスト（ウォッチ） | `npm test` |
| フロントエンドテスト（1回） | `npm run test:run` |
| Rust テスト | `npm run test:rust` |
| すべてのテスト | `npm run test:all` |

## フロントエンドテスト（Vitest）

### ウォッチモード

ファイル変更を監視しながらテストを実行します。開発中はこちらが便利です。

```bash
npm test
```

### 1回だけ実行

CI やコミット前の確認向けです。

```bash
npm run test:run
```

### 対象ファイル

| ファイル | 内容 |
|---|---|
| `src/state/mediaState.test.ts` | メディア種別判定、URL 正規化 |
| `src/state/videoResumeState.test.ts` | 動画再生位置の保存/復元 |
| `src/state/settingsState.test.ts` | 設定の読み書き |
| `src/lib/viewTransform.test.ts` | ズーム・回転ユーティリティ |
| `src/hooks/usePreviewState.test.ts` | 自動表示 ON/OFF 時のプレビュー状態 |
| `src/lib/pdf/renderPdfPage.test.ts` | PDF ページ描画（ページ番号クランプ等） |
| `src/lib/pdf/getMediaBaseSize.test.ts` | メディア種別ごとの基準サイズ取得 |
| `src/components/ControlPanel.test.tsx` | 操作画面の表示条件・ボタン状態 |
| `src/components/SettingsPanel.test.tsx` | 設定画面の変更・invoke 呼び出し |

### 設定ファイル

- `vite.config.ts` … Vitest 設定
- `src/test/setup.ts` … 共通セットアップ（`jest-dom`、DOM クリーンアップ）

## Rust テスト（cargo test）

ファイル取り込みまわりのロジックを検証します。

```bash
npm run test:rust
```

または `src-tauri` ディレクトリで直接実行します。

```bash
cd src-tauri
cargo test
```

### 対象

`src-tauri/src/media.rs` 内のテストモジュール:

- `unique_destination_path` … 同名ファイル回避の連番付与
- `collect_managed_media` … ファイル一覧のソート

## すべてのテストをまとめて実行

```bash
npm run test:all
```

フロントエンド（Vitest）→ Rust（cargo test）の順で実行します。

## 特定のテストだけ実行する

### Vitest

ファイル指定:

```bash
npx vitest run src/state/mediaState.test.ts
```

テスト名で絞り込み:

```bash
npx vitest run -t "PDF拡張子を判定する"
```

### cargo test

テスト名で絞り込み:

```bash
cargo test --manifest-path src-tauri/Cargo.toml unique_destination_path
```

## 補足

- フロントエンドテストは Tauri アプリを起動せずに実行できます。
- `@tauri-apps/api` はテスト内でモックしています。
- E2E テスト（実際のウィンドウ操作）は現時点では未導入です。
