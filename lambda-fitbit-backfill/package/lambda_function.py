import json
import os
import base64
import logging
from datetime import datetime, timedelta, date as date_cls
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urlencode
import time

import boto3
import urllib3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

http = urllib3.PoolManager()

DEFAULT_START_DATE = date_cls(2025, 1, 1)
DEFAULT_END_DATE = date_cls(2025, 9, 27)
DEFAULT_EXCLUDE = {date_cls(2025, 8, 5)}

# レート制限対策: デフォルトを10日に削減
try:
    DEFAULT_MAX_DAYS = int(os.environ.get("FITBIT_BACKFILL_MAX_DAYS", "10"))
except ValueError:
    DEFAULT_MAX_DAYS = 10
DEFAULT_MAX_DAYS = max(1, min(DEFAULT_MAX_DAYS, 365))

def lambda_handler(event, context):
    """指定期間のFitbitデータをまとめて取得するバックフィルLambda"""
    logger.info("🚀 FitbitバックフィルLambdaを開始")

    config = _parse_event(event)
    logger.info(
        "📋 処理設定: start=%s end=%s exclude=%s force=%s",
        config["start"],
        config["end"],
        sorted(d.isoformat() for d in config["exclude"]),
        config["force"],
    )

    tokens = get_fitbit_tokens()
    if not tokens:
        logger.error("❌ DynamoDBからトークンを取得できませんでした")
        return _build_response(400, {"error": "No tokens found in DynamoDB"})

    results = {
        "fetched": [],
        "skipped": [],
        "errors": [],
        "start_date": config["start"].isoformat(),
        "end_date": config["end"].isoformat(),
        "exclude_dates": sorted(d.isoformat() for d in config["exclude"]),
        "force": config["force"],
        "max_days": config["max_days"],
        "processed_dates": 0,
        "rate_limit_reached": False,
        "next_start_date": None,
    }

    current_date = config["start"]
    processed = 0
    rate_limit_hit = False
    next_start: Optional[date_cls] = None

    while current_date <= config["end"]:
        if current_date in config["exclude"]:
            logger.info("⏭️ %s は除外対象のためスキップ", current_date.isoformat())
            current_date += timedelta(days=1)
            continue

        if processed >= config["max_days"]:
            next_start = current_date
            break

        date_str = current_date.isoformat()
        logger.info("📅 %s の処理を開始", date_str)

        try:
            tokens = ensure_valid_token(tokens)
            bucket = os.environ.get(
                "S3_BUCKET",
                os.environ.get("S3_BUCKET_NAME", "moderation-craft-data-800860245583"),
            )

            if not config["force"] and data_exists_in_s3(bucket, current_date):
                logger.info("↪️ %s は既にS3に保存済みのためスキップ", date_str)
                results["skipped"].append({"date": date_str, "reason": "already_exists"})
                processed += 1
                current_date += timedelta(days=1)
                continue

            fitbit_data, status_map = fetch_all_fitbit_data(tokens["access_token"], date_str)

            if any(status == 401 for status in status_map.values()):
                logger.info("401 が検出されたためトークンをリフレッシュします: %s", status_map)
                refreshed = refresh_fitbit_token(tokens["refresh_token"])
                if not refreshed:
                    raise RuntimeError("Token refresh failed after 401")
                tokens.update(refreshed)
                fitbit_data, status_map = fetch_all_fitbit_data(tokens["access_token"], date_str)

            if any(status == 429 for status in status_map.values()):
                logger.warning("Fitbit API のレートリミットに到達しました (%s)", status_map)
                results["errors"].append({
                    "date": date_str,
                    "error": "rate_limited",
                    "status_map": status_map,
                })
                rate_limit_hit = True
                next_start = current_date
                break

            if all(status != 200 for status in status_map.values()):
                logger.warning("%s のデータ取得がすべて失敗しました: %s", date_str, status_map)
                results["errors"].append({
                    "date": date_str,
                    "error": "no_successful_dataset",
                    "status_map": status_map,
                })
                processed += 1
                current_date += timedelta(days=1)
                continue

            saved_paths = save_to_s3(date_str, fitbit_data, context)

            results["fetched"].append({
                "date": date_str,
                "files": saved_paths,
                "status_map": status_map,
            })
            logger.info("✅ %s の保存が完了", date_str)
        except Exception as exc:  # pylint: disable=broad-except
            logger.exception("❌ %s の処理でエラー", date_str)
            results["errors"].append({"date": date_str, "error": str(exc)})

        processed += 1
        current_date += timedelta(days=1)

    results["processed_dates"] = processed
    if rate_limit_hit:
        results["rate_limit_reached"] = True
    if next_start is None and current_date <= config["end"]:
        next_start = current_date
    if next_start and next_start <= config["end"]:
        results["next_start_date"] = next_start.isoformat()

    status = 200 if not results["errors"] else 207
    logger.info("📦 バックフィル結果: %s", json.dumps(results, ensure_ascii=False))
    return _build_response(status, results)


def _parse_event(event: Dict) -> Dict:
    event = event or {}
    start = _coerce_date(event.get("start_date"), DEFAULT_START_DATE)
    end = _coerce_date(event.get("end_date"), DEFAULT_END_DATE)

    if start > end:
        raise ValueError("start_date は end_date 以下である必要があります")

    exclude: Set[date_cls] = set(DEFAULT_EXCLUDE)
    for raw_date in event.get("exclude_dates", []):
        exclude.add(_coerce_date(raw_date, DEFAULT_START_DATE))

    force = bool(event.get("force", False))

    max_days_value = event.get("max_days")
    if max_days_value is None:
        max_days = DEFAULT_MAX_DAYS
    else:
        try:
            max_days = int(max_days_value)
        except (TypeError, ValueError):
            max_days = DEFAULT_MAX_DAYS
    if max_days <= 0:
        max_days = DEFAULT_MAX_DAYS

    return {
        "start": start,
        "end": end,
        "exclude": exclude,
        "force": force,
        "max_days": max_days,
    }


def _coerce_date(raw_date: str, fallback: date_cls) -> date_cls:
    if not raw_date:
        return fallback
    return datetime.strptime(raw_date, "%Y-%m-%d").date()


def ensure_valid_token(tokens: Dict) -> Dict:
    # 常に最新のトークンをDynamoDBから取得して競合を防ぐ
    latest_tokens = get_fitbit_tokens()
    if latest_tokens:
        logger.info("📋 最新のトークンをDynamoDBから取得")
        tokens = latest_tokens

    if is_token_expired(tokens):
        logger.info("🔄 トークンが期限切れのためリフレッシュします")
        refreshed = refresh_fitbit_token(tokens["refresh_token"])
        if not refreshed:
            raise RuntimeError("Token refresh failed")
        tokens.update(refreshed)
    return tokens


def data_exists_in_s3(bucket: str, target_date: date_cls) -> bool:
    client = boto3.client("s3")
    key = _summary_key(target_date)
    try:
        client.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as err:
        if err.response["Error"]["Code"] == "404":
            return False
        raise


def _summary_key(target_date: date_cls) -> str:
    return (
        f"raw/fitbit/year={target_date.year}/"
        f"month={target_date.month:02d}/"
        f"day={target_date.day:02d}/_summary.json"
    )


def _build_response(status_code: int, payload: Dict) -> Dict:
    return {"statusCode": status_code, "body": json.dumps(payload, ensure_ascii=False)}


# --- 以下は既存の日次Lambdaと同じヘルパー群 ---

def get_fitbit_tokens():
    try:
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE", "fitbit_tokens"))
        response = table.get_item(Key={"user_id": os.environ.get("FITBIT_USER_ID", "BGPGCR")})
        if "Item" in response:
            item = response["Item"]
            if "expires_at" in item:
                item["expires_at"] = int(item["expires_at"])
            return item
        return None
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("DynamoDB error: %s", exc)
        return None


def is_token_expired(tokens):
    try:
        expires_at = tokens.get("expires_at", 0)
        now = datetime.now().timestamp()
        is_expired = now >= (expires_at - 300)
        if is_expired:
            logger.info("トークン期限切れ: 現在=%s 期限=%s", int(now), expires_at)
        return is_expired
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("期限チェックエラー: %s", exc)
        return True


def refresh_fitbit_token(refresh_token):
    try:
        client_id = os.environ.get("FITBIT_CLIENT_ID", "23QQC2")
        client_secret = os.environ.get("FITBIT_CLIENT_SECRET")
        if not client_secret:
            logger.error("FITBIT_CLIENT_SECRET 環境変数が未設定です")
            return None

        auth_bytes = f"{client_id}:{client_secret}".encode("ascii")
        auth_b64 = base64.b64encode(auth_bytes).decode("ascii")
        url = "https://api.fitbit.com/oauth2/token"
        headers = {
            "Authorization": f"Basic {auth_b64}",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        # URLエンコーディングして特殊文字を正しく処理
        body = urlencode({
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        })

        response = http.request("POST", url, headers=headers, body=body)
        if response.status == 200:
            new_tokens = json.loads(response.data.decode("utf-8"))
            logger.info("トークンリフレッシュ成功")
            save_tokens_to_dynamodb(new_tokens)
            return {
                "access_token": new_tokens["access_token"],
                "refresh_token": new_tokens["refresh_token"],
                "expires_at": int(datetime.now().timestamp() + new_tokens["expires_in"]),
            }

        logger.error("リフレッシュ失敗: %s - %s", response.status, response.data)
        return None
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("リフレッシュエラー: %s", exc)
        return None


def save_tokens_to_dynamodb(token_data):
    try:
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(os.environ.get("DYNAMODB_TABLE", "fitbit_tokens"))
        expires_at = int(datetime.now().timestamp() + token_data["expires_in"])
        table.put_item(
            Item={
                "user_id": os.environ.get("FITBIT_USER_ID", "BGPGCR"),
                "access_token": token_data["access_token"],
                "refresh_token": token_data["refresh_token"],
                "expires_at": expires_at,
                "scope": token_data.get("scope", ""),
                "updated_at": datetime.now().isoformat(),
            }
        )
        logger.info("新しいトークンをDynamoDBに保存しました")
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("トークン保存エラー: %s", exc)


def fetch_all_fitbit_data(access_token, date_str):
    data = {}
    status_map = {}
    endpoints = {
        "sleep": f"/1.2/user/-/sleep/date/{date_str}.json",
        "activity": f"/1/user/-/activities/date/{date_str}.json",
        "heart_rate": f"/1/user/-/activities/heart/date/{date_str}/1d/1min.json",
        "steps": f"/1/user/-/activities/steps/date/{date_str}/1d.json",
    }

    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}

    for data_type, endpoint in endpoints.items():
        try:
            logger.info("  📥 %s データを取得中", data_type)
            url = f"https://api.fitbit.com{endpoint}"
            response = http.request("GET", url, headers=headers)
            status_map[data_type] = response.status

            # レート制限ヘッダーを確認
            remaining = int(response.headers.get('Fitbit-Rate-Limit-Remaining', '150'))
            if remaining < 20:  # 残り20リクエスト未満で警告
                wait_time = 30 if remaining < 10 else 5
                logger.warning(f"⏰ レート制限に近づいています（残り{remaining}）。{wait_time}秒待機")
                time.sleep(wait_time)

            if response.status == 200:
                data[data_type] = json.loads(response.data.decode("utf-8"))
                logger.info("  ✅ %s データ取得成功", data_type)
            elif response.status == 429:
                # レート制限エラー時は長めに待機
                retry_after = int(response.headers.get('Retry-After', '60'))
                logger.warning(f"  ⚠️ %s で429エラー。{retry_after}秒待機します", data_type)
                data[data_type] = None
            else:
                logger.warning("  ⚠️ %s データ取得失敗: %s", data_type, response.status)
                data[data_type] = None

            # 各API呼び出し間に短い遅延を挿入（レート制限対策）
            time.sleep(0.5)

        except Exception as exc:  # pylint: disable=broad-except
            logger.error("  ❌ %s データ取得エラー: %s", data_type, exc)
            data[data_type] = None
            status_map[data_type] = 0

    return data, status_map


def save_to_s3(date_str, data, context=None):
    s3 = boto3.client("s3")
    bucket = os.environ.get(
        "S3_BUCKET", os.environ.get("S3_BUCKET_NAME", "moderation-craft-data-800860245583")
    )

    date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    year = date_obj.year
    month = f"{date_obj.month:02d}"
    day = f"{date_obj.day:02d}"

    saved_files: List[str] = []
    for data_type, content in data.items():
        if content is None:
            continue

        key = f"raw/fitbit/year={year}/month={month}/day={day}/{data_type}_{date_str.replace('-', '')}.json"
        enriched_data = {
            "metadata": {
                "extraction_timestamp": datetime.now().isoformat(),
                "data_date": date_str,
                "data_type": data_type,
                "source": "fitbit_api",
                "lambda_execution_id": context.aws_request_id if context else "local_test",
            },
            "data": content,
        }

        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(enriched_data, indent=2),
            ContentType="application/json",
            Metadata={"data-date": date_str, "data-type": data_type},
        )
        saved_files.append(f"s3://{bucket}/{key}")
        logger.info("  ✅ %s を保存: %s", data_type, key)

    summary_key = _summary_key(datetime.strptime(date_str, "%Y-%m-%d").date())
    summary_data = {
        "extraction_date": datetime.now().isoformat(),
        "data_date": date_str,
        "files_created": len(saved_files),
        "data_types": list(data.keys()),
        "status": "success" if saved_files else "partial",
        "files": saved_files,
    }
    s3.put_object(
        Bucket=bucket,
        Key=summary_key,
        Body=json.dumps(summary_data, indent=2),
        ContentType="application/json",
    )
    logger.info("📋 サマリーファイルを保存: %s", summary_key)

    return saved_files


if __name__ == "__main__":
    test_event = {}
    test_context = type("obj", (object,), {"aws_request_id": "test-123"})()
    print(json.dumps(lambda_handler(test_event, test_context), indent=2, ensure_ascii=False))
