# Phase 3: 分析基盤 - 詳細実装計画

## 概要
Phase 3では、dbtを使用したデータ変換パイプラインとDuckDB WASMによるブラウザ内分析環境を構築します。

## Week 6: dbtプロジェクト初期化

### Day 1-2: プロジェクト構造設計

#### dbtプロジェクト構成
```
dbt-moderation-craft/
├── dbt_project.yml
├── profiles.yml
├── macros/
│   ├── get_custom_schema.sql
│   ├── date_utils.sql
│   └── quality_checks.sql
├── models/
│   ├── staging/
│   │   ├── _staging.yml
│   │   ├── stg_fitbit_sleep.sql
│   │   ├── stg_fitbit_activity.sql
│   │   ├── stg_weather_daily.sql
│   │   └── stg_work_sessions.sql
│   ├── intermediate/
│   │   ├── _intermediate.yml
│   │   ├── int_daily_health_summary.sql
│   │   ├── int_environmental_factors.sql
│   │   └── int_productivity_metrics.sql
│   └── marts/
│       ├── _marts.yml
│       ├── mart_productivity_daily.sql
│       ├── mart_wellness_correlation.sql
│       └── mart_environmental_impact.sql
├── tests/
│   ├── generic/
│   └── singular/
├── seeds/
│   └── reference_data/
└── snapshots/
    └── snapshot_user_metrics.sql
```

#### dbt_project.yml
```yaml
name: 'moderation_craft'
version: '1.0.0'
config-version: 2

profile: 'moderation_craft'

model-paths: ["models"]
analysis-paths: ["analyses"]
test-paths: ["tests"]
seed-paths: ["seeds"]
macro-paths: ["macros"]
snapshot-paths: ["snapshots"]

target-path: "target"
clean-targets:
  - "target"
  - "dbt_packages"

models:
  moderation_craft:
    +materialized: view
    staging:
      +materialized: view
      +schema: staging
    intermediate:
      +materialized: table
      +schema: intermediate
    marts:
      +materialized: table
      +schema: gold
      +tags: ['daily_refresh']

vars:
  start_date: '2024-01-01'
  timezone: 'Asia/Tokyo'
  
tests:
  +store_failures: true
  +severity: warn
```

### Day 3-4: 開発環境構築

#### DuckDB接続設定

**profiles.yml**:
```yaml
moderation_craft:
  outputs:
    dev:
      type: duckdb
      path: 'moderation_craft_dev.duckdb'
      extensions:
        - httpfs
        - parquet
      settings:
        s3_region: 'ap-northeast-1'
        s3_access_key_id: "{{ env_var('AWS_ACCESS_KEY_ID') }}"
        s3_secret_access_key: "{{ env_var('AWS_SECRET_ACCESS_KEY') }}"
    
    prod:
      type: duckdb
      path: 's3://moderation-craft-data/duckdb/prod.duckdb'
      extensions:
        - httpfs
        - parquet
      settings:
        s3_region: 'ap-northeast-1'
        s3_access_key_id: "{{ env_var('AWS_ACCESS_KEY_ID') }}"
        s3_secret_access_key: "{{ env_var('AWS_SECRET_ACCESS_KEY') }}"
      
  target: dev
```

#### マクロ定義

**macros/date_utils.sql**:
```sql
{% macro date_spine(start_date, end_date) %}
  WITH RECURSIVE dates AS (
    SELECT DATE '{{ start_date }}' as date_day
    UNION ALL
    SELECT date_day + INTERVAL '1 day'
    FROM dates
    WHERE date_day < DATE '{{ end_date }}'
  )
  SELECT * FROM dates
{% endmacro %}

{% macro get_jst_timestamp() %}
  CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'
{% endmacro %}

{% macro days_ago(n) %}
  CURRENT_DATE - INTERVAL '{{ n }} days'
{% endmacro %}
```

### Day 5: CI/CD設定

#### GitHub Actions for dbt

**.github/workflows/dbt-ci.yml**:
```yaml
name: dbt CI

on:
  push:
    branches: [main, develop]
    paths:
      - 'dbt-moderation-craft/**'
  pull_request:
    branches: [main]
    paths:
      - 'dbt-moderation-craft/**'

env:
  DBT_PROFILES_DIR: ./dbt-moderation-craft
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      
      - name: Install dependencies
        run: |
          pip install dbt-duckdb==1.7.0
          pip install sqlfluff==2.3.0
      
      - name: Lint SQL
        run: |
          cd dbt-moderation-craft
          sqlfluff lint models/ --dialect duckdb
      
      - name: Test database connection
        run: |
          cd dbt-moderation-craft
          dbt debug
      
      - name: Test dbt models
        run: |
          cd dbt-moderation-craft
          dbt deps
          dbt seed
          dbt run --models staging
          dbt test

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      
      - name: Install dbt
        run: pip install dbt-duckdb==1.7.0
      
      - name: Run dbt models
        run: |
          cd dbt-moderation-craft
          dbt deps
          dbt run --target prod
          dbt test --target prod
      
      - name: Generate documentation
        run: |
          cd dbt-moderation-craft
          dbt docs generate --target prod
          
      - name: Upload docs to S3
        run: |
          aws s3 sync dbt-moderation-craft/target/ \
            s3://moderation-craft-data/dbt-docs/ \
            --exclude "*" \
            --include "*.json" \
            --include "*.html"
```

## Week 7: 基本モデル作成

### Day 1-2: ステージング層

#### Fitbitデータステージング

**models/staging/stg_fitbit_sleep.sql**:
```sql
{{ config(
    materialized='incremental',
    unique_key='id',
    on_schema_change='fail'
) }}

WITH source_data AS (
    SELECT 
        user_id,
        date,
        json_extract_string(data, '$.sleep.total_minutes') AS total_minutes,
        json_extract_string(data, '$.sleep.efficiency') AS efficiency,
        json_extract_string(data, '$.sleep.stages.deep') AS deep_minutes,
        json_extract_string(data, '$.sleep.stages.light') AS light_minutes,
        json_extract_string(data, '$.sleep.stages.rem') AS rem_minutes,
        json_extract_string(data, '$.sleep.stages.wake') AS wake_minutes,
        json_extract_string(data, '$.sleep.start_time') AS start_time,
        json_extract_string(data, '$.sleep.end_time') AS end_time,
        json_extract_string(data, '$.fetched_at') AS fetched_at
    FROM 
        read_json_auto('s3://moderation-craft-data/raw/external/fitbit/integrated/dt=*/user_*.json')
    {% if is_incremental() %}
    WHERE date > (SELECT MAX(date) FROM {{ this }})
    {% endif %}
),

cleaned AS (
    SELECT
        MD5(CONCAT(user_id, '::', date)) AS id,
        user_id,
        DATE(date) AS sleep_date,
        TRY_CAST(total_minutes AS INTEGER) AS total_sleep_minutes,
        TRY_CAST(efficiency AS DECIMAL(5,2)) AS sleep_efficiency,
        TRY_CAST(deep_minutes AS INTEGER) AS deep_sleep_minutes,
        TRY_CAST(light_minutes AS INTEGER) AS light_sleep_minutes,
        TRY_CAST(rem_minutes AS INTEGER) AS rem_sleep_minutes,
        TRY_CAST(wake_minutes AS INTEGER) AS wake_minutes,
        TRY_CAST(start_time AS TIMESTAMP) AS sleep_start_time,
        TRY_CAST(end_time AS TIMESTAMP) AS sleep_end_time,
        TRY_CAST(fetched_at AS TIMESTAMP) AS fetched_at,
        {{ get_jst_timestamp() }} AS processed_at
    FROM source_data
    WHERE total_minutes IS NOT NULL
)

SELECT 
    *,
    -- 派生メトリクス
    ROUND(total_sleep_minutes / 60.0, 2) AS total_sleep_hours,
    ROUND(deep_sleep_minutes * 100.0 / NULLIF(total_sleep_minutes, 0), 2) AS deep_sleep_percent,
    ROUND(rem_sleep_minutes * 100.0 / NULLIF(total_sleep_minutes, 0), 2) AS rem_sleep_percent,
    CASE 
        WHEN sleep_efficiency >= 85 THEN 'good'
        WHEN sleep_efficiency >= 75 THEN 'fair'
        ELSE 'poor'
    END AS sleep_quality_category
FROM cleaned
```

**models/staging/stg_work_sessions.sql**:
```sql
{{ config(
    materialized='incremental',
    unique_key='session_id',
    on_schema_change='sync_all_columns'
) }}

WITH raw_sessions AS (
    SELECT *
    FROM read_parquet('s3://moderation-craft-data/raw/internal/dynamodb-exports/year=*/month=*/day=*/moderation-craft-sessions/*.parquet')
    {% if is_incremental() %}
    WHERE DATE(created_at) > {{ days_ago(3) }}
    {% endif %}
),

processed AS (
    SELECT
        id AS session_id,
        user_id,
        project_id,
        small_task_id,
        DATE(start_time) AS session_date,
        start_time,
        end_time,
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60 AS duration_minutes,
        mood_rating,
        dopamine_level,
        notes,
        created_at,
        updated_at
    FROM raw_sessions
    WHERE end_time IS NOT NULL
      AND start_time < end_time
)

SELECT 
    *,
    -- タイムゾーン調整
    start_time AT TIME ZONE 'Asia/Tokyo' AS start_time_jst,
    end_time AT TIME ZONE 'Asia/Tokyo' AS end_time_jst,
    -- 時間帯分類
    CASE 
        WHEN EXTRACT(HOUR FROM start_time) < 6 THEN 'early_morning'
        WHEN EXTRACT(HOUR FROM start_time) < 9 THEN 'morning'
        WHEN EXTRACT(HOUR FROM start_time) < 12 THEN 'late_morning'
        WHEN EXTRACT(HOUR FROM start_time) < 15 THEN 'afternoon'
        WHEN EXTRACT(HOUR FROM start_time) < 18 THEN 'late_afternoon'
        WHEN EXTRACT(HOUR FROM start_time) < 21 THEN 'evening'
        ELSE 'night'
    END AS time_slot,
    -- 生産性スコア（仮）
    CASE 
        WHEN duration_minutes >= 25 AND duration_minutes <= 30 THEN 100  -- ポモドーロ完璧
        WHEN duration_minutes >= 20 AND duration_minutes <= 35 THEN 80
        WHEN duration_minutes >= 15 AND duration_minutes <= 45 THEN 60
        ELSE 40
    END AS session_productivity_score
FROM processed
```

### Day 3-4: 中間層モデル

**models/intermediate/int_daily_health_summary.sql**:
```sql
{{ config(
    materialized='table',
    unique_key='id'
) }}

WITH sleep_data AS (
    SELECT 
        user_id,
        sleep_date AS date,
        total_sleep_hours,
        sleep_efficiency,
        deep_sleep_percent,
        rem_sleep_percent,
        sleep_quality_category
    FROM {{ ref('stg_fitbit_sleep') }}
),

activity_data AS (
    SELECT
        user_id,
        activity_date AS date,
        steps,
        distance_km,
        calories_burned,
        active_minutes,
        sedentary_minutes
    FROM {{ ref('stg_fitbit_activity') }}
),

heart_data AS (
    SELECT
        user_id,
        DATE(measurement_date) AS date,
        AVG(resting_heart_rate) AS avg_resting_hr,
        AVG(heart_rate_variability) AS avg_hrv
    FROM {{ ref('stg_fitbit_heart') }}
    GROUP BY user_id, DATE(measurement_date)
),

combined AS (
    SELECT
        COALESCE(s.user_id, a.user_id, h.user_id) AS user_id,
        COALESCE(s.date, a.date, h.date) AS date,
        -- 睡眠メトリクス
        s.total_sleep_hours,
        s.sleep_efficiency,
        s.deep_sleep_percent,
        s.rem_sleep_percent,
        s.sleep_quality_category,
        -- 活動メトリクス
        a.steps,
        a.distance_km,
        a.calories_burned,
        a.active_minutes,
        a.sedentary_minutes,
        -- 心拍メトリクス
        h.avg_resting_hr,
        h.avg_hrv
    FROM sleep_data s
    FULL OUTER JOIN activity_data a
        ON s.user_id = a.user_id AND s.date = a.date
    FULL OUTER JOIN heart_data h
        ON COALESCE(s.user_id, a.user_id) = h.user_id 
        AND COALESCE(s.date, a.date) = h.date
)

SELECT
    MD5(CONCAT(user_id, '::', date)) AS id,
    user_id,
    date,
    -- 睡眠スコア計算
    ROUND(
        COALESCE(total_sleep_hours / 8.0 * 30, 0) +
        COALESCE(sleep_efficiency / 100.0 * 30, 0) +
        COALESCE(deep_sleep_percent / 20.0 * 20, 0) +
        COALESCE(rem_sleep_percent / 25.0 * 20, 0),
        2
    ) AS sleep_score,
    -- 活動スコア計算
    ROUND(
        LEAST(COALESCE(steps / 10000.0 * 40, 0), 40) +
        LEAST(COALESCE(active_minutes / 30.0 * 30, 0), 30) +
        LEAST(COALESCE(calories_burned / 2000.0 * 30, 0), 30),
        2
    ) AS activity_score,
    -- 回復スコア（HRVベース）
    CASE
        WHEN avg_hrv IS NULL THEN NULL
        WHEN avg_hrv >= 50 THEN 100
        WHEN avg_hrv >= 40 THEN 80
        WHEN avg_hrv >= 30 THEN 60
        WHEN avg_hrv >= 20 THEN 40
        ELSE 20
    END AS recovery_score,
    -- 詳細データ
    total_sleep_hours,
    sleep_efficiency,
    deep_sleep_percent,
    rem_sleep_percent,
    sleep_quality_category,
    steps,
    distance_km,
    calories_burned,
    active_minutes,
    sedentary_minutes,
    avg_resting_hr,
    avg_hrv,
    CURRENT_TIMESTAMP AS calculated_at
FROM combined
```

### Day 5: データ品質テスト

**tests/singular/test_data_completeness.sql**:
```sql
-- 過去7日間のデータ完全性チェック
WITH expected_dates AS (
    {{ date_spine(days_ago(7), 'CURRENT_DATE') }}
),

actual_data AS (
    SELECT DISTINCT
        user_id,
        date
    FROM {{ ref('int_daily_health_summary') }}
    WHERE date >= {{ days_ago(7) }}
),

missing_data AS (
    SELECT 
        u.user_id,
        d.date_day AS missing_date
    FROM (SELECT DISTINCT user_id FROM actual_data) u
    CROSS JOIN expected_dates d
    LEFT JOIN actual_data a
        ON u.user_id = a.user_id AND d.date_day = a.date
    WHERE a.date IS NULL
)

SELECT 
    COUNT(*) AS missing_records,
    STRING_AGG(CONCAT(user_id, ':', missing_date), ', ') AS missing_details
FROM missing_data
HAVING COUNT(*) > 0
```

## Week 8: DuckDB統合

### Day 1-2: WASM版セットアップ

#### DuckDB WASM初期化

**src/lib/analytics/duckdb-client.ts**:
```typescript
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

export class DuckDBClient {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  
  async initialize() {
    const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
      mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
      },
      eh: {
        mainModule: duckdb_wasm_eh,
        mainWorker: eh_worker,
      },
    };
    
    // Select bundle based on browser support
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
    
    const worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger();
    this.db = new duckdb.AsyncDuckDB(logger, worker);
    
    await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    this.conn = await this.db.connect();
    
    // S3設定
    await this.configureS3();
    
    // 拡張機能のロード
    await this.loadExtensions();
  }
  
  private async configureS3() {
    if (!this.conn) throw new Error('Database not initialized');
    
    // S3アクセス設定
    await this.conn.query(`
      SET s3_region='ap-northeast-1';
      SET s3_access_key_id='${process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID}';
      SET s3_secret_access_key='${process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY}';
    `);
  }
  
  private async loadExtensions() {
    if (!this.conn) throw new Error('Database not initialized');
    
    // HTTPFSとParquet拡張をインストール・ロード
    await this.conn.query(`
      INSTALL httpfs;
      LOAD httpfs;
      INSTALL parquet;
      LOAD parquet;
    `);
  }
  
  async query(sql: string, params?: any[]): Promise<any[]> {
    if (!this.conn) throw new Error('Database not initialized');
    
    const result = params 
      ? await this.conn.query(sql, params)
      : await this.conn.query(sql);
    
    return result.toArray().map((row) => row.toJSON());
  }
  
  async createView(name: string, query: string) {
    if (!this.conn) throw new Error('Database not initialized');
    
    await this.conn.query(`
      CREATE OR REPLACE VIEW ${name} AS ${query}
    `);
  }
  
  async loadParquetFromS3(viewName: string, s3Path: string) {
    await this.createView(viewName, `
      SELECT * FROM read_parquet('${s3Path}')
    `);
  }
  
  async close() {
    if (this.conn) {
      await this.conn.close();
    }
    if (this.db) {
      await this.db.terminate();
    }
  }
}
```

### Day 3-4: S3接続設定

#### データマート接続

**src/hooks/useDuckDB.ts**:
```typescript
import { useEffect, useState, useCallback } from 'react';
import { DuckDBClient } from '@/lib/analytics/duckdb-client';

export function useDuckDB() {
  const [client, setClient] = useState<DuckDBClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    
    const initializeClient = async () => {
      try {
        const duckdbClient = new DuckDBClient();
        await duckdbClient.initialize();
        
        // データマートをビューとして登録
        await duckdbClient.loadParquetFromS3(
          'productivity_daily',
          's3://moderation-craft-data/gold/mart_productivity_daily/*.parquet'
        );
        
        await duckdbClient.loadParquetFromS3(
          'wellness_correlation',
          's3://moderation-craft-data/gold/mart_wellness_correlation/*.parquet'
        );
        
        if (isMounted) {
          setClient(duckdbClient);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };
    
    initializeClient();
    
    return () => {
      isMounted = false;
      client?.close();
    };
  }, []);
  
  const query = useCallback(async (sql: string, params?: any[]) => {
    if (!client) throw new Error('DuckDB client not initialized');
    return client.query(sql, params);
  }, [client]);
  
  return { query, loading, error };
}
```

### Day 5: パフォーマンステスト

#### ベンチマークスクリプト

**benchmarks/duckdb-performance.js**:
```javascript
const { DuckDBClient } = require('../dist/lib/analytics/duckdb-client');

async function runBenchmarks() {
  const client = new DuckDBClient();
  await client.initialize();
  
  const benchmarks = [
    {
      name: 'Simple aggregation',
      query: `
        SELECT 
          user_id,
          AVG(total_work_minutes) as avg_work,
          COUNT(*) as days
        FROM productivity_daily
        GROUP BY user_id
      `
    },
    {
      name: 'Time series analysis',
      query: `
        SELECT 
          date,
          SUM(total_work_minutes) as total_work,
          AVG(sleep_score) as avg_sleep,
          AVG(activity_score) as avg_activity
        FROM productivity_daily
        WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY date
        ORDER BY date
      `
    },
    {
      name: 'Correlation calculation',
      query: `
        SELECT 
          CORR(sleep_score, productivity_score) as sleep_productivity_corr,
          CORR(activity_score, productivity_score) as activity_productivity_corr,
          CORR(stress_level, productivity_score) as stress_productivity_corr
        FROM wellness_correlation
        WHERE user_id = 'test-user'
      `
    },
    {
      name: 'Window functions',
      query: `
        WITH ranked_days AS (
          SELECT 
            date,
            productivity_score,
            LAG(productivity_score) OVER (ORDER BY date) as prev_score,
            AVG(productivity_score) OVER (
              ORDER BY date 
              ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ) as moving_avg_7d
          FROM productivity_daily
          WHERE user_id = 'test-user'
        )
        SELECT * FROM ranked_days
        WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      `
    }
  ];
  
  console.log('Running DuckDB performance benchmarks...\n');
  
  for (const benchmark of benchmarks) {
    const start = performance.now();
    const result = await client.query(benchmark.query);
    const duration = performance.now() - start;
    
    console.log(`${benchmark.name}:`);
    console.log(`  Duration: ${duration.toFixed(2)}ms`);
    console.log(`  Rows returned: ${result.length}`);
    console.log('');
  }
  
  await client.close();
}

runBenchmarks().catch(console.error);
```

## 成果物チェックリスト

### Week 6 完了基準
- [ ] dbtプロジェクト構造確立
- [ ] DuckDB接続設定完了
- [ ] CI/CDパイプライン稼働
- [ ] 開発環境構築ドキュメント作成

### Week 7 完了基準
- [ ] ステージング層モデル作成
- [ ] 中間層モデル作成
- [ ] データ品質テスト実装
- [ ] モデルドキュメント生成

### Week 8 完了基準
- [ ] DuckDB WASM統合完了
- [ ] S3データ直接クエリ可能
- [ ] パフォーマンステスト合格
- [ ] フロントエンド統合完了

## トラブルシューティング

### よくある問題

| 問題 | 原因 | 解決策 |
|------|------|--------|
| dbt compile エラー | SQLシンタックスエラー | sqlfluffでリント、DuckDB固有の構文確認 |
| S3アクセス拒否 | 認証情報不足 | AWS認証情報の環境変数確認 |
| DuckDB WASM起動失敗 | ブラウザ非対応 | SharedArrayBuffer有効化、CORS設定確認 |
| クエリパフォーマンス低下 | インデックス不足 | パーティション最適化、マテリアライズド変更 |

## 次のフェーズへの準備

### Phase 4に必要な事前準備
1. Hugging Face APIトークン取得
2. 統計ライブラリの選定
3. 可視化ライブラリ（Chart.js/D3.js）の学習
4. MLモデルの選定

---

*最終更新: 2024年2月*
*Phase 3 リード: アナリティクスチーム*