# TablePlusでDuckDBを使用する際の設定ガイド

## 問題
TablePlusで直接DuckDBファイルを開くと、S3ファイルアクセス時に以下のエラーが発生します：
```
Missing Extension Error: File s3://... requires the extension httpfs to be loaded
```

## 原因
- TablePlusはdbtのprofiles.ymlの設定を読み込まない
- 拡張機能やAWS認証情報が設定されていない状態で起動する

## 解決方法

### 方法1: TablePlusで初期設定SQLを実行（推奨）

1. TablePlusでDuckDBデータベースを開く
2. `tableplus_init.sql`の内容を実行
   - または各コマンドを個別に実行：
   ```sql
   -- 必須設定
   SET autoinstall_known_extensions=1;
   SET autoload_known_extensions=1;
   LOAD httpfs;

   -- AWS設定
   SET s3_region='ap-northeast-1';
   SET s3_access_key_id='YOUR_ACCESS_KEY';
   SET s3_secret_access_key='YOUR_SECRET_KEY';
   ```

### 方法2: 永続的なインストール（完了済み）

httpfs拡張機能はデータベースに永続的にインストール済みです。
ただし、TablePlusでは以下の設定が毎回必要です：
```sql
LOAD httpfs;
SET s3_region='ap-northeast-1';
SET s3_access_key_id='YOUR_ACCESS_KEY';
SET s3_secret_access_key='YOUR_SECRET_KEY';
```

### 方法3: dbt経由でのアクセス

dbt経由でクエリを実行する場合は設定不要：
```bash
source .venv-dbt/bin/activate
dbt run
```

## AWS認証情報の取得方法

1. **環境変数から**
   ```bash
   echo $AWS_ACCESS_KEY_ID
   echo $AWS_SECRET_ACCESS_KEY
   ```

2. **AWS CLIプロファイルから**
   ```bash
   cat ~/.aws/credentials
   ```

## テストクエリ

設定後、以下のクエリで動作確認：
```sql
SELECT * FROM read_json_auto(
  's3://moderation-craft-data-800860245583/raw/fitbit/year=2025/month=08/day=05/activity_20250805.json'
) LIMIT 1;
```

## 注意事項

- AWS認証情報を含むSQLファイルはGitにコミットしない
- TablePlusのセッションは一時的なので、再接続時は設定を再実行する必要がある
- 本番環境ではIAMロールの使用を推奨