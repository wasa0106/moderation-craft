/**
 * Calendar - Calendar component for date selection
 * Basic calendar implementation for date picking
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react'
import { format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface CalendarProps {
  mode: 'single'
  selected?: Date
  onSelect?: (date: Date) => void
  className?: string
  locale?: typeof ja
}

export function Calendar({ 
  selected, 
  onSelect, 
  className,
  locale = ja
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = eachDayOfInterval({ start: startDate, end: endDate })

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const handleDateSelect = (date: Date) => {
    if (onSelect) {
      onSelect(date)
    }
  }

  const weekDays = ['月', '火', '水', '木', '金', '土', '日']

  return (
    <div className={cn('p-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={goToPreviousMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <h2 className="font-semibold text-lg">
          {format(currentMonth, 'yyyy年MM月', { locale })}
        </h2>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={goToNextMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week days */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div 
            key={day}
            className="text-center text-sm font-medium text-gray-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected = selected && isSameDay(day, selected)
          const isToday = isSameDay(day, new Date())
          
          return (
            <Button
              key={day.toISOString()}
              variant={isSelected ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleDateSelect(day)}
              className={cn(
                'h-8 w-8 p-0 font-normal',
                !isCurrentMonth && 'text-gray-300',
                isToday && !isSelected && 'bg-blue-50 text-blue-600',
                isSelected && 'bg-blue-600 text-white'
              )}
            >
              {format(day, 'd')}
            </Button>
          )
        })}
      </div>
    </div>
  )
}