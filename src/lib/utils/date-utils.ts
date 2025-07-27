/**
 * 日付処理ユーティリティ
 * 日本時間（JST）で統一した日付処理を提供
 */

import { startOfWeek, differenceInWeeks } from 'date-fns'

export const dateUtils = {
  /**
   * YYYY-MM-DD形式の文字列を日本時間の日付として扱う
   * @param dateString YYYY-MM-DD形式の日付文字列
   * @returns 日本時間の0時0分0秒のDateオブジェクト
   */
  toJSTDate(dateString: string): Date {
    // YYYY-MM-DDを日本時間の0時0分として解釈
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  },

  /**
   * DateオブジェクトをYYYY-MM-DD形式に変換
   * @param date Dateオブジェクト
   * @returns YYYY-MM-DD形式の文字列
   */
  toDateString(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  /**
   * 日付文字列の形式が正しいかチェック
   * @param dateString チェックする文字列
   * @returns 有効な日付形式かどうか
   */
  isValidDateString(dateString: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false
    const date = this.toJSTDate(dateString)
    return !isNaN(date.getTime())
  },

  /**
   * プロジェクト開始日を基準とした週番号を取得
   * @param date 対象の日付
   * @param projectStartDate プロジェクト開始日
   * @returns 週番号（0から開始）
   */
  getWeekNumber(date: Date, projectStartDate: Date): number {
    const projectStartWeek = startOfWeek(projectStartDate, { weekStartsOn: 1 })
    const targetWeek = startOfWeek(date, { weekStartsOn: 1 })
    return Math.floor(differenceInWeeks(targetWeek, projectStartWeek))
  }
}