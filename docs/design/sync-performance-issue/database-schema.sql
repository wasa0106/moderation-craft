-- 同期パフォーマンス改善のためのデータベーススキーマ設計
-- IndexedDB (Dexie) と DynamoDB の両方を考慮した設計

-- ===================================
-- IndexedDB スキーマ（Dexie形式）
-- ===================================

-- 改善された sync_queue テーブル
-- Dexieでの定義例:
-- sync_queue: '++id, user_id, entity_type, entity_id, operation_type, status, [entity_type+entity_id+operation_type], next_retry_after, bulk_operation_id'

/*
sync_queue テーブルの改善点:
1. 複合インデックス [entity_type+entity_id+operation_type] で重複チェックを高速化
2. next_retry_after インデックスでリトライ対象の効率的な取得
3. bulk_operation_id インデックスでBulk操作のグループ化
4. status インデックスで状態別のクエリを最適化
*/

-- ===================================
-- DynamoDB スキーマ設計
-- ===================================

-- sync_queue テーブル（DynamoDB）
CREATE TABLE IF NOT EXISTS sync_queue (
    -- プライマリキー
    pk VARCHAR(255) NOT NULL, -- 'USER#{user_id}'
    sk VARCHAR(255) NOT NULL, -- 'SYNC#{entity_type}#{entity_id}#{operation_type}'
    
    -- 属性
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    operation_type VARCHAR(10) NOT NULL, -- CREATE, UPDATE, DELETE
    data TEXT, -- JSON形式のエンティティデータ（圧縮可能）
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, dormant
    attempt_count INT NOT NULL DEFAULT 0,
    last_attempted TIMESTAMP,
    next_retry_after TIMESTAMP, -- 次回リトライ時刻
    error_message TEXT,
    error_type VARCHAR(20), -- network, auth, rate_limit, unknown
    version INT NOT NULL DEFAULT 1,
    
    -- Bulk操作の最適化
    is_bulk BOOLEAN DEFAULT FALSE,
    bulk_operation_id VARCHAR(36),
    entity_count INT,
    
    -- タイムスタンプ
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- DynamoDB用の追加属性
    ttl BIGINT, -- Time To Live（完了したアイテムの自動削除用）
    
    PRIMARY KEY (pk, sk)
);

-- グローバルセカンダリインデックス（GSI）
-- GSI1: ステータス別のクエリ用
-- pk: 'STATUS#{status}'
-- sk: 'USER#{user_id}#TIME#{next_retry_after}'

-- GSI2: Bulk操作のグループ化用
-- pk: 'BULK#{bulk_operation_id}'
-- sk: 'SEQ#{sequence_number}'

-- GSI3: リトライ管理用
-- pk: 'RETRY'
-- sk: 'TIME#{next_retry_after}#USER#{user_id}'

-- ===================================
-- 同期統計テーブル（オプション）
-- ===================================

CREATE TABLE IF NOT EXISTS sync_statistics (
    -- プライマリキー
    pk VARCHAR(255) NOT NULL, -- 'USER#{user_id}'
    sk VARCHAR(255) NOT NULL, -- 'STATS#{date}' (日別集計)
    
    -- 統計情報
    date DATE NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    total_syncs INT NOT NULL DEFAULT 0,
    successful_syncs INT NOT NULL DEFAULT 0,
    failed_syncs INT NOT NULL DEFAULT 0,
    
    -- エラー種別カウント
    network_errors INT NOT NULL DEFAULT 0,
    auth_errors INT NOT NULL DEFAULT 0,
    rate_limit_errors INT NOT NULL DEFAULT 0,
    unknown_errors INT NOT NULL DEFAULT 0,
    
    -- パフォーマンスメトリクス
    total_sync_duration_ms BIGINT NOT NULL DEFAULT 0,
    average_sync_duration_ms INT,
    max_sync_duration_ms INT,
    min_sync_duration_ms INT,
    
    -- Bulk最適化統計
    bulk_operations_count INT NOT NULL DEFAULT 0,
    entities_via_bulk INT NOT NULL DEFAULT 0,
    data_saved_bytes BIGINT NOT NULL DEFAULT 0,
    
    -- タイムスタンプ
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (pk, sk)
);

-- ===================================
-- インデックス戦略
-- ===================================

/*
IndexedDB インデックス戦略:
1. 単一フィールドインデックス:
   - user_id: ユーザー別のフィルタリング
   - status: 状態別のクエリ（pending, failed等）
   - next_retry_after: リトライ対象の効率的な取得

2. 複合インデックス:
   - [entity_type, entity_id, operation_type]: 重複チェック
   - [status, next_retry_after]: リトライ可能アイテムの取得
   - [bulk_operation_id, created_at]: Bulk操作の順序保持

DynamoDB インデックス戦略:
1. パーティションキーの設計:
   - ユーザー別にパーティション分割
   - ホットパーティション回避のための適切な分散

2. ソートキーの設計:
   - エンティティの一意性を保証
   - 効率的な範囲クエリをサポート

3. GSIの活用:
   - アクセスパターンに応じた複数のビュー
   - コスト最適化を考慮した設計
*/

-- ===================================
-- データ保持ポリシー
-- ===================================

/*
1. 完了した同期アイテム:
   - 7日後に自動削除（DynamoDB TTL使用）
   - 統計情報は別途保持

2. 失敗した同期アイテム:
   - 30日間保持
   - 手動クリーンアップも可能

3. 統計情報:
   - 90日間の詳細データ
   - 年次サマリーは永続保持
*/

-- ===================================
-- パフォーマンス最適化の考慮事項
-- ===================================

/*
1. データ圧縮:
   - dataフィールドはgzip圧縮を推奨
   - 大きなペイロードの効率的な保存

2. バッチ処理:
   - Bulk操作時は単一のレコードに集約
   - DynamoDBのBatchWriteItemを活用

3. 読み取り最適化:
   - 頻繁にアクセスされるフィールドにインデックス
   - プロジェクションで必要なフィールドのみ取得

4. 書き込み最適化:
   - 条件付き書き込みで競合を回避
   - アトミックカウンターの活用
*/