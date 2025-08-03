import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import Dexie, { Table } from 'dexie'
import { BaseRepository } from '../base-repository'
import { DatabaseEntity } from '@/types'
import { db as mockDb } from '../../database'

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
    generateId: vi.fn(() => crypto.randomUUID()),
    getCurrentTimestamp: vi.fn(() => new Date().toISOString()),
    createTimestamps: vi.fn(() => {
      const timestamp = new Date().toISOString()
      return { created_at: timestamp, updated_at: timestamp }
    }),
    updateTimestamp: vi.fn(() => ({ updated_at: new Date().toISOString() })),
    sync_queue: null as any,
    transaction: vi.fn(async (mode: string, tables: any, fn: any) => {
      // Simulate Dexie transaction
      if (typeof tables === 'function') {
        // If tables is actually the function (2 param version)
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

// Test entity interface
interface TestEntity extends DatabaseEntity {
  name: string
  value: number
  optional?: string
}

// Mock database class
class MockDatabase extends Dexie {
  test_entities!: Table<TestEntity>
  sync_queue!: Table<any>

  constructor() {
    super('MockDatabase')
    this.version(1).stores({
      test_entities: 'id, name, value, created_at, updated_at',
      sync_queue:
        '++id, operation_id, operation_type, entity_type, entity_id, status, timestamp, retry_count',
    })
  }

  generateId(): string {
    return crypto.randomUUID()
  }

  getCurrentTimestamp(): string {
    return new Date().toISOString()
  }

  createTimestamps(): { created_at: string; updated_at: string } {
    const timestamp = this.getCurrentTimestamp()
    return {
      created_at: timestamp,
      updated_at: timestamp,
    }
  }

  updateTimestamp(): { updated_at: string } {
    return {
      updated_at: this.getCurrentTimestamp(),
    }
  }

  // Override transaction to work with our mock
  transaction(...args: any[]): any {
    // For testing purposes, just execute the function
    const fn = args[args.length - 1]
    if (typeof fn === 'function') {
      return Promise.resolve(fn())
    }
    return Promise.resolve()
  }
}

// Concrete implementation of BaseRepository for testing
class TestRepository extends BaseRepository<TestEntity> {
  protected table: Table<TestEntity>
  protected entityType = 'test_entity'

  constructor(db: MockDatabase) {
    super()
    this.table = db.test_entities
    // Set the sync_queue reference in the mock db object
    mockDb.sync_queue = db.sync_queue
  }

  // Override applyFilters to work with test mock
  protected applyFilters(query: any, filters: Record<string, unknown>): any {
    // For testing, just filter the array after fetching
    const filterFn = (item: any) => {
      return Object.entries(filters).every(([key, value]) => {
        if (value === undefined || value === null) return true
        if (Array.isArray(value)) {
          return value.includes(item[key])
        } else if (
          typeof value === 'object' &&
          value !== null &&
          'from' in value &&
          'to' in value
        ) {
          const v = value as any
          return item[key] >= v.from && item[key] <= v.to
        } else {
          return item[key] === value
        }
      })
    }

    // Override toArray for list method
    if (query.toArray) {
      const originalToArray = query.toArray.bind(query)
      query.toArray = async () => {
        const results = await originalToArray()
        return results.filter(filterFn)
      }
    }

    // Override count for count method
    if (query.count) {
      const originalCount = query.count.bind(query)
      query.count = async () => {
        const results = await this.table.toArray()
        return results.filter(filterFn).length
      }
    }

    // Override first for findOne method
    if (query.first) {
      const originalFirst = query.first.bind(query)
      query.first = async () => {
        const results = await this.table.toArray()
        return results.filter(filterFn)[0]
      }
    }

    return query
  }
}

describe('BaseRepository', () => {
  let mockDb: MockDatabase
  let repository: TestRepository
  let syncServiceMock: any

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks()

    // Create new mock database and repository
    mockDb = new MockDatabase()
    await mockDb.open()

    repository = new TestRepository(mockDb)

    // Get sync service mock
    syncServiceMock = { addToSyncQueue: mockAddToSyncQueue }

    // Reset mock counts again
    vi.clearAllMocks()
  })

  afterEach(async () => {
    // Clean up database
    await mockDb.delete()
  })

  describe('create', () => {
    it('should create a new entity with generated id and timestamps', async () => {
      const data = { name: 'Test Item', value: 100 }
      const result = await repository.create(data)

      expect(result).toMatchObject({
        name: 'Test Item',
        value: 100,
      })
      expect(result.id).toBeDefined()
      expect(result.created_at).toBeDefined()
      expect(result.updated_at).toBeDefined()
      expect(result.created_at).toBe(result.updated_at)
    })

    it('should add the entity to the database', async () => {
      const data = { name: 'Test Item', value: 100 }
      const result = await repository.create(data)

      const dbEntity = await mockDb.test_entities.get(result.id)
      expect(dbEntity).toEqual(result)
    })

    it('should add to sync queue after creation', async () => {
      const data = { name: 'Test Item', value: 100 }
      await repository.create(data)

      expect(mockAddToSyncQueue).toHaveBeenCalledWith(
        'test_entity',
        expect.any(String),
        'create',
        expect.objectContaining(data)
      )
    })

    it('should handle errors during creation', async () => {
      // Mock table.add to throw error
      vi.spyOn(mockDb.test_entities, 'add').mockRejectedValueOnce(new Error('Database error'))

      await expect(repository.create({ name: 'Test', value: 100 })).rejects.toThrow(
        'Failed to create test_entity: Error: Database error'
      )
    })

    it('should not add to sync queue if entity type is sync_queue', async () => {
      // Create a sync queue repository
      class SyncQueueRepository extends BaseRepository<any> {
        protected table = mockDb.sync_queue
        protected entityType = 'sync_queue'
      }

      const syncQueueRepo = new SyncQueueRepository()
      await syncQueueRepo.create({ operation_type: 'CREATE' })

      expect(mockAddToSyncQueue).not.toHaveBeenCalled()
    })
  })

  describe('getById', () => {
    it('should retrieve an entity by id', async () => {
      const entity = await repository.create({ name: 'Test', value: 100 })
      const result = await repository.getById(entity.id)

      expect(result).toEqual(entity)
    })

    it('should return undefined for non-existent id', async () => {
      const result = await repository.getById('non-existent-id')
      expect(result).toBeUndefined()
    })

    it('should handle errors during retrieval', async () => {
      vi.spyOn(mockDb.test_entities, 'get').mockRejectedValueOnce(new Error('Database error'))

      await expect(repository.getById('test-id')).rejects.toThrow(
        'Failed to get test_entity by ID: Error: Database error'
      )
    })
  })

  describe('update', () => {
    it('should update an entity and modify updated_at', async () => {
      const entity = await repository.create({ name: 'Original', value: 100 })
      const originalUpdatedAt = entity.updated_at

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))

      const updated = await repository.update(entity.id, { name: 'Updated', value: 200 })

      expect(updated.name).toBe('Updated')
      expect(updated.value).toBe(200)
      expect(updated.created_at).toBe(entity.created_at)
      expect(updated.updated_at).not.toBe(originalUpdatedAt)
    })

    it('should add update operation to sync queue', async () => {
      const entity = await repository.create({ name: 'Test', value: 100 })
      vi.clearAllMocks()

      await repository.update(entity.id, { value: 200 })

      expect(mockAddToSyncQueue).toHaveBeenCalledWith(
        'test_entity',
        entity.id,
        'update',
        expect.objectContaining({ value: 200 })
      )
    })

    it('should throw error if entity does not exist', async () => {
      await expect(repository.update('non-existent', { name: 'Test' })).rejects.toThrow(
        'test_entity with ID non-existent not found'
      )
    })

    it('should handle errors during update', async () => {
      const entity = await repository.create({ name: 'Test', value: 100 })
      vi.spyOn(mockDb.test_entities, 'update').mockRejectedValueOnce(new Error('Database error'))

      await expect(repository.update(entity.id, { value: 200 })).rejects.toThrow(
        'Failed to update test_entity: Error: Database error'
      )
    })

    it('should not update created_at field', async () => {
      const entity = await repository.create({ name: 'Test', value: 100 })
      const result = await repository.update(entity.id, { name: 'Updated' })

      expect(result.created_at).toBe(entity.created_at)
    })
  })

  describe('delete', () => {
    it('should delete an entity', async () => {
      const entity = await repository.create({ name: 'Test', value: 100 })
      await repository.delete(entity.id)

      const result = await repository.getById(entity.id)
      expect(result).toBeUndefined()
    })

    it('should add delete operation to sync queue with entity data', async () => {
      const entity = await repository.create({ name: 'Test', value: 100 })
      vi.clearAllMocks()

      await repository.delete(entity.id)

      expect(mockAddToSyncQueue).toHaveBeenCalledWith('test_entity', entity.id, 'delete', entity)
    })

    it('should throw error if entity does not exist', async () => {
      await expect(repository.delete('non-existent')).rejects.toThrow(
        'test_entity with ID non-existent not found'
      )
    })

    it('should handle errors during deletion', async () => {
      const entity = await repository.create({ name: 'Test', value: 100 })
      vi.spyOn(mockDb.test_entities, 'delete').mockRejectedValueOnce(new Error('Database error'))

      await expect(repository.delete(entity.id)).rejects.toThrow(
        'Failed to delete test_entity: Error: Database error'
      )
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      // Create test data
      await repository.create({ name: 'Item 1', value: 100 })
      await repository.create({ name: 'Item 2', value: 200 })
      await repository.create({ name: 'Item 3', value: 300 })
    })

    it('should list all entities ordered by updated_at descending', async () => {
      const result = await repository.list()

      expect(result).toHaveLength(3)
      // Check descending order
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].updated_at >= result[i + 1].updated_at).toBe(true)
      }
    })

    it('should filter entities by single value', async () => {
      const result = await repository.list({ value: 200 })

      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(200)
    })

    it('should filter entities by array of values', async () => {
      const result = await repository.list({ value: [100, 300] })

      expect(result).toHaveLength(2)
      expect(result.map(e => e.value).sort()).toEqual([100, 300])
    })

    it('should filter entities by range', async () => {
      const result = await repository.list({
        value: { from: 150, to: 250 },
      })

      expect(result).toHaveLength(1)
      expect(result[0].value).toBe(200)
    })

    it('should handle multiple filters', async () => {
      await repository.create({ name: 'Item 2', value: 400 })

      const result = await repository.list({
        name: 'Item 2',
        value: 200,
      })

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ name: 'Item 2', value: 200 })
    })

    it('should handle errors during listing', async () => {
      vi.spyOn(mockDb.test_entities, 'orderBy').mockImplementationOnce(() => {
        throw new Error('Database error')
      })

      await expect(repository.list()).rejects.toThrow(
        'Failed to list test_entity: Error: Database error'
      )
    })
  })

  describe('count', () => {
    beforeEach(async () => {
      await repository.create({ name: 'Item 1', value: 100 })
      await repository.create({ name: 'Item 2', value: 200 })
      await repository.create({ name: 'Item 3', value: 300 })
    })

    it('should count all entities', async () => {
      const count = await repository.count()
      expect(count).toBe(3)
    })

    it('should count filtered entities', async () => {
      const count = await repository.count({ value: 200 })
      expect(count).toBe(1)
    })

    it('should handle errors during counting', async () => {
      vi.spyOn(mockDb.test_entities, 'toCollection').mockImplementationOnce(() => {
        throw new Error('Database error')
      })

      await expect(repository.count()).rejects.toThrow(
        'Failed to count test_entity: Error: Database error'
      )
    })
  })

  describe('bulkCreate', () => {
    it('should create multiple entities at once', async () => {
      const items = [
        { name: 'Item 1', value: 100 },
        { name: 'Item 2', value: 200 },
        { name: 'Item 3', value: 300 },
      ]

      const result = await repository.bulkCreate(items)

      expect(result).toHaveLength(3)
      result.forEach((entity, index) => {
        expect(entity).toMatchObject(items[index])
        expect(entity.id).toBeDefined()
        expect(entity.created_at).toBeDefined()
        expect(entity.updated_at).toBeDefined()
      })
    })

    it('should add all entities to the database', async () => {
      const items = [
        { name: 'Item 1', value: 100 },
        { name: 'Item 2', value: 200 },
      ]

      const result = await repository.bulkCreate(items)
      const dbEntities = await mockDb.test_entities.toArray()

      expect(dbEntities).toHaveLength(2)
      expect(dbEntities).toEqual(expect.arrayContaining(result))
    })

    it('should add bulk operations to sync queue', async () => {
      const items = [
        { name: 'Item 1', value: 100 },
        { name: 'Item 2', value: 200 },
      ]

      // Mock sync_queue.bulkAdd to track calls
      const bulkAddSpy = vi.spyOn(mockDb.sync_queue, 'bulkAdd').mockResolvedValue([])

      await repository.bulkCreate(items)

      expect(bulkAddSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            operation_type: 'CREATE',
            entity_type: 'test_entity',
          }),
          expect.objectContaining({
            operation_type: 'CREATE',
            entity_type: 'test_entity',
          }),
        ])
      )
    })

    it('should handle errors during bulk creation', async () => {
      vi.spyOn(mockDb.test_entities, 'bulkAdd').mockRejectedValueOnce(new Error('Database error'))

      await expect(repository.bulkCreate([{ name: 'Test', value: 100 }])).rejects.toThrow(
        'Failed to bulk create test_entity: Error: Database error'
      )
    })
  })

  describe('bulkUpdate', () => {
    let entities: TestEntity[]

    beforeEach(async () => {
      entities = await repository.bulkCreate([
        { name: 'Item 1', value: 100 },
        { name: 'Item 2', value: 200 },
        { name: 'Item 3', value: 300 },
      ])
    })

    it('should update multiple entities at once', async () => {
      const updates = [
        { id: entities[0].id, data: { value: 150 } },
        { id: entities[1].id, data: { value: 250 } },
      ]

      const result = await repository.bulkUpdate(updates)

      expect(result).toHaveLength(2)
      expect(result[0].value).toBe(150)
      expect(result[1].value).toBe(250)
    })

    it('should update timestamps for all updated entities', async () => {
      const originalTimestamps = entities.map(e => e.updated_at)

      // Wait to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))

      const updates = entities.map(e => ({
        id: e.id,
        data: { value: e.value + 50 },
      }))

      const result = await repository.bulkUpdate(updates)

      result.forEach((entity, index) => {
        expect(entity.updated_at).not.toBe(originalTimestamps[index])
        expect(entity.created_at).toBe(entities[index].created_at)
      })
    })

    it('should add bulk update operations to sync queue', async () => {
      await mockDb.sync_queue.clear() // Clear previous operations

      const updates = [
        { id: entities[0].id, data: { value: 150 } },
        { id: entities[1].id, data: { value: 250 } },
      ]

      await repository.bulkUpdate(updates)

      const syncQueueItems = await mockDb.sync_queue.toArray()
      expect(syncQueueItems).toHaveLength(2)
      syncQueueItems.forEach(item => {
        expect(item.operation_type).toBe('UPDATE')
        expect(item.entity_type).toBe('test_entity')
      })
    })

    it('should handle errors during bulk update', async () => {
      // Create an entity first
      const entity = await repository.create({ name: 'Test', value: 100 })

      // Mock the table update method to throw an error
      const originalUpdate = mockDb.test_entities.update
      mockDb.test_entities.update = vi.fn().mockRejectedValueOnce(new Error('Update error'))

      await expect(
        repository.bulkUpdate([{ id: entity.id, data: { value: 200 } }])
      ).rejects.toThrow('Failed to bulk update test_entity: Error: Update error')

      // Restore original update
      mockDb.test_entities.update = originalUpdate
    })
  })

  describe('bulkDelete', () => {
    let entities: TestEntity[]

    beforeEach(async () => {
      entities = await repository.bulkCreate([
        { name: 'Item 1', value: 100 },
        { name: 'Item 2', value: 200 },
        { name: 'Item 3', value: 300 },
      ])
    })

    it('should delete multiple entities at once', async () => {
      const idsToDelete = [entities[0].id, entities[2].id]
      await repository.bulkDelete(idsToDelete)

      const remaining = await repository.list()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe(entities[1].id)
    })

    it('should add bulk delete operations to sync queue', async () => {
      const bulkAddSpy = vi.spyOn(mockDb.sync_queue, 'bulkAdd').mockResolvedValue([])

      const idsToDelete = [entities[0].id, entities[1].id]
      await repository.bulkDelete(idsToDelete)

      expect(bulkAddSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            operation_type: 'DELETE',
            entity_type: 'test_entity',
            payload: expect.objectContaining({ id: entities[0].id }),
          }),
          expect.objectContaining({
            operation_type: 'DELETE',
            entity_type: 'test_entity',
            payload: expect.objectContaining({ id: entities[1].id }),
          }),
        ])
      )
    })

    it('should handle errors during bulk delete', async () => {
      vi.spyOn(mockDb.test_entities, 'where').mockImplementationOnce(() => {
        throw new Error('Database error')
      })

      await expect(repository.bulkDelete(['id1', 'id2'])).rejects.toThrow(
        'Failed to bulk delete test_entity: Error: Database error'
      )
    })
  })

  describe('findOne', () => {
    beforeEach(async () => {
      await repository.bulkCreate([
        { name: 'Item 1', value: 100 },
        { name: 'Item 2', value: 200 },
        { name: 'Item 2', value: 300 },
      ])
    })

    it('should find the first entity matching filters', async () => {
      const result = await repository.findOne({ name: 'Item 2' })

      expect(result).toBeDefined()
      expect(result?.name).toBe('Item 2')
    })

    it('should return undefined if no match found', async () => {
      const result = await repository.findOne({ name: 'Non-existent' })
      expect(result).toBeUndefined()
    })

    it('should handle errors during find', async () => {
      vi.spyOn(mockDb.test_entities, 'toCollection').mockImplementationOnce(() => {
        throw new Error('Database error')
      })

      await expect(repository.findOne({ name: 'Test' })).rejects.toThrow(
        'Failed to find test_entity: Error: Database error'
      )
    })
  })

  describe('exists', () => {
    it('should return true if entity exists', async () => {
      const entity = await repository.create({ name: 'Test', value: 100 })
      const exists = await repository.exists(entity.id)

      expect(exists).toBe(true)
    })

    it('should return false if entity does not exist', async () => {
      const exists = await repository.exists('non-existent')
      expect(exists).toBe(false)
    })

    it('should return false on database error', async () => {
      vi.spyOn(mockDb.test_entities, 'get').mockRejectedValueOnce(new Error('Database error'))

      const exists = await repository.exists('test-id')
      expect(exists).toBe(false)
    })
  })

  describe('getMany', () => {
    let entities: TestEntity[]

    beforeEach(async () => {
      entities = await repository.bulkCreate([
        { name: 'Item 1', value: 100 },
        { name: 'Item 2', value: 200 },
        { name: 'Item 3', value: 300 },
      ])
    })

    it('should retrieve multiple entities by ids', async () => {
      const ids = [entities[0].id, entities[2].id]
      const result = await repository.getMany(ids)

      expect(result).toHaveLength(2)
      expect(result.map(e => e.id).sort()).toEqual(ids.sort())
    })

    it('should return empty array for non-existent ids', async () => {
      const result = await repository.getMany(['non-existent-1', 'non-existent-2'])
      expect(result).toEqual([])
    })

    it('should handle errors during retrieval', async () => {
      vi.spyOn(mockDb.test_entities, 'where').mockImplementationOnce(() => {
        throw new Error('Database error')
      })

      await expect(repository.getMany(['id1', 'id2'])).rejects.toThrow(
        'Failed to get many test_entity: Error: Database error'
      )
    })
  })

  describe('clear', () => {
    it('should remove all entities from the table', async () => {
      await repository.bulkCreate([
        { name: 'Item 1', value: 100 },
        { name: 'Item 2', value: 200 },
      ])

      await repository.clear()
      const count = await repository.count()

      expect(count).toBe(0)
    })

    it('should handle errors during clear', async () => {
      vi.spyOn(mockDb.test_entities, 'clear').mockRejectedValueOnce(new Error('Database error'))

      await expect(repository.clear()).rejects.toThrow(
        'Failed to clear test_entity: Error: Database error'
      )
    })
  })

  describe('getLastUpdated', () => {
    it('should return the most recently updated timestamp', async () => {
      const entity1 = await repository.create({ name: 'Item 1', value: 100 })
      await new Promise(resolve => setTimeout(resolve, 10))
      const entity2 = await repository.create({ name: 'Item 2', value: 200 })
      await new Promise(resolve => setTimeout(resolve, 10))
      await repository.update(entity1.id, { value: 150 })

      const lastUpdated = await repository.getLastUpdated()
      const updatedEntity = await repository.getById(entity1.id)

      expect(lastUpdated).toBe(updatedEntity?.updated_at)
    })

    it('should return undefined if table is empty', async () => {
      const lastUpdated = await repository.getLastUpdated()
      expect(lastUpdated).toBeUndefined()
    })

    it('should return undefined on error', async () => {
      vi.spyOn(mockDb.test_entities, 'orderBy').mockImplementationOnce(() => {
        throw new Error('Database error')
      })

      const lastUpdated = await repository.getLastUpdated()
      expect(lastUpdated).toBeUndefined()
    })
  })

  describe('getCreatedAfter', () => {
    it('should return entities created after specified timestamp', async () => {
      const entity1 = await repository.create({ name: 'Item 1', value: 100 })
      const timestamp = new Date().toISOString()
      await new Promise(resolve => setTimeout(resolve, 10))
      const entity2 = await repository.create({ name: 'Item 2', value: 200 })

      const result = await repository.getCreatedAfter(timestamp)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(entity2.id)
    })

    it('should return empty array if no entities created after timestamp', async () => {
      await repository.create({ name: 'Item 1', value: 100 })
      const futureTimestamp = new Date(Date.now() + 10000).toISOString()

      const result = await repository.getCreatedAfter(futureTimestamp)
      expect(result).toEqual([])
    })

    it('should handle errors', async () => {
      vi.spyOn(mockDb.test_entities, 'where').mockImplementationOnce(() => {
        throw new Error('Database error')
      })

      await expect(repository.getCreatedAfter('2024-01-01')).rejects.toThrow(
        'Failed to get test_entity created after timestamp: Error: Database error'
      )
    })
  })

  describe('getUpdatedAfter', () => {
    it('should return entities updated after specified timestamp', async () => {
      const entity1 = await repository.create({ name: 'Item 1', value: 100 })
      const entity2 = await repository.create({ name: 'Item 2', value: 200 })
      const timestamp = new Date().toISOString()
      await new Promise(resolve => setTimeout(resolve, 10))
      await repository.update(entity1.id, { value: 150 })

      const result = await repository.getUpdatedAfter(timestamp)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(entity1.id)
    })

    it('should handle errors', async () => {
      vi.spyOn(mockDb.test_entities, 'where').mockImplementationOnce(() => {
        throw new Error('Database error')
      })

      await expect(repository.getUpdatedAfter('2024-01-01')).rejects.toThrow(
        'Failed to get test_entity updated after timestamp: Error: Database error'
      )
    })
  })

  describe('getStatistics', () => {
    it('should return correct statistics', async () => {
      // Create entities on different days
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      // Create entities manually with specific timestamps
      const yesterdayEntity: TestEntity = {
        id: crypto.randomUUID(),
        name: 'Yesterday Item',
        value: 100,
        created_at: yesterday.toISOString(),
        updated_at: yesterday.toISOString(),
      }

      const todayEntity1: TestEntity = {
        id: crypto.randomUUID(),
        name: 'Today Item 1',
        value: 200,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const todayEntity2: TestEntity = {
        id: crypto.randomUUID(),
        name: 'Today Item 2',
        value: 300,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await mockDb.test_entities.add(yesterdayEntity)
      await mockDb.test_entities.add(todayEntity1)
      await mockDb.test_entities.add(todayEntity2)

      const stats = await repository.getStatistics()

      expect(stats.total).toBe(3)
      expect(stats.createdToday).toBe(2)
      expect(stats.updatedToday).toBe(2)
      expect(stats.oldestRecord).toBeDefined()
      expect(stats.newestRecord).toBeDefined()
    })

    it('should handle empty table', async () => {
      const stats = await repository.getStatistics()

      expect(stats.total).toBe(0)
      expect(stats.createdToday).toBe(0)
      expect(stats.updatedToday).toBe(0)
      expect(stats.oldestRecord).toBeUndefined()
      expect(stats.newestRecord).toBeUndefined()
    })

    it('should handle errors', async () => {
      vi.spyOn(mockDb.test_entities, 'count').mockRejectedValueOnce(new Error('Database error'))

      await expect(repository.getStatistics()).rejects.toThrow(
        'Failed to get test_entity statistics: Error: Database error'
      )
    })
  })

  describe('withOptimisticUpdate', () => {
    it('should apply optimistic update and execute operation', async () => {
      const entity = await repository.create({ name: 'Test', value: 100 })
      const onUpdate = vi.fn()
      const onRevert = vi.fn()
      const operation = vi.fn().mockResolvedValue('success')

      const result = await repository.withOptimisticUpdate(
        entity.id,
        { value: 200 },
        operation,
        onUpdate,
        onRevert
      )

      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: entity.id, value: 200 }))
      expect(operation).toHaveBeenCalled()
      expect(result).toBe('success')
      expect(onRevert).not.toHaveBeenCalled()
    })

    it('should revert optimistic update on operation failure', async () => {
      const entity = await repository.create({ name: 'Test', value: 100 })
      const onUpdate = vi.fn()
      const onRevert = vi.fn()
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'))

      await expect(
        repository.withOptimisticUpdate(entity.id, { value: 200 }, operation, onUpdate, onRevert)
      ).rejects.toThrow('Operation failed')

      expect(onUpdate).toHaveBeenCalled()
      expect(onRevert).toHaveBeenCalledWith(entity)
    })

    it('should throw error if entity not found', async () => {
      const onUpdate = vi.fn()
      const onRevert = vi.fn()
      const operation = vi.fn()

      await expect(
        repository.withOptimisticUpdate(
          'non-existent',
          { value: 200 },
          operation,
          onUpdate,
          onRevert
        )
      ).rejects.toThrow('Entity non-existent not found')

      expect(onUpdate).not.toHaveBeenCalled()
      expect(operation).not.toHaveBeenCalled()
    })
  })

  describe('validateEntity', () => {
    it('should return empty array for valid entity', async () => {
      const errors = await repository.validateEntity({
        id: 'test-id',
        name: 'Test',
        value: 100,
      })

      expect(errors).toEqual([])
    })

    it('should return error for missing id in non-create operation', async () => {
      const errors = await repository.validateEntity({
        name: 'Test',
        value: 100,
      })

      expect(errors).toContain('ID is required')
    })

    it('should handle partial entities', async () => {
      const errors = await repository.validateEntity({
        id: 'test-id',
        value: 100,
        // name is missing but might be optional in update
      })

      expect(errors).toEqual([])
    })
  })

  describe('backup', () => {
    it('should return all entities in the table', async () => {
      const entities = await repository.bulkCreate([
        { name: 'Item 1', value: 100 },
        { name: 'Item 2', value: 200 },
        { name: 'Item 3', value: 300 },
      ])

      const backup = await repository.backup()

      expect(backup).toHaveLength(3)
      expect(backup).toEqual(expect.arrayContaining(entities))
    })

    it('should return empty array for empty table', async () => {
      const backup = await repository.backup()
      expect(backup).toEqual([])
    })

    it('should handle errors', async () => {
      vi.spyOn(mockDb.test_entities, 'toArray').mockRejectedValueOnce(new Error('Database error'))

      await expect(repository.backup()).rejects.toThrow(
        'Failed to backup test_entity: Error: Database error'
      )
    })
  })

  describe('restore', () => {
    it('should clear table and restore entities', async () => {
      // Create initial data
      await repository.create({ name: 'Old Item', value: 50 })

      // Prepare restore data
      const restoreData: TestEntity[] = [
        {
          id: 'restore-1',
          name: 'Restored Item 1',
          value: 100,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'restore-2',
          name: 'Restored Item 2',
          value: 200,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
      ]

      await repository.restore(restoreData)

      const allEntities = await repository.list()
      expect(allEntities).toHaveLength(2)
      expect(allEntities).toEqual(expect.arrayContaining(restoreData))
    })

    it('should handle errors during restore', async () => {
      vi.spyOn(mockDb.test_entities, 'clear').mockRejectedValueOnce(new Error('Clear failed'))

      await expect(repository.restore([])).rejects.toThrow(
        'Failed to restore test_entity: Error: Clear failed'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle null and undefined filter values', async () => {
      await repository.create({ name: 'Test', value: 100 })

      const result1 = await repository.list({ value: null })
      const result2 = await repository.list({ value: undefined })

      expect(result1).toHaveLength(1) // null is ignored
      expect(result2).toHaveLength(1) // undefined is ignored
    })

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) =>
        repository.create({ name: `Item ${i}`, value: i * 100 })
      )

      const results = await Promise.all(operations)

      expect(results).toHaveLength(10)
      const allEntities = await repository.list()
      expect(allEntities).toHaveLength(10)
    })

    it('should handle very large bulk operations', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        name: `Item ${i}`,
        value: i,
      }))

      const result = await repository.bulkCreate(largeDataset)

      expect(result).toHaveLength(1000)
      const count = await repository.count()
      expect(count).toBe(1000)
    })

    it('should maintain data integrity during transaction failures', async () => {
      const entity = await repository.create({ name: 'Test', value: 100 })

      // Mock the sync_queue add to fail during bulk update
      const originalAdd = mockDb.sync_queue.bulkAdd
      mockDb.sync_queue.bulkAdd = vi.fn().mockRejectedValueOnce(new Error('Sync queue error'))

      await expect(
        repository.bulkUpdate([{ id: entity.id, data: { value: 200 } }])
      ).rejects.toThrow('Failed to bulk update test_entity')

      // Restore original bulkAdd
      mockDb.sync_queue.bulkAdd = originalAdd

      // Verify the entity still exists (error was handled properly)
      const entity2 = await repository.getById(entity.id)
      expect(entity2).toBeDefined()
    })
  })
})
