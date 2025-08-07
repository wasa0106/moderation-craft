# Phase 3 分析基盤テストガイド

## 概要
このガイドでは、Phase 3で実装した分析基盤（dbt + DuckDB WASM）の動作確認方法を説明します。

## 前提条件

### 必要な環境
- Node.js 18以上
- Python 3.8以上
- AWS認証情報（S3アクセス用）

### AWS認証情報の設定
```bash
export AWS_ACCESS_KEY_ID=your_access_key_id
export AWS_SECRET_ACCESS_KEY=your_secret_access_key
```

## テスト方法

### 1. Webアプリケーションでの確認

#### 分析デバッグページ
開発サーバーを起動して、ブラウザで確認します：

```bash
npm run dev
```

ブラウザで以下にアクセス：
- http://localhost:3000/debug/analytics

このページでは以下が確認できます：
- DuckDB WASM接続状態
- S3アクセステスト
- サンプルクエリ実行
- カスタムSQLクエリ実行

#### 動作確認ポイント
1. **接続テスト** - 「接続テスト実行」ボタンをクリック
   - ✅ connection: 基本的な接続
   - ✅ s3Access: S3バケットへのアクセス
   - ✅ dataMarts: データマートの読み込み

2. **サンプルクエリ** - 「サンプルクエリ実行」ボタンをクリック
   - 生産性データの取得
   - 健康相関データの取得
   - パフォーマンスサマリーの取得

3. **カスタムクエリ** - SQLを直接入力して実行
   ```sql
   -- DuckDBバージョン確認
   SELECT version();
   
   -- S3ファイル一覧
   SELECT * FROM glob('s3://moderation-craft-data-800860245583/raw/**/*.parquet') LIMIT 5;
   ```

### 2. dbtモデルのテスト

#### テストスクリプトの実行
```bash
# 実行権限を付与（初回のみ）
chmod +x scripts/test-dbt.sh

# 接続テストのみ
./scripts/test-dbt.sh debug

# モデル実行
./scripts/test-dbt.sh run

# データ品質テスト
./scripts/test-dbt.sh test

# すべて実行
./scripts/test-dbt.sh all
```

#### 手動でのdbt実行
```bash
cd dbt-moderation-craft/moderation_craft

# dbt-duckdbインストール
pip install dbt-duckdb==1.7.0

# 接続テスト
dbt debug --profiles-dir="../"

# モデル実行
dbt run --profiles-dir="../"

# テスト実行
dbt test --profiles-dir="../"

# ドキュメント生成と表示
dbt docs generate --profiles-dir="../"
dbt docs serve --profiles-dir="../"
```

### 3. データ品質の確認

#### 実装済みテスト
1. **データ完全性** (`test_data_completeness.sql`)
   - 過去7日間のデータ欠損をチェック

2. **異常値検出** (`test_productivity_anomalies.sql`)
   - 生産性スコアの異常値を検出

3. **相関一貫性** (`test_correlation_consistency.sql`)
   - 相関パターンの論理的一貫性を検証

## トラブルシューティング

### よくある問題と解決方法

#### 1. DuckDB WASM初期化エラー
**症状**: ブラウザコンソールに「SharedArrayBuffer is not defined」エラー

**解決方法**:
```javascript
// next.config.tsに以下を追加
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Cross-Origin-Embedder-Policy',
          value: 'require-corp',
        },
        {
          key: 'Cross-Origin-Opener-Policy',
          value: 'same-origin',
        },
      ],
    },
  ];
}
```

#### 2. S3アクセスエラー
**症状**: 「Access Denied」エラー

**解決方法**:
1. AWS認証情報を確認
2. S3バケットポリシーを確認
3. 環境変数を再設定：
   ```bash
   export AWS_ACCESS_KEY_ID=xxx
   export AWS_SECRET_ACCESS_KEY=yyy
   ```

#### 3. dbtモデル実行エラー
**症状**: 「Table not found」エラー

**解決方法**:
1. 依存関係の順序を確認（staging → intermediate → marts）
2. S3ファイルパスを確認
3. モデルを個別に実行：
   ```bash
   dbt run --models staging.stg_fitbit_sleep_json --profiles-dir="../"
   ```

## パフォーマンス確認

### クエリ実行時間の目安
- 単純な集計: < 100ms
- 7日間の時系列分析: < 200ms  
- 30日間の相関分析: < 500ms
- 複雑なウィンドウ関数: < 1000ms

### メモリ使用量
- DuckDB WASM初期化: ~50MB
- データマートロード: ~20MB/マート
- クエリ実行時: +10-50MB（データ量による）

## 実装確認チェックリスト

### Phase 3完了基準
- [ ] dbtプロジェクト構造が正しく作成されている
- [ ] profiles.ymlでDuckDB接続が設定されている
- [ ] すべてのマクロが作成されている
- [ ] ステージング層モデルが実行可能
- [ ] 中間層モデルが実行可能
- [ ] マート層モデルが実行可能
- [ ] データ品質テストが成功する
- [ ] DuckDB WASMがブラウザで初期化される
- [ ] S3データに正常にアクセスできる
- [ ] useDuckDBフックが動作する

## 次のステップ

Phase 4に進む前に：
1. すべてのテストが成功することを確認
2. パフォーマンスが要件を満たすことを確認
3. エラーハンドリングが適切に実装されていることを確認

## 参考リンク
- [dbt-duckdb Documentation](https://github.com/duckdb/dbt-duckdb)
- [DuckDB WASM Documentation](https://duckdb.org/docs/api/wasm/overview)
- [Project Phase 3 Specification](./phase-3-analytics-foundation.md)