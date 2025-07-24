# クイックデバッグスクリプト集

## プロジェクト作成問題のデバッグ

### 1. データベーススキーマを確認（コピー＆ペースト用）

```javascript
// このコード全体をブラウザコンソールにコピー＆ペースト
(async () => {
  console.log('=== データベーススキーマ確認 ===');
  try {
    const db = window.db;
    if (!db) {
      console.error('データベースが初期化されていません');
      return;
    }
    console.log('DBバージョン:', db.verno);
    console.log('テーブル一覧:');
    db.tables.forEach(t => console.log(`- ${t.name}`));
    
    // 正しいアクセス方法
    console.log('\nbig_tasksテーブル確認:');
    console.log('  アクセス:', db.big_tasks ? 'OK' : 'NG');
    console.log('\nprojectsテーブル確認:');
    console.log('  アクセス:', db.projects ? 'OK' : 'NG');
    
    const sampleTasks = await db.big_tasks.limit(3).toArray();
    console.log('サンプルタスク数:', sampleTasks.length);
    if (sampleTasks.length > 0) {
      console.log('サンプル:', sampleTasks[0]);
    }
  } catch (error) {
    console.error('エラー:', error);
  }
})();
```

### 2. プロジェクト作成をテスト

```javascript
// プロジェクト作成の単体テスト
(async () => {
  console.log('=== プロジェクト作成テスト ===');
  try {
    const db = window.db;
    const testProject = {
      id: crypto.randomUUID(),
      name: 'テストプロジェクト_' + Date.now(),
      goal: 'テスト目標',
      deadline: '2025-08-31',
      status: 'planning',
      user_id: 'current-user',
      version: 1,
      estimated_total_hours: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('作成するプロジェクト:', testProject);
    await db.projects.add(testProject);
    console.log('✅ プロジェクト作成成功');
    
    const created = await db.projects.get(testProject.id);
    console.log('確認:', created);
    
    await db.projects.delete(testProject.id);
    console.log('クリーンアップ完了');
  } catch (error) {
    console.error('❌ エラー:', error);
  }
})();
```

### 3. BigTask作成をテスト

```javascript
// BigTask作成の単体テスト（日付範囲あり）
(async () => {
  console.log('=== BigTask作成テスト ===');
  try {
    const db = window.db;
    const testBigTask = {
      id: crypto.randomUUID(),
      project_id: 'test-project-id',
      user_id: 'current-user',
      name: 'テストBigTask',
      category: 'テスト',
      week_number: 1,
      week_start_date: new Date('2025-08-04').toISOString(),
      week_end_date: new Date('2025-08-10').toISOString(),
      estimated_hours: 10,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('作成するBigTask:', testBigTask);
    await db.big_tasks.add(testBigTask);
    console.log('✅ BigTask作成成功');
    
    const created = await db.big_tasks.get(testBigTask.id);
    console.log('確認:', created);
    
    await db.big_tasks.delete(testBigTask.id);
    console.log('クリーンアップ完了');
  } catch (error) {
    console.error('❌ エラー:', error);
    console.error('詳細:', error.stack);
  }
})();
```

### 4. 実際のデータを確認

```javascript
// 実際のプロジェクトとタスクを確認
(async () => {
  console.log('=== 実データ確認 ===');
  try {
    const db = window.db;
    
    const projects = await db.projects.toArray();
    console.log(`プロジェクト数: ${projects.length}`);
    projects.forEach(p => console.log(`- ${p.name} (${p.id})`));
    
    const bigTasks = await db.big_tasks.toArray();
    console.log(`\nBigTask数: ${bigTasks.length}`);
    
    const withDateRange = bigTasks.filter(t => t.week_start_date && t.week_end_date);
    console.log(`日付範囲あり: ${withDateRange.length}`);
    console.log(`日付範囲なし: ${bigTasks.length - withDateRange.length}`);
    
    if (bigTasks.length > 0) {
      console.log('\n最新のBigTask:');
      const latest = bigTasks.sort((a,b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      console.log(latest);
    }
  } catch (error) {
    console.error('エラー:', error);
  }
})();
```

### 5. プロジェクト作成フォームの値を確認

```javascript
// プロジェクト作成画面で実行
(() => {
  console.log('=== フォーム値確認 ===');
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    if (input.value) {
      console.log(`${input.name || input.id || input.placeholder}: ${input.value}`);
    }
  });
  
  // Reactの状態を確認（開発者ツールがある場合）
  const reactFiber = document.querySelector('#__next')?._reactRootContainer?._internalRoot?.current;
  if (reactFiber) {
    console.log('React Fiber:', reactFiber);
  }
})();
```

### 6. デバッグユーティリティを手動で読み込む

```javascript
// デバッグユーティリティが読み込まれていない場合
(async () => {
  try {
    await import('/src/utils/direct-debug.js');
    console.log('✅ directDebug loaded!');
    console.log('Try: directDebug.checkDatabaseSchema()');
  } catch (e) {
    console.error('Failed to load debug utils:', e);
  }
})();
```

### 7. 最もシンプルなDB確認（ワンライナー）

```javascript
// DB接続の確認
window.db && console.log('DB:', {connected: true, version: db.verno, projects: !!db.projects, big_tasks: !!db.big_tasks}) || console.error('DB not initialized')
```

```javascript
// プロジェクト数とBigTask数を確認
window.db && Promise.all([db.projects.count(), db.big_tasks.count()]).then(([p,b]) => console.log(`Projects: ${p}, BigTasks: ${b}`))
```

```javascript
// 最新のエラーを確認（プロジェクト作成後）
window.db && db.projects.orderBy('created_at').reverse().limit(1).toArray().then(p => console.log('Latest project:', p[0]))
```

## 使い方

1. Chrome/Edge/FirefoxでF12キーを押してコンソールを開く
2. 上記のスクリプトのいずれかをコピー
3. コンソールに貼り付けてEnterキー
4. 結果を確認

エラーが出た場合は、そのエラーメッセージをそのまま共有してください。

## トラブルシューティング

### `Cannot read properties of undefined (reading 'table')` エラー
- 原因: `db.table('projects')` という間違った書き方
- 解決: `db.projects` に修正

### `db is not defined` エラー
- 原因: window.dbが初期化されていない
- 解決: ページをリロードして再試行

### プロジェクト作成ボタンが反応しない
- フォームのバリデーションエラーを確認
- コンソールのエラーメッセージを確認
- ネットワークタブでAPIエラーを確認