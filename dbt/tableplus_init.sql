-- TablePlus初期設定スクリプト
-- このファイルをTablePlusで実行してS3アクセスを有効化します

-- ========================================
-- 1. 拡張機能の自動管理を有効化
-- ========================================
SET autoinstall_known_extensions=1;
SET autoload_known_extensions=1;

-- ========================================
-- 2. 必要な拡張機能のインストールと読み込み
-- ========================================
-- httpfs: S3/HTTPアクセス用
INSTALL httpfs;
LOAD httpfs;

-- parquet: Parquetファイル読み込み用（通常は組み込み済み）
-- INSTALL parquet;
-- LOAD parquet;

-- ========================================
-- 3. AWS S3設定
-- ========================================
-- リージョン設定
SET s3_region='ap-northeast-1';

-- 認証情報の設定
-- 方法1: 環境変数から取得（推奨）
-- TablePlusが環境変数にアクセスできる場合は以下をコメントアウト解除
-- SET s3_access_key_id=(SELECT current_setting('AWS_ACCESS_KEY_ID'));
-- SET s3_secret_access_key=(SELECT current_setting('AWS_SECRET_ACCESS_KEY'));

-- 方法2: 直接設定（セキュリティ注意）
-- 以下に実際の認証情報を設定してください
-- SET s3_access_key_id='YOUR_AWS_ACCESS_KEY_ID';
-- SET s3_secret_access_key='YOUR_AWS_SECRET_ACCESS_KEY';

-- 方法3: AWS CLIプロファイルを使用
-- ~/.aws/credentials が利用可能な場合は自動的に使用されます

-- ========================================
-- 4. パフォーマンス設定（オプション）
-- ========================================
SET memory_limit='2GB';
SET threads=4;

-- ========================================
-- 5. 動作確認
-- ========================================
-- 拡張機能の確認
SELECT extension_name, loaded, installed
FROM duckdb_extensions()
WHERE extension_name IN ('httpfs', 'parquet');

-- 設定値の確認
SELECT
    'autoinstall_known_extensions' as setting,
    current_setting('autoinstall_known_extensions') as value
UNION ALL
SELECT
    'autoload_known_extensions',
    current_setting('autoload_known_extensions')
UNION ALL
SELECT
    's3_region',
    current_setting('s3_region');

-- ========================================
-- 使用例: S3ファイルの読み込みテスト
-- ========================================
-- 以下のクエリでS3アクセスをテストできます：
-- SELECT * FROM read_json_auto('s3://moderation-craft-data-800860245583/raw/fitbit/year=2025/month=08/day=05/activity_20250805.json') LIMIT 1;