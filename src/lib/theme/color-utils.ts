/**
 * カラー操作ヘルパー関数
 * シンプルなカラーシステム用に更新
 */

/**
 * 効率性に基づいてカラークラスを取得
 */
export const getEfficiencyColorClass = (efficiency: number): string => {
  if (efficiency >= 90) return 'text-primary'
  if (efficiency >= 70) return 'text-muted-foreground'
  return 'text-destructive'
}

/**
 * 完了率に基づいてカラークラスを取得
 */
export const getCompletionColorClass = (rate: number): string => {
  if (rate >= 80) return 'text-primary'
  if (rate >= 60) return 'text-muted-foreground'
  return 'text-destructive'
}

/**
 * HEX色をRGBに変換するヘルパー関数
 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * テキストに適したコントラスト色を取得（白または黒）
 */
export const getContrastTextColor = (backgroundColor: string): string => {
  const rgb = hexToRgb(backgroundColor)
  if (!rgb) return '#1F2328' // デフォルトはダークテキスト

  // 明度を計算
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255

  // 明度が0.5以上ならダークテキスト、未満ならライトテキスト
  return luminance > 0.5 ? '#1F2328' : '#F0F2F5'
}
