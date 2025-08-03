/**
 * CSS変数生成ユーティリティ
 * TypeScriptのカラー定義からCSS変数を自動生成
 */

import { lightColors, darkColors, getCSSVariableName, type SemanticColor } from './colors'

/**
 * CSS変数の文字列を生成
 */
export const generateCSSVariables = (): string => {
  const rootVariables: string[] = []
  const darkVariables: string[] = []

  // radius変数
  rootVariables.push('  --radius: 0.5rem;')

  // ライトモードのセマンティックカラー
  Object.entries(lightColors).forEach(([key, value]) => {
    const varName = getCSSVariableName(key as SemanticColor)
    rootVariables.push(`  ${varName}: ${value};`)
  })

  // ダークモードのセマンティックカラー
  Object.entries(darkColors).forEach(([key, value]) => {
    const varName = getCSSVariableName(key as SemanticColor)
    darkVariables.push(`  ${varName}: ${value};`)
  })

  // CSS文字列の生成
  return `/* Auto-generated CSS variables from TypeScript color definitions */

:root {
${rootVariables.join('\n')}
}

.dark {
${darkVariables.join('\n')}
}`
}

/**
 * Tailwind CSS用のカラー設定を生成
 */
export const generateTailwindColors = () => {
  const colors: Record<string, string> = {}

  // セマンティックカラーをTailwind設定に変換
  Object.keys(lightColors).forEach(key => {
    colors[key] = `hsl(var(--${key}))`
  })

  return colors
}

/**
 * CSS変数からHSL値を取得するヘルパー
 */
export const getHSLFromVar = (varName: string): string => {
  return `hsl(var(${varName}))`
}

/**
 * CSS変数から透明度付きHSL値を取得するヘルパー
 */
export const getHSLWithAlpha = (varName: string, alpha: number): string => {
  return `hsl(var(${varName}) / ${alpha})`
}
