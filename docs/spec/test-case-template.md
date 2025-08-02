# テストケーステンプレート

## 概要

本テンプレートは、ModerationCraftプロジェクトにおける標準的なテストケース記述形式を定義します。
すべてのテストケースはこのテンプレートに従って記述することで、一貫性と可読性を保ちます。

## テストケース基本情報テンプレート

```markdown
# テストケースID: TC-{機能}-{番号}

## 基本情報
- **テスト名**: {テストの簡潔な名前}
- **カテゴリ**: {単体/統合/E2E/性能/セキュリティ}
- **優先度**: {高/中/低}
- **関連要件**: {REQ-XXX, NFR-XXX}
- **推定工数**: {X時間}
- **実装状況**: {未実装/実装中/完了}

## テスト目的
{このテストで検証したい内容を1-2文で記述}

## 事前条件
- {テスト実行前に必要な状態や設定}
- {必要なテストデータ}
- {環境要件}

## テスト手順
1. {具体的な操作手順1}
2. {具体的な操作手順2}
3. {具体的な操作手順3}

## 期待結果
- [ ] {検証項目1}
- [ ] {検証項目2}
- [ ] {検証項目3}

## 事後条件
- {テスト実行後の状態}
- {クリーンアップ処理}

## 備考
- {特記事項}
- {既知の問題}
- {参考情報}
```

## カテゴリ別テンプレート

### 単体テスト (Unit Test)

```typescript
/**
 * テストケースID: TC-UNIT-001
 * テスト名: {コンポーネント名}の{機能}テスト
 * 関連要件: REQ-XXX
 */
describe('{コンポーネント名}', () => {
  // 事前条件: セットアップ
  beforeEach(() => {
    // モックの準備
    // テストデータの初期化
  });

  // 事後条件: クリーンアップ
  afterEach(() => {
    // リソースの解放
    // モックのリセット
  });

  describe('{機能グループ}', () => {
    it('{期待される動作の説明}', () => {
      // Arrange: テストデータの準備
      const testData = {...};
      
      // Act: テスト対象の実行
      const result = targetFunction(testData);
      
      // Assert: 期待結果の検証
      expect(result).toBe(expectedValue);
    });

    it('{エラーケースの説明}', () => {
      // エラー条件でのテスト
      expect(() => targetFunction(invalidData)).toThrow(ErrorType);
    });
  });
});
```

### 統合テスト (Integration Test)

```typescript
/**
 * テストケースID: TC-INT-001
 * テスト名: {API名}統合テスト
 * 関連要件: REQ-XXX
 */
describe('POST /api/{endpoint}', () => {
  let app: Application;
  
  beforeAll(async () => {
    // テスト用サーバーの起動
    app = await createTestApp();
  });

  afterAll(async () => {
    // サーバーの停止
    await app.close();
  });

  describe('正常系', () => {
    it('有効なリクエストで成功レスポンスを返す', async () => {
      // テストデータ
      const requestData = {
        field1: 'value1',
        field2: 'value2'
      };

      // APIリクエスト実行
      const response = await request(app)
        .post('/api/{endpoint}')
        .set('Authorization', 'Bearer test-token')
        .send(requestData);

      // レスポンス検証
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Object)
      });
    });
  });

  describe('異常系', () => {
    it('認証なしで401エラーを返す', async () => {
      const response = await request(app)
        .post('/api/{endpoint}')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Unauthorized');
    });
  });
});
```

### E2Eテスト (End-to-End Test)

```typescript
/**
 * テストケースID: TC-E2E-001
 * テスト名: {機能名}完全フローテスト
 * 関連要件: {ユーザーストーリー}
 */
import { test, expect } from '@playwright/test';

test.describe('{機能名}E2Eテスト', () => {
  // 事前条件
  test.beforeEach(async ({ page }) => {
    // ログイン処理
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');
    
    // 対象ページへ移動
    await page.goto('/{target-page}');
  });

  test('{シナリオ名}', async ({ page }) => {
    // Step 1: {操作内容}
    await page.click('[data-testid="action-button"]');
    await expect(page.locator('[data-testid="result"]')).toBeVisible();

    // Step 2: {操作内容}
    await page.fill('[data-testid="input-field"]', 'test value');
    
    // Step 3: {操作内容}
    await page.click('[data-testid="submit-button"]');
    
    // 期待結果の検証
    await expect(page).toHaveURL('/{expected-url}');
    await expect(page.locator('[data-testid="success-message"]')).toContainText('成功');
    
    // スクリーンショット取得（必要に応じて）
    await page.screenshot({ path: 'test-results/{test-name}.png' });
  });
});
```

### パフォーマンステスト (Performance Test)

```typescript
/**
 * テストケースID: TC-PERF-001
 * テスト名: {処理名}パフォーマンステスト
 * 関連要件: NFR-XXX
 */
describe('パフォーマンステスト: {処理名}', () => {
  const testCases = [
    { size: 10, maxTime: 100 },
    { size: 100, maxTime: 500 },
    { size: 1000, maxTime: 2000 },
    { size: 10000, maxTime: 10000 }
  ];

  testCases.forEach(({ size, maxTime }) => {
    it(`${size}件のデータを${maxTime}ms以内に処理する`, async () => {
      // テストデータ生成
      const testData = generateTestData(size);
      
      // 処理時間計測
      const startTime = performance.now();
      await processData(testData);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // 期待結果
      expect(duration).toBeLessThan(maxTime);
      
      // パフォーマンスログ
      console.log(`処理時間: ${duration.toFixed(2)}ms (${size}件)`);
    });
  });

  it('メモリ使用量が許容範囲内である', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // 大量データ処理
    await processLargeDataSet();
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
    
    expect(memoryIncrease).toBeLessThan(500); // 500MB以下
  });
});
```

### セキュリティテスト (Security Test)

```typescript
/**
 * テストケースID: TC-SEC-001
 * テスト名: {機能名}セキュリティテスト
 * 関連要件: NFR-XXX
 */
describe('セキュリティテスト: {機能名}', () => {
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '"><script>alert("XSS")</script>',
    '<img src=x onerror="alert(\'XSS\')">',
    'javascript:alert("XSS")'
  ];

  describe('XSS脆弱性テスト', () => {
    xssPayloads.forEach((payload, index) => {
      it(`XSSペイロード${index + 1}をブロックする`, async () => {
        const response = await request(app)
          .post('/api/{endpoint}')
          .send({ userInput: payload });

        // レスポンスにスクリプトが含まれていないことを確認
        expect(response.text).not.toContain('<script>');
        expect(response.text).not.toContain('javascript:');
        
        // 適切にエスケープされているか確認
        if (response.body.data) {
          expect(response.body.data).not.toContain(payload);
        }
      });
    });
  });

  describe('認証・認可テスト', () => {
    it('無効なトークンでアクセス拒否される', async () => {
      const response = await request(app)
        .get('/api/protected-resource')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('権限のないリソースへのアクセスが拒否される', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(403);
    });
  });
});
```

## テスト実装のベストプラクティス

### 1. テストの構造化
- **Arrange-Act-Assert** パターンの使用
- **Given-When-Then** 形式での記述
- 1つのテストで1つの振る舞いのみを検証

### 2. テストデータ管理
```typescript
// テストデータファクトリーの使用例
export const testFactory = {
  user: (overrides = {}) => ({
    id: 'user_test_001',
    name: 'テストユーザー',
    email: 'test@example.com',
    ...overrides
  }),
  
  project: (overrides = {}) => ({
    id: 'proj_test_001',
    name: 'テストプロジェクト',
    userId: 'user_test_001',
    ...overrides
  })
};
```

### 3. モックとスタブ
```typescript
// 外部依存のモック化
vi.mock('@/lib/external-service', () => ({
  ExternalService: {
    fetchData: vi.fn().mockResolvedValue({ success: true })
  }
}));
```

### 4. エラーメッセージ
```typescript
// 分かりやすいエラーメッセージ
expect(result, 'ユーザー作成後、IDが設定されるべき').toHaveProperty('id');
expect(items.length, `期待値: 5件, 実際: ${items.length}件`).toBe(5);
```

### 5. テストの独立性
- 各テストは他のテストに依存しない
- テスト実行順序に関わらず成功する
- 必要なデータは各テスト内で準備する

## チェックリスト

テストケース作成時の確認事項：

- [ ] テストケースIDが一意である
- [ ] 関連要件が明記されている
- [ ] 事前条件が明確である
- [ ] テスト手順が再現可能である
- [ ] 期待結果が具体的である
- [ ] エラーケースが含まれている
- [ ] パフォーマンス要件が考慮されている
- [ ] セキュリティ観点が含まれている
- [ ] テストデータがファクトリー化されている
- [ ] クリーンアップ処理が実装されている

## 更新履歴

- 2025-08-02: 初版作成
- テンプレートは継続的に改善・更新される