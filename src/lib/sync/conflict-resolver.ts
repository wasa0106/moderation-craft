/**
 * ConflictResolver - Handles sync conflicts using last-write-wins strategy
 * Resolves conflicts between local and remote data
 */

import { DatabaseEntity } from '@/types'

export interface ConflictData<T extends DatabaseEntity> {
  local: T
  remote: T
  field: keyof T
}

export interface ConflictResolution<T extends DatabaseEntity> {
  resolved: T
  conflictFields: Array<keyof T>
  strategy: 'local' | 'remote' | 'merged'
}

export class ConflictResolver {
  /**
   * Resolves conflicts using last-write-wins strategy
   * Compares updated_at timestamps to determine which version to keep
   */
  static resolve<T extends DatabaseEntity>(local: T, remote: T): ConflictResolution<T> {
    const localUpdatedAt = new Date(local.updated_at)
    const remoteUpdatedAt = new Date(remote.updated_at)

    // Find conflicting fields
    const conflictFields = this.findConflictFields(local, remote)

    // Last-write-wins: use the most recently updated version
    if (localUpdatedAt > remoteUpdatedAt) {
      return {
        resolved: local,
        conflictFields,
        strategy: 'local',
      }
    } else if (remoteUpdatedAt > localUpdatedAt) {
      return {
        resolved: remote,
        conflictFields,
        strategy: 'remote',
      }
    } else {
      // If timestamps are equal, prefer remote (server truth)
      return {
        resolved: remote,
        conflictFields,
        strategy: 'remote',
      }
    }
  }

  /**
   * Finds fields that differ between local and remote versions
   */
  private static findConflictFields<T extends DatabaseEntity>(local: T, remote: T): Array<keyof T> {
    const conflicts: Array<keyof T> = []

    // Skip system fields in comparison
    const skipFields = ['id', 'created_at', 'updated_at']

    Object.keys(local).forEach(key => {
      const field = key as keyof T

      if (skipFields.includes(String(field))) {
        return
      }

      const localValue = local[field]
      const remoteValue = remote[field]

      if (!this.isEqual(localValue, remoteValue)) {
        conflicts.push(field)
      }
    })

    return conflicts
  }

  /**
   * Deep equality comparison for conflict detection
   */
  private static isEqual(a: any, b: any): boolean {
    if (a === b) return true

    if (a == null || b == null) return a === b

    if (typeof a !== typeof b) return false

    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false

      if (Array.isArray(a)) {
        if (a.length !== b.length) return false
        return a.every((item, index) => this.isEqual(item, b[index]))
      }

      const keysA = Object.keys(a)
      const keysB = Object.keys(b)

      if (keysA.length !== keysB.length) return false

      return keysA.every(key => keysB.includes(key) && this.isEqual(a[key], b[key]))
    }

    return false
  }

  /**
   * Merges two entities with custom merge strategy
   * Currently uses last-write-wins, but can be extended for field-level merging
   */
  static merge<T extends DatabaseEntity>(
    local: T,
    remote: T,
    customMergeFields?: Partial<Record<keyof T, 'local' | 'remote' | 'latest'>>
  ): ConflictResolution<T> {
    if (!customMergeFields) {
      return this.resolve(local, remote)
    }

    const conflictFields = this.findConflictFields(local, remote)
    const merged = { ...remote } // Start with remote as base

    // Apply custom merge strategies for specific fields
    Object.entries(customMergeFields).forEach(([field, strategy]) => {
      const fieldKey = field as keyof T

      switch (strategy) {
        case 'local':
          merged[fieldKey] = local[fieldKey]
          break
        case 'remote':
          merged[fieldKey] = remote[fieldKey]
          break
        case 'latest':
          // Use timestamp-based resolution for this field
          const localTime = new Date(local.updated_at)
          const remoteTime = new Date(remote.updated_at)
          merged[fieldKey] = localTime > remoteTime ? local[fieldKey] : remote[fieldKey]
          break
      }
    })

    return {
      resolved: merged,
      conflictFields,
      strategy: 'merged',
    }
  }

  /**
   * Determines if entities have resolvable conflicts
   */
  static hasConflicts<T extends DatabaseEntity>(local: T, remote: T): boolean {
    return this.findConflictFields(local, remote).length > 0
  }

  /**
   * Creates a conflict report for logging/debugging
   */
  static createConflictReport<T extends DatabaseEntity>(
    local: T,
    remote: T
  ): {
    hasConflicts: boolean
    conflictFields: Array<keyof T>
    localTimestamp: string
    remoteTimestamp: string
    recommendedStrategy: 'local' | 'remote'
  } {
    const conflictFields = this.findConflictFields(local, remote)
    const localTime = new Date(local.updated_at)
    const remoteTime = new Date(remote.updated_at)

    return {
      hasConflicts: conflictFields.length > 0,
      conflictFields,
      localTimestamp: local.updated_at,
      remoteTimestamp: remote.updated_at,
      recommendedStrategy: localTime > remoteTime ? 'local' : 'remote',
    }
  }
}
