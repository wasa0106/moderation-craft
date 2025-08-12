/**
 * プロジェクトカラーユーティリティ
 * 
 * プロジェクトカラーの一元管理と調整機能を提供
 * 基準値: 彩度42%、明度55%
 */

/**
 * HSL文字列をパースして各値を取得
 */
export function parseHSL(hsl: string): { h: number; s: number; l: number } | null {
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!match) return null
  
  return {
    h: parseInt(match[1]),
    s: parseInt(match[2]),
    l: parseInt(match[3]),
  }
}

/**
 * HSL値から文字列を生成
 */
export function formatHSL(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`
}

/**
 * プロジェクトの背景色を取得（薄い色）
 * 彩度: 25%, 明度: 85%
 */
export function getProjectBackgroundColor(projectColor: string): string {
  const hsl = parseHSL(projectColor)
  if (!hsl) return 'hsl(0, 0%, 95%)' // デフォルトのグレー
  
  return formatHSL(hsl.h, 25, 85)
}

/**
 * プロジェクトのアクセントカラーを取得（中間色）
 * 彩度: 42%, 明度: 70%
 */
export function getProjectAccentColor(projectColor: string): string {
  const hsl = parseHSL(projectColor)
  if (!hsl) return 'hsl(0, 0%, 70%)'
  
  return formatHSL(hsl.h, 42, 70)
}

/**
 * プロジェクトのボーダーカラーを取得
 * 彩度: 30%, 明度: 60%
 */
export function getProjectBorderColor(projectColor: string): string {
  const hsl = parseHSL(projectColor)
  if (!hsl) return 'hsl(0, 0%, 60%)'
  
  return formatHSL(hsl.h, 30, 60)
}

/**
 * プロジェクトのテキストカラーを取得（濃い色）
 * 彩度: 42%, 明度: 40%
 */
export function getProjectTextColor(projectColor: string): string {
  const hsl = parseHSL(projectColor)
  if (!hsl) return 'hsl(0, 0%, 40%)'
  
  return formatHSL(hsl.h, 42, 40)
}

/**
 * プロジェクトのホバー時の背景色を取得
 * 彩度: 30%, 明度: 80%
 */
export function getProjectHoverColor(projectColor: string): string {
  const hsl = parseHSL(projectColor)
  if (!hsl) return 'hsl(0, 0%, 80%)'
  
  return formatHSL(hsl.h, 30, 80)
}

/**
 * プロジェクトの選択時の背景色を取得
 * 彩度: 35%, 明度: 75%
 */
export function getProjectSelectedColor(projectColor: string): string {
  const hsl = parseHSL(projectColor)
  if (!hsl) return 'hsl(0, 0%, 75%)'
  
  return formatHSL(hsl.h, 35, 75)
}

/**
 * プロジェクトの薄いオーバーレイ色を取得（透明度付き）
 * 彩度: 42%, 明度: 55%, 透明度: 0.1
 */
export function getProjectOverlayColor(projectColor: string): string {
  const hsl = parseHSL(projectColor)
  if (!hsl) return 'hsla(0, 0%, 55%, 0.1)'
  
  return `hsla(${hsl.h}, 42%, 55%, 0.1)`
}

/**
 * プロジェクトのバッジ色を取得
 * 彩度: 38%, 明度: 65%
 */
export function getProjectBadgeColor(projectColor: string): string {
  const hsl = parseHSL(projectColor)
  if (!hsl) return 'hsl(0, 0%, 65%)'
  
  return formatHSL(hsl.h, 38, 65)
}

/**
 * プロジェクトの進捗バー色を取得
 * 彩度: 45%, 明度: 50%
 */
export function getProjectProgressColor(projectColor: string): string {
  const hsl = parseHSL(projectColor)
  if (!hsl) return 'hsl(0, 0%, 50%)'
  
  return formatHSL(hsl.h, 45, 50)
}

/**
 * ダークモード用の調整（将来の拡張用）
 * 明度を反転させる
 */
export function getProjectColorForDarkMode(projectColor: string): string {
  const hsl = parseHSL(projectColor)
  if (!hsl) return projectColor
  
  // ダークモードでは明度を反転（55% → 45%）
  const adjustedLightness = 100 - hsl.l
  return formatHSL(hsl.h, hsl.s, adjustedLightness)
}

/**
 * プリセットカラーの定義（project-color-pickerから移行）
 */
export const PRESET_PROJECT_COLORS = [
  { name: 'Green', value: 'hsl(137, 42%, 55%)', hex: '#5DAB70' },
  { name: 'Red', value: 'hsl(0, 42%, 55%)', hex: '#C7595F' },
  { name: 'Blue', value: 'hsl(210, 42%, 55%)', hex: '#4A90C7' },
  { name: 'Purple', value: 'hsl(270, 42%, 55%)', hex: '#9570C7' },
  { name: 'Orange', value: 'hsl(30, 42%, 55%)', hex: '#C7844A' },
  { name: 'Yellow', value: 'hsl(60, 42%, 55%)', hex: '#C7C74A' },
  { name: 'Pink', value: 'hsl(330, 42%, 55%)', hex: '#C75995' },
  { name: 'Cyan', value: 'hsl(180, 42%, 55%)', hex: '#4AC7C7' },
  { name: 'Magenta', value: 'hsl(300, 42%, 55%)', hex: '#C74AC7' },
]

/**
 * デフォルトのプロジェクトカラー
 */
export const DEFAULT_PROJECT_COLOR = PRESET_PROJECT_COLORS[0].value