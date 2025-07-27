/**
 * Time conversion utility functions
 */

/**
 * Convert seconds to minutes (rounded down)
 */
export function secondsToMinutes(seconds: number): number {
  return Math.floor(seconds / 60)
}

/**
 * Convert minutes to seconds
 */
export function minutesToSeconds(minutes: number): number {
  return minutes * 60
}

/**
 * Format seconds to HH:MM:SS string
 */
export function formatSecondsToTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Format seconds to HH:MM string (without seconds)
 */
export function formatSecondsToHoursMinutes(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}`
}

/**
 * Format minutes to HH:MM string
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.floor(totalMinutes % 60)
  
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}`
}

/**
 * Calculate duration in seconds between two ISO date strings
 */
export function calculateDurationSeconds(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  return Math.floor((end - start) / 1000)
}