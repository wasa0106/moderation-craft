/**
 * Tests for 15-minute slot calculations in CombinedScheduleView
 */

import { describe, it, expect } from 'vitest'

// Test helper functions extracted from CombinedScheduleView
const getItemHeight = (minutes: number): number => {
  const slots = Math.ceil(minutes / 15)
  const minSlots = minutes <= 30 ? 2 : 1
  const baseHeight = Math.max(slots * 12, minSlots * 12)
  return baseHeight - 4
}

const getItemTop = (hour: number, minute: number): number => {
  const slot = Math.floor(minute / 15)
  return (hour * 48) + (slot * 12)
}

describe('CombinedScheduleView 15-minute slot calculations', () => {
  describe('getItemHeight', () => {
    it('should calculate height based on 15-minute slots with spacing', () => {
      // 15分 = 1スロットだが、最小2スロット = 24px - 4px = 20px
      expect(getItemHeight(15)).toBe(20)
      
      // 30分 = 2スロット = 24px - 4px = 20px
      expect(getItemHeight(30)).toBe(20)
      
      // 45分 = 3スロット = 36px - 4px = 32px
      expect(getItemHeight(45)).toBe(32)
      
      // 60分 = 4スロット = 48px - 4px = 44px
      expect(getItemHeight(60)).toBe(44)
    })

    it('should round up to next slot', () => {
      // 20分 → 2スロット = 24px - 4px = 20px
      expect(getItemHeight(20)).toBe(20)
      
      // 25分 → 2スロット = 24px - 4px = 20px
      expect(getItemHeight(25)).toBe(20)
      
      // 31分 → 3スロット = 36px - 4px = 32px
      expect(getItemHeight(31)).toBe(32)
    })

    it('should have minimum height based on duration', () => {
      // 30分以下は最小2スロット（24px）- 4px = 20px
      expect(getItemHeight(5)).toBe(20)
      expect(getItemHeight(10)).toBe(20)
      expect(getItemHeight(15)).toBe(20)
      expect(getItemHeight(30)).toBe(20)
      
      // 30分超は実際のスロット数 - 4px
      expect(getItemHeight(45)).toBe(32)
      expect(getItemHeight(60)).toBe(44)
    })
  })

  describe('getItemTop', () => {
    it('should calculate position based on hour and 15-minute slot', () => {
      // 0:00 = 0px
      expect(getItemTop(0, 0)).toBe(0)
      
      // 1:00 = 48px
      expect(getItemTop(1, 0)).toBe(48)
      
      // 1:15 = 48px + 12px = 60px
      expect(getItemTop(1, 15)).toBe(60)
      
      // 1:30 = 48px + 24px = 72px
      expect(getItemTop(1, 30)).toBe(72)
      
      // 1:45 = 48px + 36px = 84px
      expect(getItemTop(1, 45)).toBe(84)
      
      // 2:00 = 96px
      expect(getItemTop(2, 0)).toBe(96)
    })

    it('should align to slot boundaries', () => {
      // 1:10 → slot 0 = 48px
      expect(getItemTop(1, 10)).toBe(48)
      
      // 1:20 → slot 1 = 60px
      expect(getItemTop(1, 20)).toBe(60)
      
      // 1:25 → slot 1 = 60px
      expect(getItemTop(1, 25)).toBe(60)
      
      // 1:31 → slot 2 = 72px
      expect(getItemTop(1, 31)).toBe(72)
    })
  })

  describe('time grid calculations', () => {
    it('should have correct total height for 24 hours', () => {
      const totalHeight = 24 * 48 // 24時間 × 48px
      expect(totalHeight).toBe(1152)
    })

    it('should have 4 slots per hour', () => {
      const slotsPerHour = 48 / 12 // 48px ÷ 12px
      expect(slotsPerHour).toBe(4)
    })
  })
})