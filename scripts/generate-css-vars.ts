#!/usr/bin/env tsx
/**
 * CSS変数自動生成スクリプト
 * src/lib/theme/colors.tsからCSS変数を生成し、globals.cssに反映
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { lightColors, darkColors } from '../src/lib/theme/colors'

const generateCSSVariables = () => {
  // ライトモードのCSS変数生成
  const lightVars = Object.entries(lightColors)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join('\n')

  // ダークモードのCSS変数生成
  const darkVars = Object.entries(darkColors)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join('\n')

  // globals.cssのパス
  const globalsPath = join(process.cwd(), 'src/app/globals.css')
  
  // 現在のglobals.cssを読み込み
  let content = readFileSync(globalsPath, 'utf-8')
  
  // :root内のCSS変数を更新
  content = content.replace(
    /:root\s*{[^}]*}/,
    `:root {
  --radius: 0.5rem;
${lightVars}
}`
  )
  
  // .dark内のCSS変数を更新
  content = content.replace(
    /\.dark\s*{[^}]*}/,
    `.dark {
${darkVars}
}`
  )
  
  // ファイルに書き込み
  writeFileSync(globalsPath, content)
  
  console.log('✅ CSS variables generated successfully!')
  console.log(`📄 Updated: ${globalsPath}`)
}

// スクリプト実行
generateCSSVariables()