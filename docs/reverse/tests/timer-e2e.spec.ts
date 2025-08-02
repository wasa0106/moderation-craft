/**
 * タイマー機能E2Eテスト（生成）
 * Playwrightを使用したエンドツーエンドテスト
 */

import { test, expect, Page } from '@playwright/test';

test.describe('タイマー機能E2Eテスト', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    // テスト用データベースの初期化
    await page.goto('/');
    await page.evaluate(() => {
      // IndexedDBをクリア
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('基本的なタイマー使用フロー', async () => {
    // タイマーページへ移動
    await page.goto('/timer');
    
    // ページが正しく読み込まれたことを確認
    await expect(page.locator('h1')).toContainText('タイマー');
    
    // タスク選択
    await page.click('[data-testid="task-select-trigger"]');
    await page.click('[data-testid="task-option-1"]');
    
    // 選択したタスクが表示されることを確認
    await expect(page.locator('[data-testid="selected-task-name"]')).toBeVisible();
    
    // タイマー開始
    await page.click('[data-testid="timer-start-button"]');
    
    // タイマーが動作していることを確認（1秒後）
    await page.waitForTimeout(1100);
    await expect(page.locator('[data-testid="timer-display"]')).toContainText('00:00:01');
    
    // 停止ボタンが表示されることを確認
    await expect(page.locator('[data-testid="timer-stop-button"]')).toBeVisible();
    
    // 5秒待機
    await page.waitForTimeout(5000);
    
    // タイマー停止
    await page.click('[data-testid="timer-stop-button"]');
    
    // セッションが履歴に追加されたことを確認
    await expect(page.locator('[data-testid="session-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="session-item"]').first()).toContainText('00:00:06');
  });

  test('気分・ドーパミン記録フロー', async () => {
    await page.goto('/timer');
    
    // タイマー開始
    await page.click('[data-testid="timer-start-button"]');
    await page.waitForTimeout(1000);
    
    // 気分記録
    await page.click('[data-testid="mood-button"]');
    await expect(page.locator('[data-testid="mood-dialog"]')).toBeVisible();
    
    // 気分レベルを選択（4を選択）
    await page.click('[data-testid="mood-level-4"]');
    await page.fill('[data-testid="mood-notes"]', '集中できている');
    await page.click('[data-testid="mood-save-button"]');
    
    // ダイアログが閉じることを確認
    await expect(page.locator('[data-testid="mood-dialog"]')).not.toBeVisible();
    
    // ドーパミン記録
    await page.click('[data-testid="dopamine-button"]');
    await expect(page.locator('[data-testid="dopamine-dialog"]')).toBeVisible();
    
    await page.fill('[data-testid="dopamine-event"]', 'タスクの一部を完了');
    await page.fill('[data-testid="dopamine-notes"]', '順調に進んでいる');
    await page.click('[data-testid="dopamine-save-button"]');
    
    // タイマーを停止
    await page.click('[data-testid="timer-stop-button"]');
    
    // 記録が保存されたことを確認（トースト通知）
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('記録を保存しました');
  });

  test('タスクなしでのタイマー使用', async () => {
    await page.goto('/timer');
    
    // タスクを選択せずにタイマー開始
    await page.click('[data-testid="timer-start-button"]');
    
    // 確認ダイアログが表示される
    await expect(page.locator('[data-testid="unplanned-task-dialog"]')).toBeVisible();
    
    // タスク説明を入力
    await page.fill('[data-testid="task-description"]', '臨時の作業');
    await page.click('[data-testid="confirm-unplanned-button"]');
    
    // タイマーが開始される
    await expect(page.locator('[data-testid="timer-display"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-task-name"]')).toContainText('臨時の作業');
  });

  test('タイマー実行中のタスク切り替え', async () => {
    await page.goto('/timer');
    
    // 最初のタスクでタイマー開始
    await page.click('[data-testid="task-select-trigger"]');
    await page.click('[data-testid="task-option-1"]');
    await page.click('[data-testid="timer-start-button"]');
    
    await page.waitForTimeout(3000);
    
    // 別のタスクを選択
    await page.click('[data-testid="task-select-trigger"]');
    await page.click('[data-testid="task-option-2"]');
    
    // 確認ダイアログが表示される
    await expect(page.locator('[data-testid="switch-task-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="switch-task-dialog"]')).toContainText('現在のセッションを終了して新しいタスクを開始しますか？');
    
    // 確認
    await page.click('[data-testid="confirm-switch-button"]');
    
    // 新しいタスクでタイマーが再開される
    await expect(page.locator('[data-testid="timer-display"]')).toContainText('00:00:00');
    await expect(page.locator('[data-testid="selected-task-name"]')).toContainText('タスク2');
  });

  test('スケジュールビューとの連携', async () => {
    await page.goto('/timer');
    
    // 日次スケジュールビューが表示される
    await expect(page.locator('[data-testid="daily-schedule-view"]')).toBeVisible();
    
    // 予定されたタスクが表示される
    const scheduledTasks = page.locator('[data-testid="scheduled-task-card"]');
    await expect(scheduledTasks).toHaveCount(3); // テストデータで3つのタスクを想定
    
    // スケジュールからタスクを選択
    await scheduledTasks.first().click();
    
    // タイマーにタスクがセットされる
    await expect(page.locator('[data-testid="selected-task-name"]')).toBeVisible();
    
    // タイマー開始
    await page.click('[data-testid="timer-start-button"]');
    
    // スケジュールカードがアクティブ状態になる
    await expect(scheduledTasks.first()).toHaveClass(/active/);
  });

  test('オフライン時の動作確認', async ({ context }) => {
    await page.goto('/timer');
    
    // オフラインモードに切り替え
    await context.setOffline(true);
    
    // オフラインインジケーターが表示される
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    
    // タイマー開始（オフラインでも動作）
    await page.click('[data-testid="timer-start-button"]');
    await page.waitForTimeout(2000);
    await page.click('[data-testid="timer-stop-button"]');
    
    // 同期待ちインジケーター表示
    await expect(page.locator('[data-testid="sync-pending-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="sync-pending-badge"]')).toContainText('1');
    
    // オンラインに復帰
    await context.setOffline(false);
    
    // 自動同期の開始
    await expect(page.locator('[data-testid="sync-progress"]')).toBeVisible({ timeout: 5000 });
    
    // 同期完了
    await expect(page.locator('[data-testid="sync-success-toast"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="sync-pending-badge"]')).not.toBeVisible();
  });

  test('セッション履歴の表示と編集', async () => {
    await page.goto('/timer');
    
    // 複数のセッションを作成
    for (let i = 0; i < 3; i++) {
      await page.click('[data-testid="timer-start-button"]');
      await page.waitForTimeout(2000);
      await page.click('[data-testid="timer-stop-button"]');
      await page.waitForTimeout(500);
    }
    
    // セッション履歴が表示される
    const sessions = page.locator('[data-testid="session-item"]');
    await expect(sessions).toHaveCount(3);
    
    // 最新のセッションを編集
    await sessions.first().hover();
    await sessions.first().locator('[data-testid="edit-session-button"]').click();
    
    // 編集ダイアログが表示される
    await expect(page.locator('[data-testid="edit-session-dialog"]')).toBeVisible();
    
    // 時間を編集
    await page.fill('[data-testid="session-duration-input"]', '15');
    await page.fill('[data-testid="session-notes-input"]', '実際は15分作業した');
    await page.click('[data-testid="save-session-button"]');
    
    // 変更が反映される
    await expect(sessions.first()).toContainText('00:15:00');
  });

  test('キーボードショートカット', async () => {
    await page.goto('/timer');
    
    // スペースキーでタイマー開始
    await page.keyboard.press('Space');
    await expect(page.locator('[data-testid="timer-display"]')).toBeVisible();
    
    await page.waitForTimeout(1000);
    
    // スペースキーでタイマー停止
    await page.keyboard.press('Space');
    await expect(page.locator('[data-testid="timer-start-button"]')).toBeVisible();
    
    // Mキーで気分記録
    await page.keyboard.press('m');
    await expect(page.locator('[data-testid="mood-dialog"]')).toBeVisible();
    await page.keyboard.press('Escape');
    
    // Dキーでドーパミン記録
    await page.keyboard.press('d');
    await expect(page.locator('[data-testid="dopamine-dialog"]')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('作業統計の表示', async () => {
    await page.goto('/timer');
    
    // 今日の合計作業時間が表示される
    await expect(page.locator('[data-testid="today-total-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="today-total-time"]')).toContainText('00:00:00');
    
    // セッションを作成
    await page.click('[data-testid="timer-start-button"]');
    await page.waitForTimeout(5000);
    await page.click('[data-testid="timer-stop-button"]');
    
    // 合計時間が更新される
    await expect(page.locator('[data-testid="today-total-time"]')).toContainText('00:00:05');
    
    // 週間統計を表示
    await page.click('[data-testid="weekly-stats-button"]');
    await expect(page.locator('[data-testid="weekly-stats-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="weekly-total"]')).toContainText('00:00:05');
  });
});

// モバイルビューのテスト
test.describe('タイマー機能 - モバイルビュー', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('モバイルでの基本操作', async ({ page }) => {
    await page.goto('/timer');
    
    // モバイルレイアウトの確認
    await expect(page.locator('[data-testid="mobile-timer-layout"]')).toBeVisible();
    
    // ハンバーガーメニューからタスク選択
    await page.click('[data-testid="mobile-menu-button"]');
    await page.click('[data-testid="mobile-task-select"]');
    await page.click('[data-testid="task-option-1"]');
    
    // タイマー開始
    await page.click('[data-testid="timer-start-button"]');
    
    // モバイル用の大きなタイマー表示
    await expect(page.locator('[data-testid="mobile-timer-display"]')).toBeVisible();
    
    // スワイプでセッション履歴を表示
    await page.locator('[data-testid="timer-container"]').swipe({
      direction: 'up',
      distance: 200
    });
    
    await expect(page.locator('[data-testid="session-list"]')).toBeVisible();
  });
});