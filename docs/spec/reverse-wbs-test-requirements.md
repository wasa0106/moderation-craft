# リバースWBS機能 テスト要件定義書

## 概要

本書は、ModerationCraftのリバースWBS機能に対する包括的なテスト戦略と要件を定義します。リバースWBS機能は、タスク分解に不慣れなユーザーが大きな目標から適切な粒度のタスクに分解できるよう支援する重要な機能であり、高品質なテストによって機能の信頼性とユーザビリティを保証します。

## テスト目的と範囲

### テスト目的

- **機能検証**: リバースWBS機能が要件定義書（REQ-001〜REQ-404）に準拠していることを確認
- **品質保証**: ユーザーが安心して使用できる品質レベルの達成
- **リグレッション防止**: 将来の変更による既存機能への影響を防止
- **パフォーマンス確保**: 大量のタスクでも快適に動作することを保証
- **セキュリティ確保**: ユーザーデータの安全性を検証

### テスト範囲

#### 対象機能
1. AI提案機能（目標からタスク分解）
2. タスク階層管理（最大10階層）
3. 依存関係設定・循環検出
4. ドラッグ&ドロップによる編集
5. オフライン対応・同期機能
6. プロジェクトへの変換・保存

#### 対象外
- 既存のプロジェクト管理機能（別途テスト済み）
- 基本的なUIコンポーネント（shadcn/ui標準）
- 外部AIサービスの内部動作

## ユーザストーリー別テスト要件

### ストーリー1: 初心者のタスク分解

**ユーザーストーリー**: タスク分解に不慣れな個人創作者として、大きな目標から適切な粒度のタスクに分解したい

**テスト要件**:
- TC-RW-001: 目標入力からAI提案生成までの基本フロー
- TC-RW-002: AI提案の品質検証（適切な粒度、論理的な階層）
- TC-RW-003: 提案されたタスクの編集・カスタマイズ
- TC-RW-004: 不適切な入力に対するエラーハンドリング

### ストーリー2: 時間見積もりの最適化

**ユーザーストーリー**: 作業時間の見積もりが苦手なユーザーとして、AIの支援を受けながら現実的な時間配分を設定したい

**テスト要件**:
- TC-RW-005: AI提案時間の妥当性検証
- TC-RW-006: 時間見積もりの手動調整
- TC-RW-007: 合計時間の自動計算と警告表示
- TC-RW-008: 見積もり時間の境界値テスト（5分〜9999時間）

### ストーリー3: 依存関係の可視化

**ユーザーストーリー**: プロジェクトの全体像を把握したいユーザーとして、タスク間の依存関係を視覚的に確認したい

**テスト要件**:
- TC-RW-009: 依存関係の設定と表示
- TC-RW-010: 循環依存の検出と防止
- TC-RW-011: 依存関係の視覚的表現（線、矢印）
- TC-RW-012: 複雑な依存関係のパフォーマンス

## テストレベル分類

### レベル1: 単体テスト（Unit Tests）

#### 対象コンポーネント
1. **ReverseWBSForm**: 目標入力フォーム
2. **AITaskSuggestion**: AI提案表示コンポーネント
3. **TaskHierarchyEditor**: タスク階層編集
4. **DependencyGraph**: 依存関係グラフ
5. **TimeEstimationCalculator**: 時間計算ユーティリティ

#### テストケース例
```typescript
describe('ReverseWBSForm', () => {
  it('目標入力時にバリデーションが動作する', () => {
    // 空入力、最大文字数超過、特殊文字
  });
  
  it('AI提案ボタンが適切に有効/無効化される', () => {
    // 入力状態、ローディング状態、エラー状態
  });
});
```

### レベル2: 統合テスト（Integration Tests）

#### 対象API
1. **POST /api/reverse-wbs/suggest**: AI提案生成
2. **POST /api/reverse-wbs/validate**: 依存関係検証
3. **POST /api/reverse-wbs/convert**: プロジェクト変換

#### テストケース例
```typescript
describe('AI提案API統合テスト', () => {
  it('有効な目標でタスク提案が生成される', async () => {
    const response = await request(app)
      .post('/api/reverse-wbs/suggest')
      .send({ goal: 'Webアプリケーションを作成する' });
    
    expect(response.status).toBe(200);
    expect(response.body.tasks).toHaveLength(greaterThan(0));
    expect(response.body.tasks[0]).toHaveProperty('name');
    expect(response.body.tasks[0]).toHaveProperty('estimatedHours');
  });
});
```

### レベル3: E2Eテスト（End-to-End Tests）

#### 主要シナリオ
1. **完全なリバースWBS作成フロー**
   - 目標入力 → AI提案 → 編集 → 保存
2. **オフライン動作確認**
   - オフライン時のローカル保存
   - オンライン復帰時の同期
3. **大規模データ処理**
   - 100タスク以上のWBS作成

#### テストケース例
```typescript
test('リバースWBS完全フロー', async ({ page }) => {
  // 1. リバースWBSページへ移動
  await page.goto('/reverse-wbs');
  
  // 2. 目標を入力
  await page.fill('[data-testid="goal-input"]', 'モバイルアプリを3ヶ月で開発');
  
  // 3. AI提案を生成
  await page.click('[data-testid="suggest-button"]');
  await expect(page.locator('[data-testid="task-tree"]')).toBeVisible();
  
  // 4. タスクを編集
  await page.click('[data-testid="task-1"]');
  await page.fill('[data-testid="task-name-input"]', '要件定義');
  
  // 5. プロジェクトとして保存
  await page.click('[data-testid="save-as-project"]');
  await expect(page).toHaveURL('/projects');
});
```

### レベル4: 非機能テスト

#### パフォーマンステスト
- TC-RW-P001: AI提案生成時間（3秒以内）
- TC-RW-P002: 1000タスクの表示性能（1秒以内）
- TC-RW-P003: ドラッグ&ドロップの応答性（60fps維持）

#### セキュリティテスト
- TC-RW-S001: XSS脆弱性（スクリプトインジェクション）
- TC-RW-S002: APIキー保護（クライアント非露出）
- TC-RW-S003: データ暗号化（ローカルストレージ）

#### アクセシビリティテスト
- TC-RW-A001: キーボードナビゲーション
- TC-RW-A002: スクリーンリーダー対応
- TC-RW-A003: カラーコントラスト基準

## テスト環境要件

### 開発環境
```yaml
# 必要なツール
- Node.js: v20以上
- pnpm: v8以上
- Docker: v24以上（DynamoDB Local用）

# テストフレームワーク
- Vitest: v3.0（単体・統合テスト）
- Playwright: v1.40（E2Eテスト）
- MSW: v2.0（APIモック）

# カバレッジツール
- Vitest Coverage (c8)
```

### CI/CD環境
```yaml
# GitHub Actions設定
name: Reverse WBS Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
      - name: Setup Node.js
      - name: Install dependencies
      - name: Run unit tests
      - name: Run integration tests
      - name: Run E2E tests
      - name: Upload coverage
```

### テストデータ
```typescript
// テストデータファクトリー
export const testDataFactory = {
  goal: (overrides = {}) => ({
    text: 'デフォルトテスト目標',
    category: 'development',
    deadline: '2025-12-31',
    ...overrides
  }),
  
  wbsTask: (overrides = {}) => ({
    id: generateId(),
    name: 'テストタスク',
    estimatedHours: 8,
    level: 1,
    children: [],
    ...overrides
  })
};
```

## 受け入れ基準

### カバレッジ目標
| カテゴリ | 現在 | 目標 | 必須 |
|---------|------|------|------|
| 行カバレッジ | 20% | 80% | 70% |
| 分岐カバレッジ | 15% | 75% | 65% |
| 関数カバレッジ | 25% | 85% | 75% |

### パフォーマンス基準
- AI提案生成: 95%のリクエストが3秒以内
- UI操作応答: 100ms以内
- ページ読み込み: 2秒以内
- メモリ使用量: 500MB以下

### 品質基準
- 重大度「高」のバグ: 0件
- 重大度「中」のバグ: 5件以下
- ユーザビリティ問題: 10件以下

## テスト実装優先順位

### Phase 1: 即時実装（2週間）
1. **リバースWBS API統合テスト** (16h)
   - AI提案生成API
   - 依存関係検証API
   - プロジェクト変換API

2. **コアコンポーネント単体テスト** (12h)
   - ReverseWBSForm
   - TaskHierarchyEditor
   - DependencyGraph

3. **基本E2Eテスト** (8h)
   - 目標入力→提案→保存フロー
   - エラーケース

### Phase 2: 次スプリント（2週間）
1. **UI操作テスト** (10h)
   - ドラッグ&ドロップ
   - タスク編集
   - 依存関係設定

2. **オフライン機能テスト** (12h)
   - オフライン検知
   - ローカル保存
   - 同期処理

3. **パフォーマンステスト** (8h)
   - 大量データ処理
   - 応答時間測定

### Phase 3: 継続的改善（1ヶ月）
1. **セキュリティテスト** (8h)
2. **アクセシビリティテスト** (6h)
3. **ブラウザ互換性テスト** (4h)

## リスクと対策

### 技術的リスク
| リスク | 影響度 | 発生確率 | 対策 |
|--------|--------|----------|------|
| AI APIの応答遅延 | 高 | 中 | タイムアウト設定、キャッシュ実装 |
| 大量データでの性能劣化 | 高 | 低 | 仮想スクロール、遅延ローディング |
| 依存関係の複雑化 | 中 | 中 | 制限設定、視覚化改善 |

### プロセスリスク
- テスト実装の遅延 → バッファ期間の確保
- テスト環境の不安定 → Docker化、自動化
- カバレッジ目標未達 → 段階的な目標設定

## 成功指標

1. **定量的指標**
   - テストカバレッジ80%以上達成
   - 全優先度「高」テストケース実装完了
   - CI/CDパイプライン100%成功率

2. **定性的指標**
   - 開発チームからのポジティブフィードバック
   - バグ発見率の向上
   - リリース品質の改善

## 次のアクション

1. このテスト要件定義書のレビューと承認
2. テスト実装タスクの詳細化（→ reverse-wbs-test-tasks.md）
3. テストケーステンプレートの作成
4. Phase 1の実装開始

---

**改訂履歴**
- 2025-08-02: 初版作成
- 今後の改訂は要件変更に応じて実施