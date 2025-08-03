/**
 * BaseRepository bulk操作の同期処理に関するテスト
 * TASK-001: 新しいSyncServiceを使用するように修正
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Dexie, { Table } from 'dexie'
import { BaseRepository } from '../base-repository'
import { DatabaseEntity } from '@/types'
import { db as mockDb } from '../../database'
import { SyncService } from '@/lib/sync/sync-service'

// Mock the SyncService
const mockAddToSyncQueue = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/sync/sync-service', () => ({
  SyncService: {
    getInstance: vi.fn(() => ({
      addToSyncQueue: mockAddToSyncQueue,
    })),
  },
}))

// Mock the database module
vi.mock('../../database', () => {
  const mockDbMethods = {
    generateId: vi.fn(() => `id-${Math.random().toString(36).substr(2, 9)}`),
    getCurrentTimestamp: vi.fn(() => new Date().toISOString()),
    createTimestamps: vi.fn(() => {
      const timestamp = '2024-01-20T10:00:00Z'
      return { created_at: timestamp, updated_at: timestamp }
    }),
    updateTimestamp: vi.fn(() => ({ updated_at: '2024-01-20T10:00:01Z' })),
    sync_queue: null as any,
    transaction: vi.fn(async (mode: string, tables: any, fn: any) => {
      if (typeof tables === 'function') {
        return tables()
      }
      return fn()
    }),
  }

  return {
    db: mockDbMethods,
    default: mockDbMethods,
  }
})

// テスト用のエンティティ型
interface TestEntity extends DatabaseEntity {
  name: string
  status: string
}

// Mock database class
class MockDatabase extends Dexie {
  test_entities!: Table<TestEntity>
  sync_queue!: Table<any>

  constructor() {
    super('MockDatabase')
    this.version(1).stores({
      test_entities: 'id, name, status, created_at, updated_at',
      sync_queue:
        '++id, user_id, entity_type, entity_id, operation_type, status, version',
    })
  }

  generateId(): string {
    return mockDb.generateId()
  }

  getCurrentTimestamp(): string {
    return mockDb.getCurrentTimestamp()
  }

  createTimestamps(): { created_at: string; updated_at: string } {
    return mockDb.createTimestamps()
  }

  updateTimestamp(): { updated_at: string } {
    return mockDb.updateTimestamp()
  }

  transaction(...args: any[]): any {
    const fn = args[args.length - 1]
    if (typeof fn === 'function') {
      return Promise.resolve(fn())
    }
    return Promise.resolve()
  }
}

// テスト用のRepositoryクラス
class TestRepository extends BaseRepository<TestEntity> {
  protected table: Table<TestEntity>
  protected entityType = 'test_entity'

  constructor(db: MockDatabase) {
    super()
    this.table = db.test_entities
    mockDb.sync_queue = db.sync_queue
  }
}

describe('BaseRepository - Bulk操作の同期処理', () => {
  let mockDatabase: MockDatabase
  let repository: TestRepository

  beforeEach(async () => {
    // モックのリセット
    vi.clearAllMocks()
    mockAddToSyncQueue.mockClear()

    // データベースのセットアップ
    mockDatabase = new MockDatabase()
    await mockDatabase.open()

    // Repositoryのインスタンス作成
    repository = new TestRepository(mockDatabase)

    // sync_queue.bulkAddのモック（呼ばれないことを確認）
    mockDb.sync_queue.bulkAdd = vi.fn()
  })

  afterEach(async () => {
    await mockDatabase.delete()
  })

  describe('bulkCreate', () => {
    it('新しいSyncServiceを使用して各エンティティを同期キューに追加する', async () => {
      // Arrange
      const items = [
        { name: 'Project 1', status: 'active' },
        { name: 'Project 2', status: 'active' },
        { name: 'Project 3', status: 'active' },
      ]

      // Act
      const result = await repository.bulkCreate(items)

      // Assert
      expect(result).toHaveLength(3)
      expect(SyncService.getInstance).toHaveBeenCalled()
      expect(mockAddToSyncQueue).toHaveBeenCalledTimes(3)
      
      // 各エンティティに対して正しいパラメータで呼ばれることを確認
      items.forEach((_, index) => {
        expect(mockAddToSyncQueue).toHaveBeenNthCalledWith(
          index + 1,
          'test_entity',
          expect.stringMatching(/^id-/),
          'create',
          expect.objectContaining({
            name: items[index].name,
            status: items[index].status,
          })
        )
      })
    })

    it('古いsync_queue.bulkAdd()を呼び出さない', async () => {
      // Arrange
      const items = [
        { name: 'Project 1', status: 'active' },
      ]

      // Act
      await repository.bulkCreate(items)

      // Assert
      expect(mockDb.sync_queue.bulkAdd).not.toHaveBeenCalled()
    })

    it('同期キューへの追加が失敗してもbulk操作は成功する', async () => {
      // Arrange
      const items = [
        { name: 'Project 1', status: 'active' },
        { name: 'Project 2', status: 'active' },
        { name: 'Project 3', status: 'active' },
      ]

      // 2番目の呼び出しでエラーを発生させる
      mockAddToSyncQueue.mockReset()
      mockAddToSyncQueue
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Sync failed'))
        .mockResolvedValueOnce(undefined)

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Act
      const result = await repository.bulkCreate(items)

      // Assert
      expect(result).toHaveLength(3)
      expect(mockAddToSyncQueue).toHaveBeenCalledTimes(3)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to add test_entity'),
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })

    it('空の配列の場合、同期処理をスキップする', async () => {
      // Act
      const result = await repository.bulkCreate([])

      // Assert
      expect(result).toHaveLength(0)
      expect(mockAddToSyncQueue).not.toHaveBeenCalled()
    })

    it('entityTypeがsync_queueの場合、同期処理をスキップする', async () => {
      // Arrange
      repository['entityType'] = 'sync_queue'
      const items = [{ name: 'SyncItem', status: 'pending' }]

      // Act
      await repository.bulkCreate(items)

      // Assert
      expect(mockAddToSyncQueue).not.toHaveBeenCalled()
    })
  })

  describe('bulkUpdate', () => {
    it('新しいSyncServiceを使用して更新されたエンティティを同期キューに追加する', async () => {
      // Arrange
      const updates = [
        { id: 'id1', data: { name: 'Updated Project 1' } },
        { id: 'id2', data: { name: 'Updated Project 2' } },
        { id: 'id3', data: { name: 'Updated Project 3' } },
      ]

      // Mock the table.update and table.get methods
      const mockUpdate = vi.fn().mockResolvedValue(1)
      const mockGet = vi.fn()
      mockGet.mockImplementation((id: string) => {
        const update = updates.find(u => u.id === id)
        if (update) {
          return Promise.resolve({
            id: update.id,
            name: `Updated Entity ${id}`,
            status: 'active',
            created_at: '2024-01-20T10:00:00Z',
            updated_at: '2024-01-20T10:00:01Z',
          })
        }
        return Promise.resolve(undefined)
      })
      
      repository['table'].update = mockUpdate
      repository['table'].get = mockGet

      // Act
      const result = await repository.bulkUpdate(updates)

      // Assert
      expect(result).toHaveLength(3)
      expect(mockAddToSyncQueue).toHaveBeenCalledTimes(3)
      
      updates.forEach((update, index) => {
        expect(mockAddToSyncQueue).toHaveBeenNthCalledWith(
          index + 1,
          'test_entity',
          update.id,
          'update',
          expect.objectContaining({
            id: update.id,
            name: expect.stringContaining('Updated Entity'),
          })
        )
      })
    })

    it('古いsync_queue.bulkAdd()を呼び出さない', async () => {
      // Arrange
      const updates = [
        { id: 'id1', data: { name: 'Updated Project 1' } },
      ]

      // Mock the table methods
      repository['table'].update = vi.fn().mockResolvedValue(1)
      repository['table'].get = vi.fn().mockResolvedValue({
        id: 'id1',
        name: 'Updated Entity id1',
        status: 'active',
        created_at: '2024-01-20T10:00:00Z',
        updated_at: '2024-01-20T10:00:01Z',
      })

      // Act
      await repository.bulkUpdate(updates)

      // Assert
      expect(mockDb.sync_queue.bulkAdd).not.toHaveBeenCalled()
    })
  })

  describe('bulkDelete', () => {
    it('新しいSyncServiceを使用して削除されたエンティティを同期キューに追加する', async () => {
      // Arrange
      const ids = ['id1', 'id2', 'id3']

      // Mock the table methods
      const entities = ids.map(id => ({
        id,
        name: `Entity ${id}`,
        status: 'active',
        created_at: '2024-01-20T10:00:00Z',
        updated_at: '2024-01-20T10:00:00Z',
      }))
      
      repository['table'].where = vi.fn().mockReturnValue({
        anyOf: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(entities),
          delete: vi.fn().mockResolvedValue(undefined),
        }),
      })

      // Act
      await repository.bulkDelete(ids)

      // Assert
      expect(mockAddToSyncQueue).toHaveBeenCalledTimes(3)
      
      ids.forEach((id, index) => {
        expect(mockAddToSyncQueue).toHaveBeenNthCalledWith(
          index + 1,
          'test_entity',
          id,
          'delete',
          expect.objectContaining({
            id,
            name: expect.stringContaining('Entity'),
            status: 'active',
          })
        )
      })
    })

    it('古いsync_queue.bulkAdd()を呼び出さない', async () => {
      // Arrange
      const ids = ['id1']

      // Mock the table methods
      repository['table'].where = vi.fn().mockReturnValue({
        anyOf: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([{
            id: 'id1',
            name: 'Entity id1',
            status: 'active',
            created_at: '2024-01-20T10:00:00Z',
            updated_at: '2024-01-20T10:00:00Z',
          }]),
          delete: vi.fn().mockResolvedValue(undefined),
        }),
      })

      // Act
      await repository.bulkDelete(ids)

      // Assert
      expect(mockDb.sync_queue.bulkAdd).not.toHaveBeenCalled()
    })

    it('削除前のエンティティデータを同期キューに含める', async () => {
      // Arrange
      const ids = ['id1']
      const entityData = {
        id: 'id1',
        name: 'Entity 1',
        status: 'active',
        created_at: '2024-01-20T10:00:00Z',
        updated_at: '2024-01-20T10:00:00Z',
      }

      // 事前にエンティティを作成
      await repository['table'].add(entityData)

      // Act
      await repository.bulkDelete(ids)

      // Assert
      expect(mockAddToSyncQueue).toHaveBeenCalledWith(
        'test_entity',
        'id1',
        'delete',
        entityData
      )
    })
  })

  describe('パフォーマンステスト', () => {
    it('1000件のbulk操作でも適切に処理される', async () => {
      // Arrange
      const items = Array.from({ length: 1000 }, (_, i) => ({
        name: `Project ${i}`,
        status: 'active',
      }))

      const startTime = Date.now()

      // Act
      await repository.bulkCreate(items)

      const endTime = Date.now()
      const duration = endTime - startTime

      // Assert
      expect(mockAddToSyncQueue).toHaveBeenCalledTimes(1000)
      expect(duration).toBeLessThan(5000) // 5秒以内に完了
    })
  })
})