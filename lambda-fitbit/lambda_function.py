import json
import os
import boto3
import urllib3
from datetime import datetime, timedelta
import base64
import logging
from typing import Any, Dict, Tuple
from urllib.parse import urlencode

# ログ設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# urllib3を使用（requestsの代わりに標準ライブラリで）
http = urllib3.PoolManager()

def lambda_handler(event, context):
    """
    毎日実行されるLambda関数
    前日のFitbitデータを取得してS3に保存
    """
    logger.info("🚀 Fitbit日次エクスポートLambda関数を開始")

    # 昨日の日付を取得
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    logger.info(f"📅 処理対象日付: {yesterday}")

    try:
        # 1. DynamoDBからトークンを取得
        logger.info("🔑 DynamoDBからトークンを取得中...")
        tokens = get_fitbit_tokens()

        if not tokens:
            logger.error("❌ トークンが見つかりません")
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No tokens found in DynamoDB'})
            }

        logger.info(f"✅ トークン取得成功 (User ID: {tokens.get('user_id', 'N/A')})")

        # 2. 毎日実行される前提で、必ずトークンをリフレッシュ
        # Fitbitの仕様: リフレッシュトークンは一度使うと無効になるため、
        # 日次実行では必ず新しいトークンを取得する
        logger.info("🔄 日次実行のため、トークンをリフレッシュします...")
        logger.info(f"  前回のリフレッシュ: {tokens.get('updated_at', '不明')}")


        tokens = refresh_fitbit_token(tokens['refresh_token'])
        if not tokens:
            logger.error("❌ トークンのリフレッシュに失敗")
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Token refresh failed - may need re-authorization'})
            }
        logger.info("✅ トークンのリフレッシュ成功")

        # 3. Fitbit APIからデータを取得
        logger.info("📊 Fitbit APIからデータを取得中...")
        fitbit_data, status_map = fetch_all_fitbit_data(tokens['access_token'], yesterday)
        if all(status != 200 for status in status_map.values()):
            logger.warning("Fitbit APIからの取得がすべて失敗しました: %s", status_map)

        # 4. S3に保存
        logger.info("💾 S3にデータを保存中...")
        s3_paths = save_to_s3(yesterday, fitbit_data, context)

        logger.info("✅ 処理完了！")

        # 成功レスポンス
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Successfully exported Fitbit data',
                'date': yesterday,
                'files_saved': len(s3_paths),
                's3_paths': s3_paths
            })
        }

    except Exception as e:
        logger.error(f"❌ エラーが発生しました: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }


def get_fitbit_tokens():
    """DynamoDBからトークンを取得"""
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ.get('DYNAMODB_TABLE', 'fitbit_tokens'))

        response = table.get_item(
            Key={'user_id': os.environ.get('FITBIT_USER_ID', 'BGPGCR')}
        )

        if 'Item' in response:
            # Decimal型をintに変換
            item = response['Item']
            if 'expires_at' in item:
                item['expires_at'] = int(item['expires_at'])
            return item

        return None
    except Exception as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return None


def is_token_expired(tokens):
    """トークンが期限切れかチェック"""
    try:
        expires_at = tokens.get('expires_at', 0)
        now = datetime.now().timestamp()

        # 5分の余裕を持って判定
        is_expired = now >= (expires_at - 300)

        if is_expired:
            logger.info(f"トークン期限切れ: 現在={int(now)}, 期限={expires_at}")

        return is_expired
    except Exception as e:
        logger.error(f"期限チェックエラー: {str(e)}")
        return True  # エラーの場合は期限切れとして扱う


def refresh_fitbit_token(refresh_token):
    """トークンをリフレッシュ"""
    try:
        # Fitbitの認証情報
        client_id = os.environ.get('FITBIT_CLIENT_ID', '23QQC2')
        client_secret = os.environ.get('FITBIT_CLIENT_SECRET')

        if not client_secret:
            logger.error("FITBIT_CLIENT_SECRET環境変数が設定されていません")
            return None

        # Basic認証ヘッダーを作成
        auth_string = f"{client_id}:{client_secret}"
        auth_bytes = auth_string.encode('ascii')
        auth_b64 = base64.b64encode(auth_bytes).decode('ascii')

        # リフレッシュリクエスト
        url = 'https://api.fitbit.com/oauth2/token'
        headers = {
            'Authorization': f'Basic {auth_b64}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        # URLエンコーディングして特殊文字を正しく処理
        body = urlencode({
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        })

        logger.info(f"📮 リフレッシュトークンでAPIを呼び出し中...")
        response = http.request(
            'POST',
            url,
            headers=headers,
            body=body
        )

        if response.status == 200:
            new_tokens = json.loads(response.data.decode('utf-8'))
            logger.info("✅ 新しいトークンペアを取得成功")
            logger.info(f"  新しいアクセストークンの有効期限: {new_tokens.get('expires_in', 0)}秒")

            # DynamoDBに新しいトークンを保存
            # 重要: Fitbitの仕様により、古いリフレッシュトークンは無効になるため
            # 必ず新しいトークンを保存する
            save_tokens_to_dynamodb(new_tokens)

            return {
                'access_token': new_tokens['access_token'],
                'refresh_token': new_tokens['refresh_token'],  # 新しいリフレッシュトークン
                'expires_at': int(datetime.now().timestamp() + new_tokens['expires_in']),
                'user_id': new_tokens.get('user_id', 'BGPGCR')
            }
        elif response.status == 401:
            # invalid_grant: トークンが無効または取り消された
            error_data = json.loads(response.data.decode('utf-8')) if response.data else {}
            error_type = error_data.get('errors', [{}])[0].get('errorType', 'unknown')

            if error_type == 'invalid_grant':
                logger.error("🔒 リフレッシュトークンが無効です。ユーザーの再認証が必要です。")
                logger.error(f"  エラー詳細: {error_data}")
                # TODO: 通知システムがあれば、ユーザーに再認証を促す通知を送る
            else:
                logger.error(f"❌ 認証エラー (401): {error_data}")
            return None
        else:
            logger.error(f"❌ リフレッシュ失敗: {response.status}")
            logger.error(f"  レスポンス: {response.data.decode('utf-8') if response.data else 'No data'}")
            return None

    except Exception as e:
        logger.error(f"リフレッシュエラー: {str(e)}")
        return None


def save_tokens_to_dynamodb(token_data):
    """新しいトークンをDynamoDBに保存"""
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ.get('DYNAMODB_TABLE', 'fitbit_tokens'))

        expires_at = int(datetime.now().timestamp() + token_data['expires_in'])
        current_time = datetime.now().isoformat()

        table.put_item(
            Item={
                'user_id': os.environ.get('FITBIT_USER_ID', 'BGPGCR'),
                'access_token': token_data['access_token'],
                'refresh_token': token_data['refresh_token'],
                'expires_at': expires_at,
                'scope': token_data.get('scope', ''),
                'updated_at': current_time,
                'last_refresh_at': current_time  # リフレッシュ実行時刻を記録
            }
        )
        logger.info("✅ 新しいトークンペアをDynamoDBに保存しました")
        logger.info(f"  保存時刻: {current_time}")
        logger.info(f"  有効期限: {datetime.fromtimestamp(expires_at).isoformat()}")

    except Exception as e:
        logger.error(f"❌ トークン保存エラー: {str(e)}")
        raise  # エラーを再発生させて呼び出し元に伝播


def fetch_all_fitbit_data(access_token, date) -> Tuple[Dict[str, Any | None], Dict[str, int]]:
    """Fitbit APIから全データを取得し、HTTPステータスも返す"""
    data: Dict[str, dict | None] = {}
    status_map: Dict[str, int] = {}

    endpoints = {
        'sleep': f'/1.2/user/-/sleep/date/{date}.json',
        'activity': f'/1/user/-/activities/date/{date}.json',
        'heart_rate': f'/1/user/-/activities/heart/date/{date}/1d/1min.json',
        'steps': f'/1/user/-/activities/steps/date/{date}/1d.json'
    }

    headers = {
        'Authorization': f'Bearer {access_token}',
        'Accept': 'application/json'
    }

    for data_type, endpoint in endpoints.items():
        try:
            logger.info(f"  📥 {data_type}データを取得中...")

            url = f'https://api.fitbit.com{endpoint}'
            response = http.request('GET', url, headers=headers)
            status_map[data_type] = response.status

            if response.status == 200:
                data[data_type] = json.loads(response.data.decode('utf-8'))
                logger.info(f"  ✅ {data_type}データ取得成功")
            else:
                logger.warning(f"  ⚠️ {data_type}データ取得失敗: {response.status}")
                data[data_type] = None

        except Exception as e:
            logger.error(f"  ❌ {data_type}データ取得エラー: {str(e)}")
            data[data_type] = None
            status_map[data_type] = 0

    return data, status_map


def save_to_s3(date, data, context=None):
    """データをS3に保存"""
    s3 = boto3.client('s3')
    bucket = os.environ.get('S3_BUCKET', os.environ.get('S3_BUCKET_NAME', 'moderation-craft-data-800860245583'))

    # 日付をパース
    date_obj = datetime.strptime(date, '%Y-%m-%d')
    year = date_obj.year
    month = f"{date_obj.month:02d}"
    day = f"{date_obj.day:02d}"

    saved_files = []

    # 各データタイプを個別に保存
    for data_type, content in data.items():
        if content is not None:
            try:
                # S3キー（パス）を作成
                key = f"raw/fitbit/year={year}/month={month}/day={day}/{data_type}_{date.replace('-', '')}.json"

                # メタデータを追加
                enriched_data = {
                    'metadata': {
                        'extraction_timestamp': datetime.now().isoformat(),
                        'data_date': date,
                        'data_type': data_type,
                        'source': 'fitbit_api',
                        'lambda_execution_id': context.aws_request_id if context else 'local_test'
                    },
                    'data': content
                }

                # S3に保存
                s3.put_object(
                    Bucket=bucket,
                    Key=key,
                    Body=json.dumps(enriched_data, indent=2),
                    ContentType='application/json',
                    Metadata={
                        'data-date': date,
                        'data-type': data_type
                    }
                )

                saved_files.append(f"s3://{bucket}/{key}")
                logger.info(f"  ✅ {data_type}を保存: {key}")

            except Exception as e:
                logger.error(f"  ❌ {data_type}の保存エラー: {str(e)}")

    # サマリーファイルを作成
    try:
        summary_key = f"raw/fitbit/year={year}/month={month}/day={day}/_summary.json"
        summary_data = {
            'extraction_date': datetime.now().isoformat(),
            'data_date': date,
            'files_created': len(saved_files),
            'data_types': list(data.keys()),
            'status': 'success' if saved_files else 'partial',
            'files': saved_files
        }

        s3.put_object(
            Bucket=bucket,
            Key=summary_key,
            Body=json.dumps(summary_data, indent=2),
            ContentType='application/json'
        )

        logger.info(f"📋 サマリーファイルを保存: {summary_key}")

    except Exception as e:
        logger.error(f"サマリーファイル保存エラー: {str(e)}")

    return saved_files


# ローカルテスト用
if __name__ == '__main__':
    # 環境変数が設定されていることを確認
    required_vars = ['FITBIT_CLIENT_ID', 'FITBIT_CLIENT_SECRET', 'S3_BUCKET_NAME']
    missing_vars = [var for var in required_vars if not os.environ.get(var)]

    if missing_vars:
        print(f"❌ 必須環境変数が設定されていません: {', '.join(missing_vars)}")
        print("💡 .env.localファイルから環境変数を読み込むか、exportコマンドで設定してください")
        print("例: export $(cat ../.env.local | grep -v '^#' | xargs)")
        exit(1)

    # テスト実行
    test_event = {}
    test_context = type('obj', (object,), {'aws_request_id': 'test-123'})()

    result = lambda_handler(test_event, test_context)
    print(json.dumps(result, indent=2))
