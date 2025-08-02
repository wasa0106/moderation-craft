# 環境設定ガイド

## 環境変数の設定

### 開発環境
1. `.env.example`を`.env.local`にコピー
2. 必要な値を設定（特にAWS認証情報）
3. `NEXT_PUBLIC_SYNC_ENABLED=false`で同期を無効化（開発時推奨）

### 本番環境
1. デプロイプラットフォーム（Vercel等）で環境変数を設定
2. `.env.production`の内容を参考に設定
3. AWS認証情報は必ずプラットフォームの環境変数として設定（ファイルに含めない）

## 環境による表示の違い

### 開発環境のみの表示
- デバッグ情報（WBSパネル、カレンダー等）
- React Query DevTools
- 詳細なコンソールログ

### CSS最適化
- 本番環境では不要なコンソールログが自動削除
- CSS/JSの圧縮とキャッシュ最適化
- 画像フォーマットの最適化（AVIF/WebP）

## ビルドと確認

### 開発環境
```bash
npm run dev
```

### 本番ビルド（ローカル確認）
```bash
npm run build
npm run start
```

### 本番環境の表示を開発環境で確認
```bash
NODE_ENV=production npm run build
NODE_ENV=production npm run start
```

## トラブルシューティング

### 表示が異なる場合
1. 環境変数が正しく設定されているか確認
2. ビルドキャッシュをクリア: `rm -rf .next`
3. 依存関係を再インストール: `rm -rf node_modules && npm install`

### 同期エラーが発生する場合
1. `.env.local`で`NEXT_PUBLIC_SYNC_ENABLED=false`を設定
2. AWS認証情報が正しいか確認
3. DynamoDBテーブル名が環境に合っているか確認