/**
 * IntegratedScheduler - FlowWorkとRecurringWorkの統合スケジューリング
 * 2系統の作業を考慮した現実的な自動スケジューリングを実現
 */

import { FlowWork, RecurringWork } from '@/types'
import { SchedulingResult } from '@/stores/project-creation-store'
import {
  format,
  addDays,
  addHours,
  addMinutes,
  differenceInMinutes,
  getDay,
  isWithinInterval,
  isSameDay,
  parse,
  startOfDay,
  endOfDay,
} from 'date-fns'
import { getHolidaysOfYear } from 'holiday-jp-since'

interface TimeSlot {
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  minutes: number
  type: 'available' | 'occupied'
  workId?: string
  workType?: 'flow' | 'hard' | 'soft'
}

interface DailySchedule {
  date: string
  slots: TimeSlot[]
  availableMinutes: number
  occupiedMinutes: number
}

export class IntegratedScheduler {
  private schedules: Map<string, DailySchedule> = new Map()
  private holidays: Set<string> = new Set()

  constructor(
    private startDate: Date,
    private endDate: Date,
    private workableWeekdays: boolean[],
    private weekdayHours: number[],
    private excludeHolidays: boolean,
    private holidayWorkHours?: number
  ) {
    this.initializeHolidays()
    this.initializeSchedules()
  }

  private initializeHolidays() {
    const startYear = this.startDate.getFullYear()
    const endYear = this.endDate.getFullYear()
    
    for (let year = startYear; year <= endYear; year++) {
      const holidays = getHolidaysOfYear(year)
      holidays.forEach(holiday => {
        // holiday-jp-sinceの形式に応じて日付を生成
        const holidayDate = new Date(year, holiday.month - 1, holiday.day)
        this.holidays.add(format(holidayDate, 'yyyy-MM-dd'))
      })
    }
  }

  private initializeSchedules() {
    let current = new Date(this.startDate)
    
    while (current <= this.endDate) {
      const dateStr = format(current, 'yyyy-MM-dd')
      const dayOfWeek = getDay(current)
      const isHoliday = this.holidays.has(dateStr)
      
      let workHours = 0
      if (isHoliday && this.excludeHolidays) {
        workHours = 0
      } else if (isHoliday && !this.excludeHolidays) {
        workHours = this.holidayWorkHours || 0
      } else {
        workHours = this.workableWeekdays[dayOfWeek] ? this.weekdayHours[dayOfWeek] : 0
      }
      
      const slots: TimeSlot[] = []
      if (workHours > 0) {
        // 9:00開始を基本とし、利用可能時間を1つのスロットとして作成
        slots.push({
          date: dateStr,
          startTime: '09:00',
          endTime: format(addHours(parse('09:00', 'HH:mm', new Date()), workHours), 'HH:mm'),
          minutes: workHours * 60,
          type: 'available',
        })
      }
      
      this.schedules.set(dateStr, {
        date: dateStr,
        slots,
        availableMinutes: workHours * 60,
        occupiedMinutes: 0,
      })
      
      current = addDays(current, 1)
    }
  }

  schedule(
    flowWorks: FlowWork[],
    recurringWorks: RecurringWork[]
  ): SchedulingResult {
    if (process.env.NODE_ENV === 'development') {
      console.log('📅 スケジューリング開始', {
        flowWorks: flowWorks.length,
        recurringWorks: recurringWorks.length,
        startDate: format(this.startDate, 'yyyy-MM-dd'),
        endDate: format(this.endDate, 'yyyy-MM-dd'),
      })
    }

    const placements: SchedulingResult['placements'] = []
    const unplaced: RecurringWork[] = []
    const conflicts: SchedulingResult['conflicts'] = []

    // Step 1: RecurringWork(hard)を固定配置
    const hardWorks = recurringWorks.filter(w => w.kind === 'hard')
    const hardPlacements = this.placeHardRecurring(hardWorks)
    placements.push(...hardPlacements)

    // Step 2: FlowWorkを空きスロットに順次配置
    const flowPlacements = this.placeFlowWorks(flowWorks)
    placements.push(...flowPlacements)

    // Step 3: RecurringWork(soft)を配置（衝突時はシフト）
    const softWorks = recurringWorks.filter(w => w.kind === 'soft')
    const softResults = this.placeSoftRecurring(softWorks)
    placements.push(...softResults.placed)
    unplaced.push(...softResults.unplaced)

    // 統計情報を計算
    const stats = this.calculateStats(flowWorks, recurringWorks, placements)

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ スケジューリング完了', {
        placements: placements.length,
        unplaced: unplaced.length,
        conflicts: conflicts.length,
        stats,
      })
    }

    return {
      placements,
      unplaced,
      conflicts,
      stats,
    }
  }

  private placeHardRecurring(hardWorks: RecurringWork[]): SchedulingResult['placements'] {
    const placements: SchedulingResult['placements'] = []
    
    for (const work of hardWorks) {
      const instances = this.generateRecurrenceInstances(work)
      
      for (const instance of instances) {
        const schedule = this.schedules.get(instance.date)
        if (!schedule) continue
        
        // 固定配置のため、強制的にスロットを確保
        const placement = {
          id: `${work.id}-${instance.date}`,
          type: 'hard' as const,
          title: work.title,
          startDate: instance.date,
          endDate: instance.date,
          startTime: work.startTime,
          endTime: format(
            addMinutes(parse(work.startTime, 'HH:mm', new Date()), work.durationMinutes),
            'HH:mm'
          ),
          placed: true,
          shifted: false,
        }
        
        placements.push(placement)
        this.occupyTimeSlot(instance.date, work.startTime, work.durationMinutes, work.id, 'hard')
      }
    }
    
    return placements
  }

  private placeFlowWorks(flowWorks: FlowWork[]): SchedulingResult['placements'] {
    const placements: SchedulingResult['placements'] = []
    const sortedWorks = [...flowWorks].sort((a, b) => a.order - b.order)
    
    for (const work of sortedWorks) {
      let remainingMinutes = work.estimatedMinutes
      let currentDate = new Date(this.startDate)
      let workStartDate: string | null = null
      let workEndDate: string | null = null
      
      while (remainingMinutes > 0 && currentDate <= this.endDate) {
        const dateStr = format(currentDate, 'yyyy-MM-dd')
        const schedule = this.schedules.get(dateStr)
        
        if (schedule && schedule.availableMinutes - schedule.occupiedMinutes > 0) {
          const availableToday = schedule.availableMinutes - schedule.occupiedMinutes
          const allocateToday = Math.min(remainingMinutes, availableToday)
          
          if (!workStartDate) {
            workStartDate = dateStr
          }
          workEndDate = dateStr
          
          // スロットを占有
          const startTime = this.findAvailableStartTime(dateStr, allocateToday)
          if (startTime) {
            this.occupyTimeSlot(dateStr, startTime, allocateToday, work.id, 'flow')
          }
          
          remainingMinutes -= allocateToday
        }
        
        currentDate = addDays(currentDate, 1)
      }
      
      if (workStartDate && workEndDate) {
        placements.push({
          id: work.id,
          type: 'flow',
          title: work.title,
          startDate: workStartDate,
          endDate: workEndDate,
          placed: remainingMinutes === 0,
          shifted: false,
        })
      }
    }
    
    return placements
  }

  private placeSoftRecurring(
    softWorks: RecurringWork[]
  ): { placed: SchedulingResult['placements']; unplaced: RecurringWork[] } {
    const placed: SchedulingResult['placements'] = []
    const unplaced: RecurringWork[] = []
    
    for (const work of softWorks) {
      const instances = this.generateRecurrenceInstances(work)
      let hasUnplaced = false
      
      for (const instance of instances) {
        const result = this.tryPlaceSoftWork(work, instance.date)
        
        if (result.placed) {
          placed.push({
            id: `${work.id}-${instance.date}`,
            type: 'soft',
            title: work.title,
            startDate: instance.date,
            endDate: instance.date,
            startTime: result.startTime!,
            endTime: result.endTime!,
            placed: true,
            shifted: result.shifted,
            shiftAmount: result.shiftAmount,
          })
        } else {
          hasUnplaced = true
        }
      }
      
      if (hasUnplaced) {
        unplaced.push(work)
      }
    }
    
    return { placed, unplaced }
  }

  private tryPlaceSoftWork(
    work: RecurringWork,
    date: string
  ): {
    placed: boolean
    startTime?: string
    endTime?: string
    shifted: boolean
    shiftAmount?: { hours: number; days: number }
  } {
    const originalTime = work.startTime
    const shiftLimits = work.shiftLimits || { hours: 2, days: 1 }
    
    // まず元の時間で配置を試みる
    if (this.canPlaceAt(date, originalTime, work.durationMinutes)) {
      this.occupyTimeSlot(date, originalTime, work.durationMinutes, work.id, 'soft')
      return {
        placed: true,
        startTime: originalTime,
        endTime: format(
          addMinutes(parse(originalTime, 'HH:mm', new Date()), work.durationMinutes),
          'HH:mm'
        ),
        shifted: false,
      }
    }
    
    // 時間シフトを試みる（±X時間）
    for (let hourShift = -shiftLimits.hours; hourShift <= shiftLimits.hours; hourShift++) {
      if (hourShift === 0) continue
      
      const shiftedTime = format(
        addHours(parse(originalTime, 'HH:mm', new Date()), hourShift),
        'HH:mm'
      )
      
      if (this.canPlaceAt(date, shiftedTime, work.durationMinutes)) {
        this.occupyTimeSlot(date, shiftedTime, work.durationMinutes, work.id, 'soft')
        return {
          placed: true,
          startTime: shiftedTime,
          endTime: format(
            addMinutes(parse(shiftedTime, 'HH:mm', new Date()), work.durationMinutes),
            'HH:mm'
          ),
          shifted: true,
          shiftAmount: { hours: hourShift, days: 0 },
        }
      }
    }
    
    // 日付シフトを試みる（±Y日）
    for (let dayShift = -shiftLimits.days; dayShift <= shiftLimits.days; dayShift++) {
      if (dayShift === 0) continue
      
      const shiftedDate = format(addDays(parse(date, 'yyyy-MM-dd', new Date()), dayShift), 'yyyy-MM-dd')
      
      if (this.canPlaceAt(shiftedDate, originalTime, work.durationMinutes)) {
        this.occupyTimeSlot(shiftedDate, originalTime, work.durationMinutes, work.id, 'soft')
        return {
          placed: true,
          startTime: originalTime,
          endTime: format(
            addMinutes(parse(originalTime, 'HH:mm', new Date()), work.durationMinutes),
            'HH:mm'
          ),
          shifted: true,
          shiftAmount: { hours: 0, days: dayShift },
        }
      }
    }
    
    return { placed: false, shifted: false }
  }

  private generateRecurrenceInstances(work: RecurringWork): Array<{ date: string }> {
    const instances: Array<{ date: string }> = []
    const startDate = work.startDate ? parse(work.startDate, 'yyyy-MM-dd', new Date()) : this.startDate
    const endDate = work.endDate ? parse(work.endDate, 'yyyy-MM-dd', new Date()) : this.endDate
    
    let current = new Date(Math.max(startDate.getTime(), this.startDate.getTime()))
    const finalDate = new Date(Math.min(endDate.getTime(), this.endDate.getTime()))
    
    while (current <= finalDate) {
      const dateStr = format(current, 'yyyy-MM-dd')
      const dayOfWeek = getDay(current)
      
      // 除外日チェック
      if (work.exclusions?.includes(dateStr)) {
        current = addDays(current, 1)
        continue
      }
      
      // 祝日チェック
      if (this.excludeHolidays && this.holidays.has(dateStr)) {
        current = addDays(current, 1)
        continue
      }
      
      // パターンマッチング
      if (work.pattern.freq === 'DAILY') {
        instances.push({ date: dateStr })
      } else if (work.pattern.freq === 'WEEKLY' && work.pattern.byWeekday?.includes(dayOfWeek)) {
        instances.push({ date: dateStr })
      }
      
      current = addDays(current, 1)
    }
    
    return instances
  }

  private canPlaceAt(date: string, startTime: string, durationMinutes: number): boolean {
    const schedule = this.schedules.get(date)
    if (!schedule) return false
    
    const remainingMinutes = schedule.availableMinutes - schedule.occupiedMinutes
    return remainingMinutes >= durationMinutes
  }

  private findAvailableStartTime(date: string, durationMinutes: number): string | null {
    const schedule = this.schedules.get(date)
    if (!schedule) return null
    
    // 簡略化: 現在の占有時間の後に配置
    const occupiedMinutes = schedule.occupiedMinutes
    const startMinutes = 9 * 60 + occupiedMinutes // 9:00開始 + 占有時間
    const hours = Math.floor(startMinutes / 60)
    const minutes = startMinutes % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  private occupyTimeSlot(
    date: string,
    startTime: string,
    durationMinutes: number,
    workId: string,
    workType: 'flow' | 'hard' | 'soft'
  ) {
    const schedule = this.schedules.get(date)
    if (!schedule) return
    
    schedule.occupiedMinutes += durationMinutes
    
    // スロット情報を更新（簡略化版）
    schedule.slots.push({
      date,
      startTime,
      endTime: format(
        addMinutes(parse(startTime, 'HH:mm', new Date()), durationMinutes),
        'HH:mm'
      ),
      minutes: durationMinutes,
      type: 'occupied',
      workId,
      workType,
    })
  }

  private calculateStats(
    flowWorks: FlowWork[],
    recurringWorks: RecurringWork[],
    placements: SchedulingResult['placements']
  ): SchedulingResult['stats'] {
    const totalFlowHours = flowWorks.reduce((sum, work) => sum + work.estimatedMinutes / 60, 0)
    const totalRecurringHours = recurringWorks.reduce(
      (sum, work) => {
        const instances = this.generateRecurrenceInstances(work)
        return sum + (instances.length * work.durationMinutes) / 60
      },
      0
    )
    
    const totalAvailableHours = Array.from(this.schedules.values()).reduce(
      (sum, schedule) => sum + schedule.availableMinutes / 60,
      0
    )
    
    const utilizationRate = totalAvailableHours > 0
      ? ((totalFlowHours + totalRecurringHours) / totalAvailableHours) * 100
      : 0
    
    return {
      totalFlowHours,
      totalRecurringHours,
      utilizationRate,
      conflictCount: 0, // 簡略化版では衝突カウントは省略
    }
  }
}