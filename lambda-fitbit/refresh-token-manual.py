#!/usr/bin/env python3
"""
Fitbitトークンを手動でリフレッシュするスクリプト
トークンが無効な場合の復旧用
"""

import os
import sys
import json
import base64
import urllib3
from datetime import datetime
import boto3
from decimal import Decimal

# urllib3の警告を無効化
urllib3.disable_warnings()
http = urllib3.PoolManager()

def load_env():
    """環境変数を読み込み"""
    env_file = "../.env.local"
    if os.path.exists(env_file):
        print("📋 .env.localから環境変数を読み込み中...")
        with open(env_file, "r") as f:
            for line in f:
                if line.strip() and not line.startswith("#"):
                    key, value = line.strip().split("=", 1)
                    os.environ[key] = value
        print("✅ 環境変数を読み込みました")
    else:
        print("❌ .env.localが見つかりません")
        sys.exit(1)

def get_current_tokens():
    """DynamoDBから現在のトークンを取得"""
    try:
        dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
        table = dynamodb.Table('fitbit_tokens')

        response = table.get_item(
            Key={'user_id': 'BGPGCR'}
        )

        if 'Item' in response:
            return response['Item']
        return None
    except Exception as e:
        print(f"❌ DynamoDB取得エラー: {str(e)}")
        return None

def refresh_token(refresh_token_value):
    """トークンをリフレッシュ"""
    client_id = os.environ.get('FITBIT_CLIENT_ID', '23QQC2')
    client_secret = os.environ.get('FITBIT_CLIENT_SECRET')

    if not client_secret:
        print("❌ FITBIT_CLIENT_SECRETが設定されていません")
        return None

    # Basic認証ヘッダーを作成
    auth_string = f"{client_id}:{client_secret}"
    auth_bytes = auth_string.encode('ascii')
    auth_b64 = base64.b64encode(auth_bytes).decode('ascii')

    url = 'https://api.fitbit.com/oauth2/token'
    headers = {
        'Authorization': f'Basic {auth_b64}',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    body = f'grant_type=refresh_token&refresh_token={refresh_token_value}'

    print(f"📮 Fitbit APIにリフレッシュリクエストを送信中...")
    print(f"   Client ID: {client_id}")
    print(f"   Client Secret: {client_secret[:10]}...")

    response = http.request(
        'POST',
        url,
        headers=headers,
        body=body
    )

    if response.status == 200:
        new_tokens = json.loads(response.data.decode('utf-8'))
        print("✅ 新しいトークンペアを取得しました")
        return new_tokens
    else:
        error_data = json.loads(response.data.decode('utf-8')) if response.data else {}
        print(f"❌ リフレッシュ失敗 (Status: {response.status})")
        print(f"   エラー: {json.dumps(error_data, indent=2)}")
        return None

def save_to_dynamodb(token_data):
    """新しいトークンをDynamoDBに保存"""
    try:
        dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
        table = dynamodb.Table('fitbit_tokens')

        expires_at = int(datetime.now().timestamp() + token_data['expires_in'])
        current_time = datetime.now().isoformat()

        table.put_item(
            Item={
                'user_id': 'BGPGCR',
                'access_token': token_data['access_token'],
                'refresh_token': token_data['refresh_token'],
                'expires_at': Decimal(expires_at),
                'scope': token_data.get('scope', ''),
                'updated_at': current_time,
                'last_refresh_at': current_time
            }
        )
        print("✅ 新しいトークンをDynamoDBに保存しました")
        print(f"   保存時刻: {current_time}")
        print(f"   有効期限: {datetime.fromtimestamp(expires_at).isoformat()}")
        return True
    except Exception as e:
        print(f"❌ DynamoDB保存エラー: {str(e)}")
        return False

def main():
    print("============================================")
    print("🔧 Fitbitトークン手動リフレッシュツール")
    print("============================================")
    print()

    # 環境変数を読み込み
    load_env()

    # 現在のトークンを取得
    print("📋 現在のトークン情報を取得中...")
    current_tokens = get_current_tokens()

    if not current_tokens:
        print("❌ DynamoDBにトークンが見つかりません")
        print("💡 最初にOAuth認証フローを完了してトークンを取得してください")
        sys.exit(1)

    print("✅ トークンを取得しました")
    print(f"   User ID: {current_tokens.get('user_id')}")
    print(f"   最終更新: {current_tokens.get('updated_at', '不明')}")
    print(f"   有効期限: {datetime.fromtimestamp(int(current_tokens.get('expires_at', 0))).isoformat()}")
    print()

    # リフレッシュを実行
    print("🔄 トークンをリフレッシュします...")
    new_tokens = refresh_token(current_tokens['refresh_token'])

    if new_tokens:
        # DynamoDBに保存
        if save_to_dynamodb(new_tokens):
            print()
            print("✅ トークンのリフレッシュが完了しました！")
            print("   Lambda関数を再度実行してデータ取得をテストしてください")
        else:
            print("❌ トークンの保存に失敗しました")
            sys.exit(1)
    else:
        print()
        print("❌ トークンのリフレッシュに失敗しました")
        print("考えられる原因:")
        print("1. CLIENT_SECRETが間違っている")
        print("2. リフレッシュトークンが無効（既に使用済み）")
        print("3. ユーザーがアプリの許可を取り消した")
        print()
        print("💡 解決方法:")
        print("1. Fitbit開発者ダッシュボードでCLIENT_SECRETを確認")
        print("2. 再度OAuth認証フローを実行して新しいトークンを取得")
        sys.exit(1)

if __name__ == "__main__":
    main()