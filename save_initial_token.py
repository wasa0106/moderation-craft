#!/usr/bin/env python3
"""
Fitbitトークンを初期設定としてDynamoDBに保存するスクリプト

使い方:
1. このスクリプトを実行
2. トークン情報を入力
3. DynamoDBに保存される
"""

import boto3
import json
import sys
from datetime import datetime, timedelta
from botocore.exceptions import ClientError

# 設定
AWS_REGION = 'ap-northeast-1'
DYNAMODB_TABLE = 'fitbit_tokens'
USER_ID = 'BGPGCR'

def check_table_exists(dynamodb_client, table_name):
    """DynamoDBテーブルが存在するか確認"""
    try:
        dynamodb_client.describe_table(TableName=table_name)
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            return False
        else:
            raise

def create_table_if_not_exists(dynamodb_client, table_name):
    """テーブルが存在しない場合は作成"""
    if not check_table_exists(dynamodb_client, table_name):
        print(f"📦 テーブル '{table_name}' が存在しません。作成します...")
        
        dynamodb_client.create_table(
            TableName=table_name,
            KeySchema=[
                {'AttributeName': 'user_id', 'KeyType': 'HASH'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'user_id', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        
        # テーブルが作成されるまで待機
        waiter = dynamodb_client.get_waiter('table_exists')
        waiter.wait(TableName=table_name)
        print(f"✅ テーブル '{table_name}' を作成しました！")
        return True
    else:
        print(f"✅ テーブル '{table_name}' は既に存在します")
        return False

def get_token_from_file():
    """fitbit-tokens.jsonファイルからトークンを読み込む（test-fitbit-auth.jsで作成したもの）"""
    try:
        with open('fitbit-tokens.json', 'r') as f:
            data = json.load(f)
            print("📁 fitbit-tokens.jsonファイルからトークンを読み込みました")
            return data
    except FileNotFoundError:
        print("⚠️  fitbit-tokens.jsonファイルが見つかりません")
        return None
    except json.JSONDecodeError:
        print("❌ fitbit-tokens.jsonファイルの形式が正しくありません")
        return None

def get_token_manually():
    """手動でトークン情報を入力"""
    print("\n📝 トークン情報を手動で入力してください")
    print("（ヒント: /debug/fitbitページでアクセストークンを確認できます）\n")
    
    access_token = input("アクセストークンを入力（長い文字列）: ").strip()
    
    if not access_token:
        print("❌ アクセストークンは必須です")
        return None
    
    refresh_token = input("リフレッシュトークン（わからない場合はEnter）: ").strip()
    
    # スコープのデフォルト値
    default_scope = "activity heartrate sleep profile settings location"
    scope_input = input(f"スコープ（デフォルト: {default_scope}）: ").strip()
    scope = scope_input if scope_input else default_scope
    
    # 有効期限（デフォルト8時間）
    expires_in_input = input("有効期限（秒）（デフォルト: 28800 = 8時間）: ").strip()
    expires_in = int(expires_in_input) if expires_in_input else 28800
    
    return {
        'access_token': access_token,
        'refresh_token': refresh_token if refresh_token else 'dummy_refresh_token',
        'scope': scope,
        'expires_in': expires_in,
        'user_id': USER_ID
    }

def save_to_dynamodb(token_data):
    """トークンをDynamoDBに保存"""
    dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
    table = dynamodb.Table(DYNAMODB_TABLE)
    
    # 有効期限を計算
    expires_at = datetime.now() + timedelta(seconds=token_data.get('expires_in', 28800))
    
    # DynamoDBに保存するアイテム
    item = {
        'user_id': USER_ID,
        'access_token': token_data['access_token'],
        'refresh_token': token_data.get('refresh_token', ''),
        'expires_at': int(expires_at.timestamp()),
        'scope': token_data.get('scope', ''),
        'updated_at': datetime.now().isoformat(),
        'created_at': datetime.now().isoformat()
    }
    
    try:
        table.put_item(Item=item)
        print(f"\n✅ トークンをDynamoDBに保存しました！")
        print(f"   テーブル: {DYNAMODB_TABLE}")
        print(f"   ユーザーID: {USER_ID}")
        print(f"   有効期限: {expires_at.strftime('%Y-%m-%d %H:%M:%S')}")
        return True
    except Exception as e:
        print(f"❌ 保存中にエラーが発生しました: {str(e)}")
        return False

def verify_saved_token():
    """保存されたトークンを確認"""
    dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
    table = dynamodb.Table(DYNAMODB_TABLE)
    
    try:
        response = table.get_item(Key={'user_id': USER_ID})
        if 'Item' in response:
            item = response['Item']
            print("\n📋 保存されたトークン情報:")
            print(f"   ユーザーID: {item['user_id']}")
            print(f"   アクセストークン: {item['access_token'][:20]}...（最初の20文字）")
            print(f"   リフレッシュトークン: {'あり' if item.get('refresh_token') else 'なし'}")
            print(f"   有効期限: {datetime.fromtimestamp(item['expires_at']).strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"   スコープ: {item.get('scope', 'N/A')}")
            print(f"   更新日時: {item.get('updated_at', 'N/A')}")
            return True
        else:
            print("⚠️  トークンが見つかりません")
            return False
    except Exception as e:
        print(f"❌ 確認中にエラーが発生しました: {str(e)}")
        return False

def main():
    print("=" * 60)
    print("🔐 Fitbitトークン初期設定スクリプト")
    print("=" * 60)
    
    # AWS認証情報の確認
    try:
        # DynamoDBクライアントを作成
        dynamodb_client = boto3.client('dynamodb', region_name=AWS_REGION)
        print(f"✅ AWS認証成功（リージョン: {AWS_REGION}）")
    except Exception as e:
        print(f"❌ AWS認証に失敗しました: {str(e)}")
        print("\nAWS CLIが設定されているか確認してください:")
        print("  aws configure")
        sys.exit(1)
    
    # テーブルの確認/作成
    create_table_if_not_exists(dynamodb_client, DYNAMODB_TABLE)
    
    # 既存のトークンを確認
    print("\n📍 既存のトークンを確認中...")
    if verify_saved_token():
        overwrite = input("\n既存のトークンを上書きしますか？ (y/N): ").strip().lower()
        if overwrite != 'y':
            print("キャンセルしました")
            sys.exit(0)
    
    # トークン取得方法を選択
    print("\n🔍 トークンの取得方法を選択してください:")
    print("1. fitbit-tokens.jsonファイルから読み込む（推奨）")
    print("2. 手動で入力する")
    
    choice = input("\n選択 (1 or 2): ").strip()
    
    token_data = None
    
    if choice == '1':
        token_data = get_token_from_file()
        if not token_data:
            print("ファイルが見つからないため、手動入力に切り替えます")
            token_data = get_token_manually()
    elif choice == '2':
        token_data = get_token_manually()
    else:
        print("❌ 無効な選択です")
        sys.exit(1)
    
    if not token_data:
        print("❌ トークン情報を取得できませんでした")
        sys.exit(1)
    
    # DynamoDBに保存
    print("\n💾 DynamoDBに保存中...")
    if save_to_dynamodb(token_data):
        # 保存結果を確認
        print("\n🔍 保存結果を確認中...")
        verify_saved_token()
        
        print("\n" + "=" * 60)
        print("🎉 セットアップ完了！")
        print("Lambda関数がこのトークンを使用してFitbitデータを取得できます")
        print("=" * 60)
    else:
        print("❌ セットアップに失敗しました")
        sys.exit(1)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  キャンセルされました")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ 予期しないエラー: {str(e)}")
        sys.exit(1)