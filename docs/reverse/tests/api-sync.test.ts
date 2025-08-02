/**
 * 同期API統合テスト（生成）
 * POST /api/sync のテストケース
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '@/app';

describe('POST /api/sync - データ同期API', () => {
  const validApiKey = process.env.SYNC_API_KEY || 'test-api-key';

  describe('正常系', () => {
    it('プロジェクト作成の同期が成功する', async () => {
      const projectData = {
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
          color: 'hsl(200, 50%, 60%)',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };

      const response = await request(app)
        .post('/api/sync')
        .set('X-API-Key', validApiKey)
        .send(projectData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        syncedEntityId: 'proj_test_001',
        syncedEntityType: 'project'
      });
    });

    it('全エンティティタイプの同期をテスト', async () => {
      const entityTypes = [
        { type: 'project', payload: createProjectPayload() },
        { type: 'big_task', payload: createBigTaskPayload() },
        { type: 'small_task', payload: createSmallTaskPayload() },
        { type: 'work_session', payload: createWorkSessionPayload() },
        { type: 'mood_entry', payload: createMoodEntryPayload() },
        { type: 'dopamine_entry', payload: createDopamineEntryPayload() },
        { type: 'schedule_memo', payload: createScheduleMemoPayload() },
        { type: 'sleep_schedule', payload: createSleepSchedulePayload() }
      ];

      for (const { type, payload } of entityTypes) {
        const response = await request(app)
          .post('/api/sync')
          .set('X-API-Key', validApiKey)
          .send({
            entity_type: type,
            operation: 'CREATE',
            payload
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.syncedEntityType).toBe(type);
      }
    });

    it('UPDATE操作が成功する', async () => {
      const updateData = {
        entity_type: 'project',
        operation: 'UPDATE',
        payload: {
          id: 'proj_test_001',
          user_id: 'user_test',
          name: '更新されたプロジェクト',
          status: 'completed',
          updated_at: new Date().toISOString()
        }
      };

      const response = await request(app)
        .post('/api/sync')
        .set('X-API-Key', validApiKey)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('DELETE操作が成功する', async () => {
      const deleteData = {
        entity_type: 'project',
        operation: 'DELETE',
        payload: {
          id: 'proj_test_001',
          user_id: 'user_test'
        }
      };

      const response = await request(app)
        .post('/api/sync')
        .set('X-API-Key', validApiKey)
        .send(deleteData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('operation未指定時はデフォルトでCREATEになる', async () => {
      const response = await request(app)
        .post('/api/sync')
        .set('X-API-Key', validApiKey)
        .send({
          entity_type: 'project',
          payload: createProjectPayload()
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('異常系 - 認証エラー', () => {
    it('APIキーなしで401エラー', async () => {
      const response = await request(app)
        .post('/api/sync')
        .send({
          entity_type: 'project',
          payload: createProjectPayload()
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'API key is required. Please provide x-api-key header.'
      });
    });

    it('無効なAPIキーで401エラー', async () => {
      const response = await request(app)
        .post('/api/sync')
        .set('X-API-Key', 'invalid-api-key')
        .send({
          entity_type: 'project',
          payload: createProjectPayload()
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid API key'
      });
    });
  });

  describe('異常系 - バリデーションエラー', () => {
    it('entity_type未指定で400エラー', async () => {
      const response = await request(app)
        .post('/api/sync')
        .set('X-API-Key', validApiKey)
        .send({
          payload: createProjectPayload()
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'entity_type and payload are required'
      });
    });

    it('payload未指定で400エラー', async () => {
      const response = await request(app)
        .post('/api/sync')
        .set('X-API-Key', validApiKey)
        .send({
          entity_type: 'project'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'entity_type and payload are required'
      });
    });

    it('未実装のエンティティタイプで400エラー', async () => {
      const response = await request(app)
        .post('/api/sync')
        .set('X-API-Key', validApiKey)
        .send({
          entity_type: 'unknown_entity',
          payload: { id: 'test' }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('同期はまだ実装されていません');
    });

    it('不正なJSON形式で400エラー', async () => {
      const response = await request(app)
        .post('/api/sync')
        .set('X-API-Key', validApiKey)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });

  describe('異常系 - データ検証', () => {
    it('必須フィールドが不足している場合のエラー', async () => {
      const incompletePayload = {
        entity_type: 'project',
        payload: {
          // idとuser_idが不足
          name: 'テストプロジェクト'
        }
      };

      const response = await request(app)
        .post('/api/sync')
        .set('X-API-Key', validApiKey)
        .send(incompletePayload);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});

// ヘルパー関数：各エンティティのペイロード生成
function createProjectPayload() {
  return {
    id: `proj_${Date.now()}`,
    user_id: 'user_test',
    name: 'テストプロジェクト',
    goal: 'テスト目標',
    deadline: '2025-12-31',
    status: 'active',
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function createBigTaskPayload() {
  return {
    id: `bigtask_${Date.now()}`,
    project_id: 'proj_test',
    user_id: 'user_test',
    name: '大タスク',
    estimated_hours: 10,
    actual_hours: 0,
    status: 'pending',
    start_date: '2025-01-01',
    end_date: '2025-01-31',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function createSmallTaskPayload() {
  return {
    id: `smalltask_${Date.now()}`,
    big_task_id: 'bigtask_test',
    user_id: 'user_test',
    name: '小タスク',
    estimated_minutes: 60,
    scheduled_start: new Date().toISOString(),
    scheduled_end: new Date(Date.now() + 3600000).toISOString(),
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function createWorkSessionPayload() {
  return {
    id: `session_${Date.now()}`,
    small_task_id: 'smalltask_test',
    user_id: 'user_test',
    start_time: new Date().toISOString(),
    duration_seconds: 1800,
    is_synced: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function createMoodEntryPayload() {
  return {
    id: `mood_${Date.now()}`,
    user_id: 'user_test',
    timestamp: new Date().toISOString(),
    mood_level: 4,
    notes: 'テスト気分記録',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function createDopamineEntryPayload() {
  return {
    id: `dopamine_${Date.now()}`,
    user_id: 'user_test',
    timestamp: new Date().toISOString(),
    event_description: 'タスク完了',
    notes: 'テストドーパミン記録',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function createScheduleMemoPayload() {
  return {
    id: `memo_${Date.now()}`,
    user_id: 'user_test',
    week_start_date: '2025-01-06',
    content: '週次メモテスト',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function createSleepSchedulePayload() {
  return {
    id: `sleep_${Date.now()}`,
    user_id: 'user_test',
    date_of_sleep: '2025-01-07',
    scheduled_start_time: '2025-01-06T23:00:00Z',
    scheduled_end_time: '2025-01-07T07:00:00Z',
    scheduled_duration_minutes: 480,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}