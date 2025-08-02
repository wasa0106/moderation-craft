# ModerationCraft テスト仕様書（逆生成）

## 分析概要

**分析日時**: 2025-08-02
**対象コードベース**: /Users/junya/Dev/moderation-craft
**テストカバレッジ**: 約20%（推定）
**生成テストケース数**: 80個
**実装推奨テスト数**: 60個

## 現在のテスト実装状況

### テストフレームワーク
- **単体テスト**: Vitest v3
- **統合テスト**: 未実装
- **E2Eテスト**: Playwright設定済み（未実装）
- **コードカバレッジ**: Vitest Coverage (c8)

### テストカバレッジ詳細

| ファイル/ディレクトリ | 行カバレッジ | 分岐カバレッジ | 関数カバレッジ |
|---------------------|-------------|-------------|-------------|
| src/lib/db/repositories/ | 85% | 75% | 90% |
| src/components/timer/ | 40% | 30% | 50% |
| src/components/schedule/ | 20% | 15% | 25% |
| src/components/layout/sidebar/ | 30% | 20% | 35% |
| src/app/api/ | 0% | 0% | 0% |
| src/lib/sync/ | 0% | 0% | 0% |
| src/hooks/ | 0% | 0% | 0% |
| **全体** | **20%** | **15%** | **25%** |

### テストカテゴリ別実装状況

#### 単体テスト
- [x] **BaseRepository**: base-repository.test.ts（包括的）
- [x] **TaskCard**: task-card.test.tsx（基本的）
- [x] **CombinedScheduleView**: combined-schedule-view.test.tsx
- [x] **Timer Page**: page.test.tsx
- [x] **Sidebar Components**: 3ファイル
- [x] **TaskMemo**: task-memo.test.tsx
- [ ] **Sync Service**: 未実装
- [ ] **Custom Hooks**: 未実装

#### 統合テスト
- [ ] **同期API**: 未実装
- [ ] **プル同期API**: 未実装
- [ ] **ヘルスチェックAPI**: 未実装
- [ ] **認証ミドルウェア**: 未実装

#### E2Eテスト
- [ ] **プロジェクト作成フロー**: 未実装
- [ ] **タイマー使用フロー**: 未実装
- [ ] **スケジュール管理フロー**: 未実装
- [ ] **オフライン→オンライン同期**: 未実装

## 生成されたテストケース

### API テストケース

#### POST /api/sync - データ同期

**正常系テスト**
```typescript
describe('POST /api/sync', () => {
  it('プロジェクト作成の同期が成功する', async () => {
    const response = await request(app)
      .post('/api/sync')
      .set('X-API-Key', 'test-api-key')
      .send({
        entity_type: 'project',
        operation: 'CREATE',
        payload: {
          id: 'proj_123',
          user_id: 'user_456',
          name: '新規プロジェクト',
          goal: 'テスト目標',
          deadline: '2025-12-31',
          status: 'active',
          version: 1
        }
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.syncedEntityId).toBe('proj_123');
    expect(response.body.syncedEntityType).toBe('project');
  });

  it('全エンティティタイプの同期をテスト', async () => {
    const entityTypes = [
      'project', 'big_task', 'small_task', 'work_session',
      'mood_entry', 'dopamine_entry', 'schedule_memo', 'sleep_schedule'
    ];

    for (const entityType of entityTypes) {
      const response = await request(app)
        .post('/api/sync')
        .set('X-API-Key', 'test-api-key')
        .send({
          entity_type: entityType,
          payload: createMockPayload(entityType)
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }
  });
});
```

**異常系テスト**
```typescript
describe('POST /api/sync - 異常系', () => {
  it('APIキーなしで401エラー', async () => {
    const response = await request(app)
      .post('/api/sync')
      .send({
        entity_type: 'project',
        payload: {}
      });
    
    expect(response.status).toBe(401);
    expect(response.body.error).toContain('API key is required');
  });

  it('無効なAPIキーで401エラー', async () => {
    const response = await request(app)
      .post('/api/sync')
      .set('X-API-Key', 'invalid-key')
      .send({
        entity_type: 'project',
        payload: {}
      });
    
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid API key');
  });

  it('必須パラメータ不足で400エラー', async () => {
    const response = await request(app)
      .post('/api/sync')
      .set('X-API-Key', 'test-api-key')
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('entity_type and payload are required');
  });

  it('未実装のエンティティタイプで400エラー', async () => {
    const response = await request(app)
      .post('/api/sync')
      .set('X-API-Key', 'test-api-key')
      .send({
        entity_type: 'unknown_entity',
        payload: {}
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('同期はまだ実装されていません');
  });
});
```

### UIコンポーネントテストケース

#### ProjectForm コンポーネント

**レンダリングテスト**
```typescript
describe('ProjectForm', () => {
  it('必要な入力フィールドが表示される', () => {
    render(<ProjectForm onSubmit={jest.fn()} />);
    
    expect(screen.getByLabelText('プロジェクト名')).toBeInTheDocument();
    expect(screen.getByLabelText('ゴール')).toBeInTheDocument();
    expect(screen.getByLabelText('期限')).toBeInTheDocument();
    expect(screen.getByText('カラー')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '作成' })).toBeInTheDocument();
  });

  it('編集モードで既存データが表示される', () => {
    const project = {
      id: 'proj_123',
      name: '既存プロジェクト',
      goal: '既存ゴール',
      deadline: '2025-12-31',
      status: 'active',
      color: 'hsl(200, 50%, 60%)'
    };

    render(<ProjectForm project={project} onSubmit={jest.fn()} />);
    
    expect(screen.getByDisplayValue('既存プロジェクト')).toBeInTheDocument();
    expect(screen.getByDisplayValue('既存ゴール')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2025-12-31')).toBeInTheDocument();
  });
});
```

**バリデーションテスト**
```typescript
describe('ProjectForm - バリデーション', () => {
  it('必須フィールドのエラーメッセージ', async () => {
    const mockSubmit = jest.fn();
    render(<ProjectForm onSubmit={mockSubmit} />);
    
    await userEvent.click(screen.getByRole('button', { name: '作成' }));
    
    expect(await screen.findByText('プロジェクト名は必須です')).toBeInTheDocument();
    expect(await screen.findByText('ゴールは必須です')).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('文字数制限のテスト', async () => {
    render(<ProjectForm onSubmit={jest.fn()} />);
    
    const longText = 'a'.repeat(101);
    await userEvent.type(screen.getByLabelText('プロジェクト名'), longText);
    await userEvent.click(screen.getByRole('button', { name: '作成' }));
    
    expect(await screen.findByText('プロジェクト名は100文字以内で入力してください')).toBeInTheDocument();
  });
});
```

### サービス層テストケース

#### SyncService 単体テスト

```typescript
describe('SyncService', () => {
  let syncService: SyncService;
  let mockSyncQueue: jest.Mocked<SyncQueueRepository>;

  beforeEach(() => {
    mockSyncQueue = createMockSyncQueue();
    syncService = new SyncService(mockSyncQueue);
  });

  describe('addToSyncQueue', () => {
    it('同期キューにアイテムを追加する', async () => {
      const operation = {
        entity_type: 'project',
        entity_id: 'proj_123',
        operation_type: 'CREATE',
        data: { name: 'Test Project' }
      };

      await syncService.addToSyncQueue(operation);

      expect(mockSyncQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...operation,
          status: 'pending',
          attempt_count: 0
        })
      );
    });

    it('sync_queueエンティティは同期キューに追加しない', async () => {
      const operation = {
        entity_type: 'sync_queue',
        entity_id: 'sync_123',
        operation_type: 'CREATE'
      };

      await syncService.addToSyncQueue(operation);

      expect(mockSyncQueue.create).not.toHaveBeenCalled();
    });
  });

  describe('processSyncQueue', () => {
    it('ペンディングアイテムを処理する', async () => {
      const pendingItems = [
        { id: '1', entity_type: 'project', status: 'pending' },
        { id: '2', entity_type: 'task', status: 'pending' }
      ];

      mockSyncQueue.getPendingItems.mockResolvedValue(pendingItems);
      mockApi.sync.mockResolvedValue({ success: true });

      await syncService.processSyncQueue();

      expect(mockApi.sync).toHaveBeenCalledTimes(2);
      expect(mockSyncQueue.markAsCompleted).toHaveBeenCalledTimes(2);
    });

    it('失敗時にリトライカウントを増やす', async () => {
      const pendingItem = {
        id: '1',
        entity_type: 'project',
        status: 'pending',
        attempt_count: 0
      };

      mockSyncQueue.getPendingItems.mockResolvedValue([pendingItem]);
      mockApi.sync.mockRejectedValue(new Error('Network error'));

      await syncService.processSyncQueue();

      expect(mockSyncQueue.incrementRetryCount).toHaveBeenCalledWith('1');
    });
  });
});
```

## パフォーマンステストケース

### 負荷テスト

```typescript
describe('パフォーマンステスト', () => {
  it('同期API - 100同時リクエスト処理', async () => {
    const requests = Array.from({ length: 100 }, (_, i) => ({
      entity_type: 'work_session',
      payload: {
        id: `session_${i}`,
        user_id: 'user_123',
        start_time: new Date().toISOString(),
        duration_seconds: 1800
      }
    }));

    const startTime = Date.now();
    const promises = requests.map(req =>
      request(app)
        .post('/api/sync')
        .set('X-API-Key', 'test-api-key')
        .send(req)
    );

    const responses = await Promise.all(promises);
    const endTime = Date.now();

    // 全リクエストが成功
    responses.forEach(res => {
      expect(res.status).toBe(200);
    });

    // 10秒以内に処理完了
    expect(endTime - startTime).toBeLessThan(10000);
  });

  it('IndexedDB - 大量データ読み込み性能', async () => {
    // 1000件のプロジェクトデータを作成
    const projects = Array.from({ length: 1000 }, (_, i) => ({
      name: `Project ${i}`,
      goal: `Goal ${i}`,
      user_id: 'user_123'
    }));

    const startTime = Date.now();
    await Promise.all(projects.map(p => projectRepository.create(p)));
    const endTime = Date.now();

    // 作成時間が5秒以内
    expect(endTime - startTime).toBeLessThan(5000);

    // 読み込みテスト
    const readStart = Date.now();
    const allProjects = await projectRepository.getByUserId('user_123');
    const readEnd = Date.now();

    expect(allProjects.length).toBe(1000);
    expect(readEnd - readStart).toBeLessThan(1000); // 1秒以内
  });
});
```

### セキュリティテスト

```typescript
describe('セキュリティテスト', () => {
  it('XSS攻撃の防御', async () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror="alert(\'XSS\')">',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>'
    ];

    for (const payload of xssPayloads) {
      const response = await request(app)
        .post('/api/sync')
        .set('X-API-Key', 'test-api-key')
        .send({
          entity_type: 'project',
          payload: {
            name: payload,
            goal: 'Test',
            user_id: 'user_123'
          }
        });

      // リクエストは成功するが、スクリプトは実行されない
      expect(response.status).toBe(200);
      
      // データベースに保存される際にサニタイズされているか確認
      const saved = await projectRepository.getById(response.body.syncedEntityId);
      expect(saved.name).not.toContain('<script>');
      expect(saved.name).not.toContain('javascript:');
    }
  });

  it('APIキーのブルートフォース攻撃対策', async () => {
    const attempts = [];
    
    // 100回の不正なAPIキーでアクセス
    for (let i = 0; i < 100; i++) {
      attempts.push(
        request(app)
          .post('/api/sync')
          .set('X-API-Key', `invalid-key-${i}`)
          .send({ entity_type: 'project', payload: {} })
      );
    }

    const responses = await Promise.all(attempts);
    
    // 全て401エラー
    responses.forEach(res => {
      expect(res.status).toBe(401);
    });

    // レート制限が適用されているか（未実装の場合は推奨事項として記載）
    // expect(responses[99].headers['x-ratelimit-remaining']).toBe('0');
  });
});
```

## E2Eテストケース

### タイマー使用フロー

```typescript
describe('タイマー使用フローE2E', () => {
  it('タスク選択からタイマー完了まで', async ({ page }) => {
    // タイマーページへ移動
    await page.goto('/timer');
    
    // タスクを選択
    await page.click('[data-testid="task-select"]');
    await page.click('[data-testid="task-option-1"]');
    
    // タイマー開始
    await page.click('[data-testid="timer-start"]');
    
    // タイマーが動作していることを確認
    await expect(page.locator('[data-testid="timer-display"]')).toContainText('00:00:01');
    
    // 気分記録
    await page.click('[data-testid="mood-button"]');
    await page.fill('[data-testid="mood-level"]', '4');
    await page.click('[data-testid="mood-save"]');
    
    // タイマー停止
    await page.click('[data-testid="timer-stop"]');
    
    // セッションが保存されたことを確認
    await expect(page.locator('[data-testid="session-list"]')).toContainText('セッション完了');
  });

  it('オフライン時の動作確認', async ({ page, context }) => {
    await page.goto('/timer');
    
    // オフラインモードに切り替え
    await context.setOffline(true);
    
    // タイマー開始（オフラインでも動作）
    await page.click('[data-testid="timer-start"]');
    await page.waitForTimeout(2000);
    await page.click('[data-testid="timer-stop"]');
    
    // 同期待ちインジケーター表示
    await expect(page.locator('[data-testid="sync-pending"]')).toBeVisible();
    
    // オンラインに復帰
    await context.setOffline(false);
    
    // 自動同期の確認
    await expect(page.locator('[data-testid="sync-success"]')).toBeVisible({ timeout: 10000 });
  });
});
```

## テスト環境設定

### データベーステスト設定

```typescript
// vitest.setup.ts
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { db } from '@/lib/db/database';

beforeEach(async () => {
  // IndexedDBをクリア
  await db.delete();
  await db.open();
  
  // 基本テストデータを投入
  await seedTestData();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// テストデータシード
async function seedTestData() {
  await db.users.add({
    id: 'test-user-1',
    name: 'テストユーザー',
    email: 'test@example.com',
    timezone: 'Asia/Tokyo',
    preferences: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}
```

### モック設定

```typescript
// APIモック
vi.mock('@/lib/sync/sync-service', () => ({
  SyncService: {
    getInstance: vi.fn(() => ({
      addToSyncQueue: vi.fn().mockResolvedValue(undefined),
      processSyncQueue: vi.fn().mockResolvedValue(undefined),
      startAutoSync: vi.fn(),
      stopAutoSync: vi.fn()
    }))
  }
}));

// 環境変数のモック
process.env.SYNC_API_KEY = 'test-api-key';
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
```

## 不足テストの優先順位

### 高優先度（即座に実装推奨）
1. **API統合テスト** - 全5エンドポイントのテスト
2. **E2Eテストスイート** - 主要ユーザーフロー（プロジェクト作成、タイマー使用、スケジュール管理）
3. **同期機能テスト** - オフライン→オンライン同期の動作確認

### 中優先度（次のスプリントで実装）
1. **カスタムフックテスト** - 12個のhooksのテスト
2. **Zustandストアテスト** - 5つのストアの状態管理テスト
3. **パフォーマンステスト** - 大量データ処理、同時アクセステスト

### 低優先度（継続的改善として実装）
1. **セキュリティテスト** - XSS、CSRF、SQLインジェクション対策
2. **ブラウザ互換性テスト** - Chrome、Firefox、Safari、Edge
3. **アクセシビリティテスト** - スクリーンリーダー対応、キーボードナビゲーション

## 推定実装工数

| カテゴリ | テスト数 | 推定工数 |
|---------|---------|----------|
| API統合テスト | 30 | 24時間 |
| UIコンポーネントテスト | 25 | 20時間 |
| E2Eテスト | 10 | 16時間 |
| カスタムフックテスト | 12 | 8時間 |
| ストアテスト | 5 | 4時間 |
| パフォーマンステスト | 5 | 8時間 |
| セキュリティテスト | 3 | 6時間 |
| **合計** | **90** | **86時間** |