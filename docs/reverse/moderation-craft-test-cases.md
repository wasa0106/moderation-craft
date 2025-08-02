# ModerationCraft テストケース一覧（逆生成）

## テストケース概要

| ID | テスト名 | カテゴリ | 優先度 | 実装状況 | 推定工数 |
|----|----------|----------|--------|----------|----------|
| TC-001 | BaseRepository CRUD操作 | 単体 | 高 | ✅ | 完了 |
| TC-002 | TaskCardコンポーネント表示・操作 | 単体 | 中 | ✅ | 完了 |
| TC-003 | Sidebar Navigation | 単体 | 低 | ✅ | 完了 |
| TC-004 | 同期API正常系 | API | 高 | ❌ | 4h |
| TC-005 | 同期API異常系 | API | 高 | ❌ | 4h |
| TC-006 | 認証ミドルウェア | API | 高 | ❌ | 2h |
| TC-007 | プル同期API | API | 高 | ❌ | 3h |
| TC-008 | ProjectForm検証 | UI | 高 | ❌ | 3h |
| TC-009 | タイマー機能E2E | E2E | 高 | ❌ | 6h |
| TC-010 | オフライン同期E2E | E2E | 高 | ❌ | 8h |
| TC-011 | パフォーマンス負荷テスト | 性能 | 中 | ❌ | 4h |
| TC-012 | セキュリティ脆弱性テスト | セキュリティ | 中 | ❌ | 6h |

## 詳細テストケース

### TC-001: BaseRepository CRUD操作テスト ✅

**テスト目的**: リポジトリ基底クラスのCRUD操作を検証

**実装状況**: 完了

**テストケース**:
1. create - エンティティ作成とID/タイムスタンプ自動生成
2. getById - IDによる取得と存在しないIDの処理
3. update - 更新とupdated_at自動更新
4. delete - 削除と同期キューへの追加
5. list - フィルタリングとソート
6. count - エンティティ数のカウント

**実装ファイル**: `src/lib/db/repositories/__tests__/base-repository.test.ts`

---

### TC-004: 同期API正常系テスト ❌

**テスト目的**: データ同期APIの正常動作を検証

**事前条件**:
- テスト用APIキーが設定されている
- DynamoDBテスト環境が利用可能

**テストケース**:

#### 1. プロジェクト同期（CREATE）
```typescript
// テスト入力
{
  entity_type: 'project',
  operation: 'CREATE',
  payload: {
    id: 'proj_test_001',
    user_id: 'user_test',
    name: '新規プロジェクト',
    goal: 'テスト目標',
    deadline: '2025-12-31',
    status: 'active',
    version: 1,
    color: 'hsl(200, 50%, 60%)'
  }
}

// 期待結果
- HTTPステータス: 200
- response.body.success: true
- response.body.syncedEntityId: 'proj_test_001'
- response.body.syncedEntityType: 'project'
- DynamoDBに保存される
```

#### 2. タスク同期（UPDATE）
```typescript
// テスト入力
{
  entity_type: 'big_task',
  operation: 'UPDATE',
  payload: {
    id: 'task_test_001',
    name: '更新されたタスク',
    status: 'completed',
    actual_hours: 10
  }
}

// 期待結果
- HTTPステータス: 200
- 既存レコードが更新される
- updated_atが現在時刻に更新される
```

#### 3. ワークセッション同期（DELETE）
```typescript
// テスト入力
{
  entity_type: 'work_session',
  operation: 'DELETE',
  payload: {
    id: 'session_test_001',
    user_id: 'user_test'
  }
}

// 期待結果
- HTTPステータス: 200
- DynamoDBから削除される
```

**推定工数**: 4時間

---

### TC-005: 同期API異常系テスト ❌

**テスト目的**: エラーハンドリングとバリデーションを検証

**テストケース**:

#### 1. 認証エラー
- APIキーなし → 401 "API key is required"
- 無効なAPIキー → 401 "Invalid API key"

#### 2. バリデーションエラー
- entity_type未指定 → 400 "entity_type and payload are required"
- payload未指定 → 400 "entity_type and payload are required"
- 不明なentity_type → 400 "xxx の同期はまだ実装されていません"

#### 3. データベースエラー
- DynamoDB接続エラー → 500 "Database connection error"
- 書き込み権限エラー → 500 "Permission denied"

**推定工数**: 4時間

---

### TC-008: ProjectForm検証テスト ❌

**テスト目的**: プロジェクトフォームのUI動作とバリデーションを検証

**テストケース**:

#### 1. 初期表示
```typescript
describe('ProjectForm - 初期表示', () => {
  it('新規作成モードで空のフォームが表示される', () => {
    render(<ProjectForm onSubmit={jest.fn()} />);
    
    expect(screen.getByLabelText('プロジェクト名')).toHaveValue('');
    expect(screen.getByLabelText('ゴール')).toHaveValue('');
    expect(screen.getByLabelText('期限')).toHaveValue('');
    expect(screen.getByRole('button')).toHaveTextContent('作成');
  });

  it('編集モードで既存データが表示される', () => {
    const project = {
      id: 'proj_123',
      name: '既存プロジェクト',
      goal: '既存の目標',
      deadline: '2025-06-30'
    };
    
    render(<ProjectForm project={project} onSubmit={jest.fn()} />);
    
    expect(screen.getByLabelText('プロジェクト名')).toHaveValue('既存プロジェクト');
    expect(screen.getByRole('button')).toHaveTextContent('更新');
  });
});
```

#### 2. バリデーション
- プロジェクト名空 → "プロジェクト名は必須です"
- プロジェクト名101文字 → "プロジェクト名は100文字以内で入力してください"
- ゴール空 → "ゴールは必須です"
- ゴール501文字 → "ゴールは500文字以内で入力してください"

#### 3. フォーム送信
- 有効なデータでonSubmitが呼ばれる
- 送信中はボタンが無効化される
- エラー時はエラーメッセージが表示される

**推定工数**: 3時間

---

### TC-009: タイマー機能E2Eテスト ❌

**テスト目的**: タイマー機能の完全なユーザーフローを検証

**前提条件**:
- テストユーザーがログイン済み
- テスト用タスクが存在

**テストシナリオ**:

#### シナリオ1: 基本的なタイマー使用
1. /timerページにアクセス
2. タスク一覧から「デザイン作業」を選択
3. 「開始」ボタンをクリック
4. タイマーが「00:00:01」から開始することを確認
5. 10秒待機
6. 「停止」ボタンをクリック
7. セッションが履歴に追加されることを確認
8. 経過時間が正しく記録されることを確認

#### シナリオ2: 気分・ドーパミン記録
1. タイマー実行中に「気分」ボタンをクリック
2. 気分レベル（1-5）を選択
3. メモを入力（任意）
4. 保存してタイマーに戻る
5. 「ドーパミン」ボタンをクリック
6. イベント説明を入力
7. 保存してタイマーに戻る

#### シナリオ3: タスク切り替え
1. タイマー実行中に別のタスクを選択
2. 確認ダイアログが表示される
3. 「はい」を選択すると現在のセッションが終了
4. 新しいタスクでタイマーが開始

**期待結果**:
- タイマーの開始/停止が正常動作
- セッションデータがIndexedDBに保存
- 同期キューに追加される

**推定工数**: 6時間

---

### TC-010: オフライン同期E2Eテスト ❌

**テスト目的**: オフライン時の動作と同期処理を検証

**テストシナリオ**:

#### シナリオ1: オフライン時のデータ作成
1. ネットワークをオフラインに設定
2. 新規プロジェクトを作成
3. タスクを追加
4. タイマーでセッションを記録
5. 全操作が成功することを確認
6. 同期待ちインジケーターが表示される

#### シナリオ2: オンライン復帰時の自動同期
1. ネットワークをオンラインに戻す
2. 自動同期が開始される
3. 同期プログレスバーが表示される
4. 全データが同期される
5. 同期完了通知が表示される

#### シナリオ3: 同期競合の解決
1. 2つのデバイスで同じデータを編集
2. 両方をオフラインで更新
3. 順番にオンラインに戻す
4. 後からの更新が優先される（Last Write Wins）

**期待結果**:
- オフライン時も全機能が動作
- データはIndexedDBに保存
- オンライン復帰時に自動同期
- 競合は自動解決

**推定工数**: 8時間

---

### TC-011: パフォーマンス負荷テスト ❌

**テスト目的**: システムの性能限界と応答時間を検証

**テストケース**:

#### 1. 同時接続負荷テスト
```typescript
// 100ユーザーが同時にAPIアクセス
const users = 100;
const requestsPerUser = 10;

// 期待結果
- 全リクエストが成功（エラー率 < 1%）
- 平均応答時間 < 500ms
- 最大応答時間 < 2000ms
```

#### 2. データベース負荷テスト
```typescript
// 10,000件のタスクデータでの検索性能
const taskCount = 10000;

// 期待結果
- 全タスク取得 < 1000ms
- フィルタリング検索 < 500ms
- ページネーション（100件） < 200ms
```

#### 3. IndexedDB容量テスト
```typescript
// 1年分の作業データ（約50,000セッション）
const sessionCount = 50000;

// 期待結果
- データ保存成功
- 検索性能劣化なし
- ブラウザストレージ制限内
```

**推定工数**: 4時間

---

### TC-012: セキュリティ脆弱性テスト ❌

**テスト目的**: 一般的なセキュリティ脆弱性からの保護を検証

**テストケース**:

#### 1. XSS（クロスサイトスクリプティング）
```typescript
const xssPayloads = [
  '<script>alert("XSS")</script>',
  '"><script>alert("XSS")</script>',
  '<img src=x onerror="alert(\'XSS\')">',
  'javascript:alert("XSS")'
];

// 各入力フィールドでテスト
// 期待結果: スクリプトが実行されない、適切にエスケープされる
```

#### 2. APIキーの保護
```typescript
// ブラウザの開発者ツールでAPIキーが露出していないことを確認
// LocalStorage、SessionStorage、Cookieをチェック
// 期待結果: APIキーは環境変数のみ、クライアントには露出しない
```

#### 3. CORS設定
```typescript
// 異なるオリジンからのAPIアクセステスト
const maliciousOrigin = 'http://evil.com';

// 期待結果: CORSエラーでブロックされる
```

#### 4. レート制限（推奨実装）
```typescript
// 1分間に1000回のAPIリクエスト
// 期待結果: 429 Too Many Requestsエラー
```

**推定工数**: 6時間

---

## テスト実行手順

### 単体テスト
```bash
# 全単体テスト実行
npm test

# カバレッジ付き
npm run test:coverage

# 特定ファイルのみ
npm test src/lib/db/repositories/__tests__/base-repository.test.ts
```

### 統合テスト（未実装）
```bash
# API統合テスト
npm run test:integration

# 特定のAPIのみ
npm run test:integration -- --grep "sync API"
```

### E2Eテスト（未実装）
```bash
# Playwright E2Eテスト
npm run test:e2e

# ヘッドレスモード
npm run test:e2e:headless

# 特定のテストファイル
npm run test:e2e tests/e2e/timer-flow.spec.ts
```

## CI/CD統合推奨設定

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run unit tests
      run: npm test
      
    - name: Run integration tests
      run: npm run test:integration
      env:
        SYNC_API_KEY: ${{ secrets.TEST_API_KEY }}
        
    - name: Run E2E tests
      run: npm run test:e2e:headless
      
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```