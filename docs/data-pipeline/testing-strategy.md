# テスト戦略ドキュメント

## テスト概要

### テストピラミッド
```
        E2Eテスト (10%)
       /            \
      統合テスト (30%)
     /              \
    単体テスト (60%)
```

### カバレッジ目標
- 単体テスト: 80%以上
- 統合テスト: 70%以上
- E2Eテスト: 主要フロー100%

## 単体テスト

### Lambda関数テスト

**test/unit/export-dynamodb.test.js**:
```javascript
describe('Export DynamoDB Handler', () => {
  let ddbMock, s3Mock;
  
  beforeEach(() => {
    ddbMock = mockClient(DynamoDBDocumentClient);
    s3Mock = mockClient(S3Client);
    process.env.TABLE_NAME = 'test-table';
    process.env.BUCKET_NAME = 'test-bucket';
  });
  
  afterEach(() => {
    ddbMock.reset();
    s3Mock.reset();
  });
  
  describe('正常系', () => {
    test('データエクスポート成功', async () => {
      // Arrange
      const mockData = [
        { id: '1', name: 'Test 1', created_at: '2024-01-01' },
        { id: '2', name: 'Test 2', created_at: '2024-01-02' }
      ];
      
      ddbMock.on(ScanCommand).resolves({
        Items: mockData,
        LastEvaluatedKey: undefined
      });
      
      s3Mock.on(PutObjectCommand).resolves({
        ETag: '"abc123"'
      });
      
      // Act
      const result = await handler({ tableName: 'test-table' });
      
      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.itemCount).toBe(2);
      expect(body.s3Location).toContain('s3://test-bucket/');
    });
    
    test('ページネーション処理', async () => {
      // 複数ページのデータを処理
      ddbMock
        .on(ScanCommand)
        .resolvesOnce({
          Items: [{ id: '1' }],
          LastEvaluatedKey: { id: '1' }
        })
        .resolvesOnce({
          Items: [{ id: '2' }],
          LastEvaluatedKey: undefined
        });
      
      s3Mock.on(PutObjectCommand).resolves({});
      
      const result = await handler({});
      
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.itemCount).toBe(2);
      expect(ddbMock.calls()).toHaveLength(2);
    });
  });
  
  describe('異常系', () => {
    test('DynamoDBエラー', async () => {
      ddbMock.on(ScanCommand).rejects(new Error('DynamoDB error'));
      
      await expect(handler({})).rejects.toThrow('DynamoDB error');
    });
    
    test('S3エラー', async () => {
      ddbMock.on(ScanCommand).resolves({ Items: [{ id: '1' }] });
      s3Mock.on(PutObjectCommand).rejects(new Error('S3 error'));
      
      await expect(handler({})).rejects.toThrow('S3 error');
    });
  });
});
```

### データ正規化テスト

**test/unit/data-normalizer.test.js**:
```javascript
describe('DataNormalizer', () => {
  let normalizer;
  
  beforeEach(() => {
    normalizer = new DataNormalizer();
  });
  
  describe('Fitbitデータ正規化', () => {
    test('完全なデータの正規化', () => {
      const input = {
        user_id: 'user-123',
        date: '2024-02-01',
        sleep: {
          total_minutes: 450,
          efficiency: 85,
          stages: { deep: 90, rem: 120, light: 180, wake: 60 }
        },
        activity: {
          steps: 10000,
          distance: 7.5,
          calories: 2200,
          active_minutes: 45
        }
      };
      
      const result = normalizer.normalizeFitbitData(input);
      
      expect(result.source).toBe('fitbit');
      expect(result.health_metrics.sleep.duration_hours).toBe(7.5);
      expect(result.health_metrics.sleep.efficiency_percent).toBe(85);
      expect(result.health_metrics.activity.steps).toBe(10000);
    });
    
    test('欠損データの処理', () => {
      const input = {
        user_id: 'user-123',
        date: '2024-02-01',
        sleep: null,
        activity: { steps: 5000 }
      };
      
      const result = normalizer.normalizeFitbitData(input);
      
      expect(result.health_metrics.sleep.duration_hours).toBe(0);
      expect(result.health_metrics.sleep.efficiency_percent).toBeNull();
      expect(result.health_metrics.activity.steps).toBe(5000);
    });
  });
  
  describe('天候データ正規化', () => {
    test('AQI変換', () => {
      const testCases = [
        { aqi: 25, expected: 'good' },
        { aqi: 75, expected: 'moderate' },
        { aqi: 125, expected: 'unhealthy_sensitive' },
        { aqi: 175, expected: 'unhealthy' },
        { aqi: 250, expected: 'very_unhealthy' },
        { aqi: 350, expected: 'hazardous' }
      ];
      
      testCases.forEach(({ aqi, expected }) => {
        expect(normalizer.getAirQualityLevel(aqi)).toBe(expected);
      });
    });
    
    test('快適指数計算', () => {
      const testCases = [
        { temp: 10, humidity: 50, expected: 'cold' },
        { temp: 20, humidity: 50, expected: 'comfortable' },
        { temp: 30, humidity: 80, expected: 'very_hot' }
      ];
      
      testCases.forEach(({ temp, humidity, expected }) => {
        const result = normalizer.calculateComfortIndex({ 
          temperature: temp, 
          humidity: humidity 
        });
        expect(result).toBe(expected);
      });
    });
  });
});
```

### dbtモデルテスト

**dbt-moderation-craft/tests/test_productivity_calculations.sql**:
```sql
-- 生産性スコア計算の検証
WITH test_data AS (
    SELECT
        75 AS total_work_minutes,
        3 AS completed_tasks,
        4.5 AS avg_mood_rating,
        3.8 AS avg_dopamine_level
),
expected AS (
    SELECT 78.5 AS expected_score
),
actual AS (
    SELECT 
        ROUND(
            (75 / 480.0 * 40) +  -- 作業時間スコア
            (3 / 5.0 * 30) +     -- タスク完了スコア
            (4.5 / 5.0 * 20) +   -- 気分スコア
            (3.8 / 5.0 * 10),    -- ドーパミンスコア
            1
        ) AS actual_score
    FROM test_data
)
SELECT 
    CASE 
        WHEN actual_score = expected_score THEN 'PASS'
        ELSE 'FAIL: Expected ' || expected_score || ' but got ' || actual_score
    END AS test_result
FROM actual, expected
```

## 統合テスト

### API統合テスト

**test/integration/api-pipeline.test.js**:
```javascript
describe('データパイプライン統合テスト', () => {
  let testUserId;
  
  beforeAll(async () => {
    // テスト用ユーザーとデータをセットアップ
    testUserId = `test-user-${Date.now()}`;
    await setupTestData(testUserId);
  });
  
  afterAll(async () => {
    // テストデータをクリーンアップ
    await cleanupTestData(testUserId);
  });
  
  test('エンドツーエンドのデータフロー', async () => {
    // 1. DynamoDBにテストデータを作成
    await createTestSession(testUserId);
    
    // 2. エクスポートLambdaを実行
    const exportResult = await invokeLambda('export-dynamodb', {
      tableName: 'test-sessions',
      userId: testUserId
    });
    
    expect(exportResult.statusCode).toBe(200);
    
    // 3. S3にデータが保存されたことを確認
    const s3Object = await getS3Object(exportResult.s3Location);
    expect(s3Object).toBeDefined();
    
    // 4. dbtモデルを実行
    const dbtResult = await runDbtModel('stg_work_sessions');
    expect(dbtResult.success).toBe(true);
    
    // 5. DuckDBでクエリ実行
    const queryResult = await queryDuckDB(`
      SELECT COUNT(*) as count 
      FROM stg_work_sessions 
      WHERE user_id = '${testUserId}'
    `);
    
    expect(queryResult[0].count).toBeGreaterThan(0);
  });
  
  test('外部API統合フロー', async () => {
    // Fitbitモックサーバーを起動
    const mockServer = await startFitbitMock();
    
    try {
      // データ取得
      const result = await invokeLambda('fitbit-data-fetcher', {
        userId: testUserId,
        date: '2024-02-01'
      });
      
      expect(result.statusCode).toBe(200);
      
      // 正規化処理
      const normalizeResult = await invokeLambda('data-normalizer', {
        source: 'fitbit',
        inputKey: result.s3Key
      });
      
      expect(normalizeResult.statusCode).toBe(200);
      
      // 正規化データの検証
      const normalizedData = await getS3Object(normalizeResult.outputKey);
      expect(normalizedData.source).toBe('fitbit');
      expect(normalizedData.health_metrics).toBeDefined();
    } finally {
      await mockServer.stop();
    }
  });
});
```

### データ品質テスト

**test/integration/data-quality.test.js**:
```javascript
describe('データ品質保証テスト', () => {
  test('データ完全性チェック', async () => {
    const result = await queryDuckDB(`
      WITH data_quality AS (
        SELECT
          COUNT(*) as total_records,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT date) as unique_dates,
          SUM(CASE WHEN productivity_score IS NULL THEN 1 ELSE 0 END) as null_scores,
          AVG(productivity_score) as avg_score,
          MIN(date) as min_date,
          MAX(date) as max_date
        FROM mart_productivity_daily
        WHERE date >= CURRENT_DATE - INTERVAL '7 days'
      )
      SELECT * FROM data_quality
    `);
    
    expect(result[0].null_scores).toBe(0);
    expect(result[0].avg_score).toBeGreaterThan(0);
    expect(result[0].avg_score).toBeLessThanOrEqual(100);
  });
  
  test('参照整合性チェック', async () => {
    const orphanedRecords = await queryDuckDB(`
      SELECT COUNT(*) as orphaned
      FROM mart_wellness_correlation w
      LEFT JOIN dim_users u ON w.user_id = u.user_id
      WHERE u.user_id IS NULL
    `);
    
    expect(orphanedRecords[0].orphaned).toBe(0);
  });
  
  test('データ鮮度チェック', async () => {
    const staleness = await queryDuckDB(`
      SELECT 
        MAX(CURRENT_DATE - date) as days_behind
      FROM mart_productivity_daily
      WHERE user_id IN (
        SELECT user_id FROM dim_users WHERE is_active = true
      )
    `);
    
    expect(staleness[0].days_behind).toBeLessThanOrEqual(2);
  });
});
```

## E2Eテスト

### シナリオテスト

**test/e2e/user-journey.spec.ts**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('ユーザージャーニーテスト', () => {
  test('新規ユーザーのオンボーディング', async ({ page }) => {
    // 1. アプリにアクセス
    await page.goto('/');
    
    // 2. Fitbit連携
    await page.click('text=健康データを連携');
    await page.click('text=Fitbitと連携');
    
    // Fitbit OAuth画面をモック
    await page.waitForURL(/fitbit\.com/);
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'testpass');
    await page.click('text=Allow');
    
    // 3. アプリに戻る
    await page.waitForURL(/\/dashboard/);
    expect(await page.locator('text=連携完了').isVisible()).toBeTruthy();
    
    // 4. データ同期
    await page.click('text=データを同期');
    await page.waitForSelector('.sync-progress');
    await page.waitForSelector('text=同期完了', { timeout: 30000 });
    
    // 5. ダッシュボード確認
    await page.goto('/analytics/dashboard');
    expect(await page.locator('.correlation-heatmap').isVisible()).toBeTruthy();
    expect(await page.locator('.productivity-chart').isVisible()).toBeTruthy();
  });
  
  test('レポート生成フロー', async ({ page }) => {
    await page.goto('/analytics/dashboard');
    
    // データ更新
    await page.click('button:has-text("データ更新")');
    await expect(page.locator('.animate-spin')).toBeVisible();
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 });
    
    // タブ切り替え
    await page.click('text=相関分析');
    await expect(page.locator('.correlation-heatmap')).toBeVisible();
    
    await page.click('text=予測');
    await expect(page.locator('text=明日の生産性予測')).toBeVisible();
    
    // エクスポート
    await page.click('button:has-text("エクスポート")');
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toContain('report');
  });
});
```

## 負荷テスト

### パフォーマンステスト

**test/performance/load-test.js**:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // ウォームアップ
    { duration: '5m', target: 50 },   // 通常負荷
    { duration: '2m', target: 100 },  // ピーク負荷
    { duration: '5m', target: 100 },  // 持続負荷
    { duration: '2m', target: 0 },    // クールダウン
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95%が500ms以内
    errors: ['rate<0.05'],             // エラー率5%未満
  },
};

export default function () {
  const userId = `user-${__VU}-${__ITER}`;
  
  // データ取得API
  const fetchRes = http.post(
    'https://api.moderation-craft.com/pipeline/refresh',
    JSON.stringify({
      dataSources: ['fitbit', 'weather'],
      userId: userId,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(fetchRes, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  errorRate.add(fetchRes.status !== 200);
  
  sleep(1);
  
  // DuckDBクエリ
  const queryRes = http.post(
    'https://api.moderation-craft.com/analytics/query',
    JSON.stringify({
      query: 'SELECT * FROM productivity_daily WHERE user_id = ?',
      params: [userId],
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  check(queryRes, {
    'query status is 200': (r) => r.status === 200,
    'query time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  errorRate.add(queryRes.status !== 200);
  
  sleep(1);
}
```

### ストレステスト

**test/performance/stress-test.yml**:
```yaml
name: Stress Test
config:
  target: 'https://api.moderation-craft.com'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 100
      name: "Sustained load"
    - duration: 60
      arrivalRate: 200
      name: "Spike test"
  defaults:
    headers:
      Content-Type: 'application/json'

scenarios:
  - name: "Data Pipeline Stress"
    flow:
      - post:
          url: "/pipeline/export"
          json:
            tableName: "moderation-craft-sessions"
            format: "parquet"
          capture:
            - json: "$.jobId"
              as: "jobId"
      
      - think: 2
      
      - get:
          url: "/pipeline/status/{{ jobId }}"
          expect:
            - statusCode: 200
            - contentType: json
            - hasProperty: status
      
      - loop:
          - get:
              url: "/pipeline/status/{{ jobId }}"
          count: 5
          think: 5
```

## テスト自動化

### CI/CDパイプライン

**.github/workflows/test-pipeline.yml**:
```yaml
name: Test Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
  
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      localstack:
        image: localstack/localstack
        ports:
          - 4566:4566
        env:
          SERVICES: s3,dynamodb,lambda
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup test environment
        run: |
          npm ci
          npm run setup:test-env
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          AWS_ENDPOINT: http://localhost:4566
  
  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          TEST_URL: ${{ secrets.STAGING_URL }}
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
  
  performance-tests:
    runs-on: ubuntu-latest
    needs: e2e-tests
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Run k6 tests
        uses: grafana/k6-action@v0.3.0
        with:
          filename: test/performance/load-test.js
          flags: --out cloud
        env:
          K6_CLOUD_TOKEN: ${{ secrets.K6_CLOUD_TOKEN }}
```

## テストデータ管理

### テストデータ生成

**scripts/generate-test-data.js**:
```javascript
const faker = require('faker');

function generateTestUser() {
  return {
    user_id: faker.datatype.uuid(),
    email: faker.internet.email(),
    created_at: faker.date.past(),
  };
}

function generateTestSession(userId, date) {
  const startTime = faker.date.between(
    `${date}T06:00:00`,
    `${date}T22:00:00`
  );
  const duration = faker.datatype.number({ min: 15, max: 120 });
  
  return {
    session_id: faker.datatype.uuid(),
    user_id: userId,
    start_time: startTime,
    end_time: new Date(startTime.getTime() + duration * 60000),
    duration_minutes: duration,
    mood_rating: faker.datatype.number({ min: 1, max: 5 }),
    dopamine_level: faker.datatype.number({ min: 1, max: 5 }),
    productivity_score: faker.datatype.number({ min: 0, max: 100 }),
  };
}

function generateTestDataset(userCount = 10, daysBack = 30) {
  const users = Array.from({ length: userCount }, generateTestUser);
  const sessions = [];
  
  users.forEach(user => {
    for (let i = 0; i < daysBack; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const sessionsPerDay = faker.datatype.number({ min: 1, max: 5 });
      for (let j = 0; j < sessionsPerDay; j++) {
        sessions.push(generateTestSession(user.user_id, dateStr));
      }
    }
  });
  
  return { users, sessions };
}

module.exports = { generateTestDataset };
```

## テストレポート

### カバレッジレポート設定

**jest.config.js**:
```javascript
module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/.next/',
  ],
};
```

---

*最終更新: 2024年2月*
*テストチームリード: QAエンジニアリング部門*