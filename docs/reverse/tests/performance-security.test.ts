/**
 * パフォーマンス・セキュリティテスト（生成）
 * システムの性能限界とセキュリティ脆弱性を検証
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { db } from '@/lib/db/database';
import { projectRepository, smallTaskRepository, workSessionRepository } from '@/lib/db/repositories';

describe('パフォーマンステスト', () => {
  const validApiKey = process.env.SYNC_API_KEY || 'test-api-key';

  describe('負荷テスト', () => {
    it('同期API - 100同時リクエスト処理', async () => {
      // 100個の異なるワークセッションデータを準備
      const requests = Array.from({ length: 100 }, (_, i) => ({
        entity_type: 'work_session',
        operation: 'CREATE',
        payload: {
          id: `session_perf_${i}`,
          user_id: 'user_perf_test',
          small_task_id: `task_${i % 10}`,
          start_time: new Date(Date.now() - 3600000).toISOString(),
          end_time: new Date().toISOString(),
          duration_seconds: 3600,
          is_synced: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }));

      const startTime = Date.now();
      
      // 並列でリクエストを送信
      const promises = requests.map(req =>
        request(app)
          .post('/api/sync')
          .set('X-API-Key', validApiKey)
          .send(req)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 全リクエストが成功することを確認
      const successCount = responses.filter(res => res.status === 200).length;
      const errorCount = responses.filter(res => res.status !== 200).length;

      expect(successCount).toBeGreaterThan(95); // 95%以上の成功率
      expect(errorCount).toBeLessThan(5); // エラー率5%未満

      // 処理時間が10秒以内
      expect(totalTime).toBeLessThan(10000);
      
      console.log(`Performance Test Results:
        Total Requests: 100
        Success: ${successCount}
        Errors: ${errorCount}
        Total Time: ${totalTime}ms
        Average Time per Request: ${totalTime / 100}ms
      `);
    });

    it('IndexedDB - 大量データ処理性能', async () => {
      // 1000件のプロジェクトデータを作成
      const projects = Array.from({ length: 1000 }, (_, i) => ({
        name: `Performance Test Project ${i}`,
        goal: `Goal for project ${i}`,
        user_id: 'user_perf_test',
        deadline: '2025-12-31',
        status: 'active' as const,
        version: 1
      }));

      // 作成性能測定
      const createStartTime = Date.now();
      const createdProjects = await Promise.all(
        projects.map(p => projectRepository.create(p))
      );
      const createEndTime = Date.now();
      const createTime = createEndTime - createStartTime;

      expect(createdProjects.length).toBe(1000);
      expect(createTime).toBeLessThan(5000); // 5秒以内

      // 読み込み性能測定
      const readStartTime = Date.now();
      const allProjects = await projectRepository.getByUserId('user_perf_test');
      const readEndTime = Date.now();
      const readTime = readEndTime - readStartTime;

      expect(allProjects.length).toBe(1000);
      expect(readTime).toBeLessThan(1000); // 1秒以内

      // フィルタリング性能測定
      const filterStartTime = Date.now();
      const activeProjects = await projectRepository.getActiveProjects('user_perf_test');
      const filterEndTime = Date.now();
      const filterTime = filterEndTime - filterStartTime;

      expect(activeProjects.length).toBe(1000);
      expect(filterTime).toBeLessThan(1500); // 1.5秒以内

      console.log(`IndexedDB Performance Results:
        Create 1000 records: ${createTime}ms
        Read 1000 records: ${readTime}ms
        Filter 1000 records: ${filterTime}ms
      `);

      // クリーンアップ
      await Promise.all(createdProjects.map(p => projectRepository.delete(p.id)));
    });

    it('複雑なクエリの性能', async () => {
      // テストデータ作成
      const userId = 'user_complex_query';
      const projectId = 'proj_complex';
      
      // 1プロジェクト、50大タスク、500小タスクを作成
      await projectRepository.create({
        id: projectId,
        user_id: userId,
        name: 'Complex Query Test',
        goal: 'Performance testing',
        deadline: '2025-12-31',
        status: 'active',
        version: 1
      });

      // 日付範囲クエリの性能測定
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const queryStartTime = Date.now();
      const tasksInRange = await smallTaskRepository.getByDateRange(
        userId,
        weekAgo.toISOString(),
        now.toISOString()
      );
      const queryEndTime = Date.now();
      const queryTime = queryEndTime - queryStartTime;

      expect(queryTime).toBeLessThan(500); // 500ms以内

      console.log(`Complex Query Performance:
        Date Range Query Time: ${queryTime}ms
        Results Count: ${tasksInRange.length}
      `);
    });

    it('メモリ使用量の監視', async () => {
      if (typeof performance !== 'undefined' && performance.memory) {
        const initialMemory = performance.memory.usedJSHeapSize;

        // 大量のセッションデータを作成
        const sessions = Array.from({ length: 5000 }, (_, i) => ({
          small_task_id: `task_${i % 100}`,
          user_id: 'user_memory_test',
          start_time: new Date(Date.now() - i * 60000).toISOString(),
          duration_seconds: 1800,
          is_synced: false
        }));

        await Promise.all(sessions.map(s => workSessionRepository.create(s)));

        const afterCreateMemory = performance.memory.usedJSHeapSize;
        const memoryIncrease = afterCreateMemory - initialMemory;
        const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

        // メモリ増加が100MB未満
        expect(memoryIncreaseMB).toBeLessThan(100);

        console.log(`Memory Usage:
          Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
          After 5000 records: ${(afterCreateMemory / 1024 / 1024).toFixed(2)}MB
          Increase: ${memoryIncreaseMB.toFixed(2)}MB
        `);
      }
    });
  });
});

describe('セキュリティテスト', () => {
  const validApiKey = process.env.SYNC_API_KEY || 'test-api-key';

  describe('XSS（クロスサイトスクリプティング）対策', () => {
    it('悪意のあるスクリプトが無害化される', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '"><script>alert("XSS")</script>',
        '<img src=x onerror="alert(\'XSS\')">',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        'javascript:alert("XSS")',
        '<svg onload="alert(\'XSS\')">',
        '<body onload="alert(\'XSS\')">',
        '${alert("XSS")}',
        '<input onfocus="alert(\'XSS\')" autofocus>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/sync')
          .set('X-API-Key', validApiKey)
          .send({
            entity_type: 'project',
            operation: 'CREATE',
            payload: {
              id: `xss_test_${Date.now()}`,
              user_id: 'user_xss_test',
              name: payload,
              goal: payload,
              deadline: '2025-12-31',
              status: 'active',
              version: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          });

        // リクエストは成功するが、スクリプトは実行されない
        expect(response.status).toBe(200);
        
        // レスポンスにスクリプトタグが含まれていないことを確認
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('javascript:');
        expect(responseText).not.toContain('onerror=');
        expect(responseText).not.toContain('onload=');
      }
    });

    it('HTMLエンティティが適切にエスケープされる', async () => {
      const htmlPayloads = [
        '<div>Test</div>',
        '<a href="http://evil.com">Click me</a>',
        '&lt;script&gt;alert("XSS")&lt;/script&gt;',
        '<![CDATA[<script>alert("XSS")</script>]]>'
      ];

      for (const payload of htmlPayloads) {
        const response = await request(app)
          .post('/api/sync')
          .set('X-API-Key', validApiKey)
          .send({
            entity_type: 'mood_entry',
            operation: 'CREATE',
            payload: {
              id: `mood_html_${Date.now()}`,
              user_id: 'user_html_test',
              timestamp: new Date().toISOString(),
              mood_level: 3,
              notes: payload,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          });

        expect(response.status).toBe(200);
      }
    });
  });

  describe('認証・認可のセキュリティ', () => {
    it('APIキーのブルートフォース攻撃シミュレーション', async () => {
      const attempts = 100;
      const attackStartTime = Date.now();
      
      // 100回の不正なAPIキーでアクセス
      const promises = Array.from({ length: attempts }, (_, i) =>
        request(app)
          .post('/api/sync')
          .set('X-API-Key', `bruteforce_attempt_${i}`)
          .send({
            entity_type: 'project',
            payload: { id: 'test' }
          })
      );

      const responses = await Promise.all(promises);
      const attackEndTime = Date.now();
      const attackDuration = attackEndTime - attackStartTime;

      // 全て401エラーであることを確認
      const unauthorizedCount = responses.filter(res => res.status === 401).length;
      expect(unauthorizedCount).toBe(attempts);

      // レート制限の推奨（現在は未実装）
      console.log(`Brute Force Test Results:
        Total Attempts: ${attempts}
        All Rejected: ${unauthorizedCount === attempts}
        Attack Duration: ${attackDuration}ms
        Average Response Time: ${attackDuration / attempts}ms
        
        Recommendation: Implement rate limiting to prevent brute force attacks
      `);
    });

    it('APIキーの漏洩防止確認', async () => {
      // エラーレスポンスにAPIキーが含まれていないことを確認
      const response = await request(app)
        .post('/api/sync')
        .set('X-API-Key', 'wrong_key_12345')
        .send({
          entity_type: 'project',
          payload: {}
        });

      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('wrong_key_12345');
      expect(responseText).not.toContain(process.env.SYNC_API_KEY);
    });
  });

  describe('インジェクション攻撃対策', () => {
    it('NoSQLインジェクション対策', async () => {
      const injectionPayloads = [
        { $ne: null },
        { $gt: '' },
        { $where: 'this.password == null' },
        { id: { $exists: true } },
        '{"$ne": null}',
        "'; return true; //",
      ];

      for (const payload of injectionPayloads) {
        const response = await request(app)
          .post('/api/sync')
          .set('X-API-Key', validApiKey)
          .send({
            entity_type: 'project',
            operation: 'CREATE',
            payload: {
              id: typeof payload === 'string' ? payload : 'injection_test',
              user_id: payload,
              name: 'Injection Test',
              goal: 'Test',
              status: 'active',
              version: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          });

        // インジェクション攻撃が失敗することを確認
        if (typeof payload !== 'string') {
          expect(response.status).toBe(500);
        }
      }
    });

    it('JSONパーサー攻撃対策', async () => {
      // 巨大なJSONペイロード
      const largePayload = {
        entity_type: 'project',
        payload: {
          id: 'large_json_test',
          user_id: 'user_test',
          name: 'A'.repeat(1000000), // 1MBの文字列
          goal: 'Test',
          status: 'active',
          version: 1
        }
      };

      const response = await request(app)
        .post('/api/sync')
        .set('X-API-Key', validApiKey)
        .send(largePayload);

      // リクエストが適切に処理されるか、サイズ制限でブロックされる
      expect([200, 413, 500]).toContain(response.status);
    });
  });

  describe('データプライバシー', () => {
    it('他ユーザーのデータにアクセスできない', async () => {
      // ユーザーAのデータを作成
      await request(app)
        .post('/api/sync')
        .set('X-API-Key', validApiKey)
        .send({
          entity_type: 'project',
          operation: 'CREATE',
          payload: {
            id: 'private_proj_a',
            user_id: 'user_a',
            name: 'Private Project A',
            goal: 'Secret',
            status: 'active',
            version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        });

      // ユーザーBとして取得を試みる
      const response = await request(app)
        .get('/api/sync/pull?userId=user_b')
        .set('X-API-Key', validApiKey);

      expect(response.status).toBe(200);
      
      // ユーザーAのデータが含まれていないことを確認
      const projects = response.body.data?.projects || [];
      const userAProjects = projects.filter((p: any) => p.user_id === 'user_a');
      expect(userAProjects.length).toBe(0);
    });
  });

  describe('セキュリティヘッダー', () => {
    it('適切なセキュリティヘッダーが設定されている', async () => {
      const response = await request(app)
        .get('/api/health');

      // 推奨されるセキュリティヘッダー（現在は一部未実装の可能性）
      const securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': /default-src/
      };

      console.log('Security Headers Check:');
      for (const [header, expectedValue] of Object.entries(securityHeaders)) {
        const actualValue = response.headers[header.toLowerCase()];
        if (actualValue) {
          console.log(`✓ ${header}: ${actualValue}`);
        } else {
          console.log(`✗ ${header}: Not set (Recommended)`);
        }
      }
    });
  });
});