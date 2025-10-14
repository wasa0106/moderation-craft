# コミュニケーション方法
わかりやすい日本語で回答してください。

# Repository Guidelines

## プロジェクト構造とモジュール配置
- プロダクトコードは `src/` に集約。ルートは `src/app`、共有 UI は `src/components/ui`、機能別コンポーネントは `src/components/{feature}` に配置します。
- ドメインロジックや AWS・同期関連のアダプタは `src/lib`、Zustand ストアは `src/stores/{feature}`、カスタムフックは `src/hooks` に置きます。
- 共通型は `src/types`、テスト支援は `src/test-utils`。静的アセットは `public/`、自動化スクリプトは `scripts/`、長文ドキュメントは `docs/` へ。

## ビルド・開発・テストコマンド
- `npm run dev` : Next.js 15 + Turbopack の開発サーバー (http://localhost:3000)。
- `npm run build` / `npm start` : 本番用ビルドとサーバー起動。
- `npm run lint`・`npm run type-check`・`npm run format:check` : ESLint / TypeScript / Prettier のゲートを実行。
- `npm test`・`npm run test:coverage` : Vitest 実行と HTML/LCOV レポート生成 (`coverage/` 出力)。
- `npm run storybook` : Storybook を http://localhost:6006 で起動。
- `npm run db:start`・`npm run db:init` : Docker でローカル DynamoDB を起動し初期化。

## コーディングスタイルと命名規約
- TypeScript 必須。Prettier 既定 (2 スペース、シングルクォート) を踏襲し、ESLint 警告は解消します。
- React コンポーネントは `PascalCase`、変数・関数は `camelCase`、ファイルとディレクトリは `kebab-case` (`progress-chart.tsx`)。
- フックは `use` 接頭辞、Zustand ストアは機能別ディレクトリに併置し、ファイルは原則 1 コンポーネントをデフォルトエクスポート。

## テスト指針
- テストは実装近傍に配置 (`*.test.ts` または `__tests__/`)。Vitest + JSDOM + MSW 設定は `vitest.setup.ts`。
- カバレッジ基準 80/80/75/80 を維持。リポジトリ層・フック・複雑な UI 状態には集中的なケースを追加します。
- 命名は `task-sync.repository.test.ts` のように役割を明示し、非同期検証は `await screen.findByText` で安定化。

## コミットとプルリクエスト
- Git 履歴にならい `scope: action` 形式 (`kanban: allow-bulk-drop`) を短く (< ~60 文字) 保ち、必要なら課題番号を付記。
- PR では変更概要、検証手順 (`npm run lint` / `npm test` / `npm run build`) を列挙し、UI 変更はダーク/ライト両テーマのスクリーンショットを添付。
- マイグレーションやシードが必要な場合は必ず明記します。

## 環境設定と統合
- `.env.example` を複製して `.env.local` を作成し、Fitbit/AWS 資格情報を投入。DuckDB WASM が欠損したら `npm install` で `scripts/copy-duckdb-wasm.sh` を再実行。
- `/debug/*` の OAuth ツールはダミーデータで使用し、実トークンは `fitbit-tokens.json` に残さず、ローカル検証は `lambda-fitbit/` のヘルパーを活用。
