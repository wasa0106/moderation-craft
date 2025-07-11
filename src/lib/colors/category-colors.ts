/**
 * カテゴリ色管理ユーティリティ
 * Material Themeに基づいたカラーパレットと自動割り当てロジック
 */

import { CategoryColor } from '@/types'

// Material Themeに基づくデフォルトカラーパレット
export const DEFAULT_CATEGORY_COLORS = [
  '#5E621B', // material-primary - 企画・設計
  '#3C6659', // material-tertiary - デザイン  
  '#5F6044', // material-secondary - 実装
  '#BA1A1A', // material-error - テスト（赤系）
  '#4A90E2', // 青系 - デプロイ
  '#F5A623', // オレンジ系
  '#7ED321', // 明るい緑
  '#9013FE', // 紫系
  '#FF6B6B', // 明るい赤
  '#4ECDC4', // ターコイズ
  '#45B7D1', // 水色
  '#96CEB4', // ミントグリーン
  '#FECA57', // 黄色
  '#FF9FF3', // ピンク
  '#54A0FF', // 明るい青
  '#5F27CD', // 深い紫
] as const

// デフォルトカテゴリと色のマッピング
export const DEFAULT_CATEGORY_MAPPING = {
  '企画・設計': DEFAULT_CATEGORY_COLORS[0],
  'デザイン': DEFAULT_CATEGORY_COLORS[1],
  '実装': DEFAULT_CATEGORY_COLORS[2],
  'テスト': DEFAULT_CATEGORY_COLORS[3],
  'デプロイ': DEFAULT_CATEGORY_COLORS[4],
} as const

/**
 * 新しいカテゴリに自動で色を割り当て
 */
export const getNextColor = (existingCategories: CategoryColor[]): string => {
  const usedColors = existingCategories.map(c => c.color_code)
  const availableColors = DEFAULT_CATEGORY_COLORS.filter(
    color => !usedColors.includes(color)
  )
  
  // 使用可能な色がある場合は最初の色を返す
  if (availableColors.length > 0) {
    return availableColors[0]
  }
  
  // すべて使用済みの場合は、ランダムに少し色相をずらす
  const baseColor = DEFAULT_CATEGORY_COLORS[existingCategories.length % DEFAULT_CATEGORY_COLORS.length]
  return adjustHue(baseColor, 15) // 15度色相をずらす
}

/**
 * カテゴリ名に基づいてデフォルト色を取得
 */
export const getDefaultColorForCategory = (categoryName: string): string => {
  // デフォルトマッピングをチェック
  if (categoryName in DEFAULT_CATEGORY_MAPPING) {
    return DEFAULT_CATEGORY_MAPPING[categoryName as keyof typeof DEFAULT_CATEGORY_MAPPING]
  }
  
  // デフォルトマッピングにない場合は、パレットから順番に選択
  const index = categoryName.length % DEFAULT_CATEGORY_COLORS.length
  return DEFAULT_CATEGORY_COLORS[index]
}

/**
 * 色相を調整して新しい色を生成
 */
export const adjustHue = (hexColor: string, adjustment: number): string => {
  // hex to hsl 変換
  const rgb = hexToRgb(hexColor)
  if (!rgb) return hexColor
  
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  
  // 色相を調整（0-360度の範囲でラップ）
  hsl.h = (hsl.h + adjustment) % 360
  if (hsl.h < 0) hsl.h += 360
  
  // hsl to rgb 変換
  const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l)
  
  // rgb to hex 変換
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b)
}

/**
 * カテゴリ色から背景色を生成（明度を上げて薄くする）
 */
export const getCategoryBackgroundColor = (categoryColor: string): string => {
  const rgb = hexToRgb(categoryColor)
  if (!rgb) return 'rgba(0, 0, 0, 0.1)'
  
  // 背景用に明度を調整（元の色の20%の濃さ）
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`
}

/**
 * カテゴリ色から境界線色を生成
 */
export const getCategoryBorderColor = (categoryColor: string): string => {
  const rgb = hexToRgb(categoryColor)
  if (!rgb) return 'rgba(0, 0, 0, 0.3)'
  
  // 境界線用に明度を調整（元の色の60%の濃さ）
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`
}

/**
 * テキストに適したコントラスト色を取得（白または黒）
 */
export const getContrastTextColor = (backgroundColor: string): string => {
  const rgb = hexToRgb(backgroundColor)
  if (!rgb) return '#000000'
  
  // 明度を計算
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  
  // 明度が0.5以上なら黒、未満なら白
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

// ヘルパー関数

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h: number
  let s: number
  const l = (max + min) / 2
  
  if (max === min) {
    h = s = 0 // 無彩色
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
      default:
        h = 0
    }
    h /= 6
  }
  
  return { h: h * 360, s: s * 100, l: l * 100 }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360
  s /= 100
  l /= 100
  
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  
  let r: number
  let g: number
  let b: number
  
  if (s === 0) {
    r = g = b = l // 無彩色
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}