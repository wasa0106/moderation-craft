/**
 * 統合カラー管理システム
 * シンプルなグリーンベースのカラーシステム
 */

// 基本カラーパレット（HSL値）
export const colorPalette = {
  // グレースケール（ブルーグレー系）
  gray: {
    50: '216 20% 97%',   // #F8F9FA - カード背景
    100: '214 17% 95%',  // #F0F2F5 - ページ背景
    200: '213 13% 93%',  // #EBEDEF - ホバー状態
    300: '212 12% 85%',  // #D0D7DE - ボーダー
    400: '213 8% 70%',   // #A5ADB7 - 非活性
    500: '215 9% 46%',   // #656D76 - 補助テキスト
    600: '215 11% 35%',  // #4B545C - 
    700: '216 12% 24%',  // #32383F - 
    800: '217 10% 18%',  // #24292F - 
    900: '221 12% 14%',  // #1F2328 - メインテキスト
    950: '220 13% 9%',   // #161B22 - 最も暗い
  },
  // プライマリカラー（グリーン系）
  primary: {
    lightest: '144 65% 94%', // #DFF7E8 - 成功背景
    light: '144 57% 80%',    // #ABEBC6 - ホバー背景
    DEFAULT: '137 42% 55%',  // #2DA44E - メインアクション
    dark: '137 55% 36%',     // #1A7F37 - 押下状態
  },
  // エラーカラー（最小限の機能色）
  error: {
    light: '354 100% 96%',   // #FFEBE9 - エラー背景
    DEFAULT: '356 77% 47%',  // #D1242F - エラーテキスト
    dark: '356 77% 35%',     // #9E1C23 - エラー押下
  },
  // Surface階層（視覚的深度表現）
  surface: {
    // ライトモード用
    light: {
      0: '214 17% 94%',    // #EFF1F4 - ページ背景
      1: '216 20% 97%',    // #F8F9FA - カード
      2: '216 20% 99%',    // #FCFDFD - ホバー
      3: '0 0% 100%',      // #FFFFFF - モーダル
      4: '220 15% 96%',    // #F4F5F7 - ツールチップ
    },
    // ダークモード用
    dark: {
      0: '220 13% 9%',     // #161B22 - ページ背景
      1: '217 10% 13%',    // #1E2329 - カード
      2: '217 10% 15%',    // #232930 - ホバー
      3: '215 10% 17%',    // #282E37 - モーダル
      4: '213 8% 20%',     // #2F353E - ツールチップ
    },
  },
} as const

// セマンティックカラー定義（ライトモード）
export const lightColors = {
  // 背景と前景
  background: colorPalette.surface.light[0],
  foreground: colorPalette.gray[900],
  
  // カード
  card: colorPalette.surface.light[1],
  'card-foreground': colorPalette.gray[900],
  
  // ポップオーバー
  popover: colorPalette.surface.light[3],
  'popover-foreground': colorPalette.gray[900],
  
  // プライマリ
  primary: colorPalette.primary.DEFAULT,
  'primary-foreground': colorPalette.gray[50],
  'primary-dark': colorPalette.primary.dark,
  
  // セカンダリ（グレーで統一）
  secondary: colorPalette.gray[100],
  'secondary-foreground': colorPalette.gray[900],
  
  // ミューテッド
  muted: colorPalette.gray[100],
  'muted-foreground': colorPalette.gray[500],
  
  // アクセント（プライマリと統合）
  accent: colorPalette.primary.light,
  'accent-foreground': colorPalette.primary.dark,
  
  // 機能的なカラー
  destructive: colorPalette.error.DEFAULT,
  'destructive-foreground': colorPalette.gray[50],
  
  success: colorPalette.primary.DEFAULT,
  'success-foreground': colorPalette.gray[50],
  
  warning: colorPalette.gray[500],
  'warning-foreground': colorPalette.gray[900],
  
  info: colorPalette.primary.lightest,
  'info-foreground': colorPalette.primary.dark,
  
  // ボーダーと入力
  border: colorPalette.gray[300],
  input: colorPalette.gray[300],
  ring: colorPalette.primary.DEFAULT,
  
  // チャート（グリーンのバリエーション）
  'chart-1': colorPalette.primary.DEFAULT,
  'chart-2': colorPalette.primary.light,
  'chart-3': colorPalette.gray[500],
  'chart-4': colorPalette.primary.dark,
  'chart-5': colorPalette.gray[400],
  
  // サイドバー
  sidebar: colorPalette.surface.light[1],
  'sidebar-foreground': colorPalette.gray[900],
  'sidebar-primary': colorPalette.primary.DEFAULT,
  'sidebar-primary-foreground': colorPalette.gray[50],
  'sidebar-accent': colorPalette.primary.lightest,
  'sidebar-accent-foreground': colorPalette.primary.dark,
  'sidebar-border': colorPalette.gray[300],
  'sidebar-ring': colorPalette.primary.DEFAULT,
  
  // Surface階層
  'surface-0': colorPalette.surface.light[0],
  'surface-1': colorPalette.surface.light[1],
  'surface-2': colorPalette.surface.light[2],
  'surface-3': colorPalette.surface.light[3],
  'surface-4': colorPalette.surface.light[4],
} as const

// セマンティックカラー定義（ダークモード）
export const darkColors = {
  // 背景と前景
  background: colorPalette.surface.dark[0],
  foreground: colorPalette.gray[100],
  
  // カード
  card: colorPalette.surface.dark[1],
  'card-foreground': colorPalette.gray[100],
  
  // ポップオーバー
  popover: colorPalette.surface.dark[3],
  'popover-foreground': colorPalette.gray[100],
  
  // プライマリ
  primary: colorPalette.primary.light,
  'primary-foreground': colorPalette.gray[900],
  'primary-dark': colorPalette.primary.DEFAULT,
  
  // セカンダリ
  secondary: colorPalette.gray[800],
  'secondary-foreground': colorPalette.gray[100],
  
  // ミューテッド
  muted: colorPalette.gray[800],
  'muted-foreground': colorPalette.gray[400],
  
  // アクセント
  accent: colorPalette.primary.DEFAULT,
  'accent-foreground': colorPalette.gray[100],
  
  // 機能的なカラー
  destructive: colorPalette.error.light,
  'destructive-foreground': colorPalette.gray[900],
  
  success: colorPalette.primary.light,
  'success-foreground': colorPalette.gray[900],
  
  warning: colorPalette.gray[400],
  'warning-foreground': colorPalette.gray[100],
  
  info: colorPalette.primary.DEFAULT,
  'info-foreground': colorPalette.gray[100],
  
  // ボーダーと入力
  border: colorPalette.gray[700],
  input: colorPalette.gray[700],
  ring: colorPalette.primary.light,
  
  // チャート
  'chart-1': colorPalette.primary.light,
  'chart-2': colorPalette.primary.DEFAULT,
  'chart-3': colorPalette.gray[400],
  'chart-4': colorPalette.primary.lightest,
  'chart-5': colorPalette.gray[500],
  
  // サイドバー
  sidebar: colorPalette.surface.dark[1],
  'sidebar-foreground': colorPalette.gray[100],
  'sidebar-primary': colorPalette.primary.light,
  'sidebar-primary-foreground': colorPalette.gray[900],
  'sidebar-accent': colorPalette.primary.DEFAULT,
  'sidebar-accent-foreground': colorPalette.gray[100],
  'sidebar-border': colorPalette.gray[700],
  'sidebar-ring': colorPalette.primary.light,
  
  // Surface階層
  'surface-0': colorPalette.surface.dark[0],
  'surface-1': colorPalette.surface.dark[1],
  'surface-2': colorPalette.surface.dark[2],
  'surface-3': colorPalette.surface.dark[3],
  'surface-4': colorPalette.surface.dark[4],
} as const


// 型定義
export type SemanticColor = keyof typeof lightColors
export type ColorPaletteKey = keyof typeof colorPalette
export type GrayShade = keyof typeof colorPalette.gray

// カラーモード
export type ColorMode = 'light' | 'dark'

// CSS変数名の生成
export const getCSSVariableName = (name: SemanticColor): string => {
  return `--${name}`
}

// セマンティックカラーの取得
export const getSemanticColor = (name: SemanticColor, mode: ColorMode = 'light'): string => {
  return mode === 'light' ? lightColors[name] : darkColors[name]
}