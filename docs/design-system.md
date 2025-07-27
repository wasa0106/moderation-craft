# ModerationCraft デザインシステム
## Material Design 3 ベース

## 1. デザイン原則

### 1.1 Material Design の基本原則
- **Material as metaphor**: 物理的な素材の特性を模倣した視覚的な階層
- **Bold, graphic, intentional**: 大胆で意図的なデザイン
- **Motion provides meaning**: 意味のあるモーション
- **Flexible foundation**: 柔軟で拡張可能な基盤

### 1.2 Material You (M3) の特徴
- **Dynamic color**: ダイナミックなカラーシステム
- **Accessibility**: アクセシビリティを重視
- **Personalization**: パーソナライゼーション対応
- **Adaptive design**: 適応的なデザイン

## 2. カラーシステム (Material Theme)

### 2.1 カラーロール

```css
:root {
  /* Primary - 主要なアクション、キーコンポーネント */
  --md-sys-color-primary: #5E621B;
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-primary-container: #E3E892;
  --md-sys-color-on-primary-container: #464A02;

  /* Secondary - 目立たないアクション、補助的なコンポーネント */
  --md-sys-color-secondary: #5F6044;
  --md-sys-color-on-secondary: #FFFFFF;
  --md-sys-color-secondary-container: #E4E5C0;
  --md-sys-color-on-secondary-container: #47492E;

  /* Tertiary - コントラストのあるアクセント */
  --md-sys-color-tertiary: #3C6659;
  --md-sys-color-on-tertiary: #FFFFFF;
  --md-sys-color-tertiary-container: #BEECDB;
  --md-sys-color-on-tertiary-container: #244E42;

  /* Error - エラー状態 */
  --md-sys-color-error: #BA1A1A;
  --md-sys-color-on-error: #FFFFFF;
  --md-sys-color-error-container: #FFDAD6;
  --md-sys-color-on-error-container: #93000A;

  /* Background */
  --md-sys-color-background: #FCFAEC;
  --md-sys-color-on-background: #1C1C14;

  /* Surface - カード、シート、ダイアログの背景 */
  --md-sys-color-surface: #FCFAEC;
  --md-sys-color-on-surface: #1C1C14;
  --md-sys-color-surface-variant: #E5E3D2;
  --md-sys-color-on-surface-variant: #47473B;

  /* Surface levels (elevation) */
  --md-sys-color-surface-dim: #DDD9CC;
  --md-sys-color-surface-bright: #FCFAEC;
  --md-sys-color-surface-container-lowest: #FFFFFF;
  --md-sys-color-surface-container-low: #F7F5E7;
  --md-sys-color-surface-container: #F1EFDF;
  --md-sys-color-surface-container-high: #EBE9DA;
  --md-sys-color-surface-container-highest: #E5E3D5;

  /* Outline */
  --md-sys-color-outline: #787869;
  --md-sys-color-outline-variant: #C9C7B6;

  /* Additional colors */
  --md-sys-color-shadow: #000000;
  --md-sys-color-scrim: #000000;
  --md-sys-color-inverse-surface: #31312A;
  --md-sys-color-inverse-on-surface: #F4F2E5;
  --md-sys-color-inverse-primary: #C7CC77;
}
```

### 2.2 状態レイヤー (State Layers)

```css
:root {
  /* Opacity values for state layers */
  --md-sys-state-hover-opacity: 0.08;
  --md-sys-state-focus-opacity: 0.12;
  --md-sys-state-pressed-opacity: 0.12;
  --md-sys-state-dragged-opacity: 0.16;
  --md-sys-state-disabled-opacity: 0.38;

  /* State layer colors */
  --md-sys-state-hover-color: var(--md-sys-color-on-surface);
  --md-sys-state-focus-color: var(--md-sys-color-on-surface);
  --md-sys-state-pressed-color: var(--md-sys-color-on-surface);
}
```

## 3. タイポグラフィ (Material Design Type Scale)

### 3.1 タイプスケール

```css
:root {
  /* Display - 最大の見出し */
  --md-sys-typescale-display-large-size: 57px;
  --md-sys-typescale-display-large-line-height: 64px;
  --md-sys-typescale-display-large-weight: 400;
  
  --md-sys-typescale-display-medium-size: 45px;
  --md-sys-typescale-display-medium-line-height: 52px;
  --md-sys-typescale-display-medium-weight: 400;
  
  --md-sys-typescale-display-small-size: 36px;
  --md-sys-typescale-display-small-line-height: 44px;
  --md-sys-typescale-display-small-weight: 400;

  /* Headline - 見出し */
  --md-sys-typescale-headline-large-size: 32px;
  --md-sys-typescale-headline-large-line-height: 40px;
  --md-sys-typescale-headline-large-weight: 400;
  
  --md-sys-typescale-headline-medium-size: 28px;
  --md-sys-typescale-headline-medium-line-height: 36px;
  --md-sys-typescale-headline-medium-weight: 400;
  
  --md-sys-typescale-headline-small-size: 24px;
  --md-sys-typescale-headline-small-line-height: 32px;
  --md-sys-typescale-headline-small-weight: 400;

  /* Title - タイトル */
  --md-sys-typescale-title-large-size: 22px;
  --md-sys-typescale-title-large-line-height: 28px;
  --md-sys-typescale-title-large-weight: 400;
  
  --md-sys-typescale-title-medium-size: 16px;
  --md-sys-typescale-title-medium-line-height: 24px;
  --md-sys-typescale-title-medium-weight: 500;
  
  --md-sys-typescale-title-small-size: 14px;
  --md-sys-typescale-title-small-line-height: 20px;
  --md-sys-typescale-title-small-weight: 500;

  /* Body - 本文 */
  --md-sys-typescale-body-large-size: 16px;
  --md-sys-typescale-body-large-line-height: 24px;
  --md-sys-typescale-body-large-weight: 400;
  
  --md-sys-typescale-body-medium-size: 14px;
  --md-sys-typescale-body-medium-line-height: 20px;
  --md-sys-typescale-body-medium-weight: 400;
  
  --md-sys-typescale-body-small-size: 12px;
  --md-sys-typescale-body-small-line-height: 16px;
  --md-sys-typescale-body-small-weight: 400;

  /* Label - ラベル */
  --md-sys-typescale-label-large-size: 14px;
  --md-sys-typescale-label-large-line-height: 20px;
  --md-sys-typescale-label-large-weight: 500;
  
  --md-sys-typescale-label-medium-size: 12px;
  --md-sys-typescale-label-medium-line-height: 16px;
  --md-sys-typescale-label-medium-weight: 500;
  
  --md-sys-typescale-label-small-size: 11px;
  --md-sys-typescale-label-small-line-height: 16px;
  --md-sys-typescale-label-small-weight: 500;
}
```

### 3.2 フォントファミリー

```css
:root {
  --md-sys-typescale-font-family-brand: "Roboto", "Noto Sans JP", sans-serif;
  --md-sys-typescale-font-family-plain: system-ui, -apple-system, sans-serif;
  --md-sys-typescale-font-family-mono: "Roboto Mono", monospace;
}
```

## 4. エレベーション (Material Design Elevation)

### 4.1 エレベーションレベル

```css
:root {
  /* Level 0 - フラット */
  --md-sys-elevation-level0: none;
  
  /* Level 1 - 低いエレベーション */
  --md-sys-elevation-level1: 
    0px 1px 2px rgba(0, 0, 0, 0.3),
    0px 1px 3px 1px rgba(0, 0, 0, 0.15);
  
  /* Level 2 */
  --md-sys-elevation-level2: 
    0px 1px 2px rgba(0, 0, 0, 0.3),
    0px 2px 6px 2px rgba(0, 0, 0, 0.15);
  
  /* Level 3 - 中程度のエレベーション */
  --md-sys-elevation-level3: 
    0px 4px 8px 3px rgba(0, 0, 0, 0.15),
    0px 1px 3px rgba(0, 0, 0, 0.3);
  
  /* Level 4 */
  --md-sys-elevation-level4: 
    0px 6px 10px 4px rgba(0, 0, 0, 0.15),
    0px 2px 3px rgba(0, 0, 0, 0.3);
  
  /* Level 5 - 高いエレベーション */
  --md-sys-elevation-level5: 
    0px 8px 12px 6px rgba(0, 0, 0, 0.15),
    0px 4px 4px rgba(0, 0, 0, 0.3);
}
```

### 4.2 サーフェスとエレベーションの組み合わせ

| Surface Container | Elevation Level | 使用場面 |
|-------------------|-----------------|----------|
| surface-container-lowest | level0 | ベース背景 |
| surface-container-low | level1 | カード |
| surface-container | level2 | アプリバー |
| surface-container-high | level3 | ダイアログ、FAB |
| surface-container-highest | level4-5 | ドロップダウン、ポップアップ |

## 5. シェイプ (Material Design Shape)

### 5.1 コーナー半径

```css
:root {
  /* Shape scale */
  --md-sys-shape-corner-none: 0px;
  --md-sys-shape-corner-extra-small: 4px;
  --md-sys-shape-corner-small: 8px;
  --md-sys-shape-corner-medium: 12px;
  --md-sys-shape-corner-large: 16px;
  --md-sys-shape-corner-extra-large: 28px;
  --md-sys-shape-corner-full: 9999px;
}
```

### 5.2 コンポーネント別シェイプ

| コンポーネント | コーナー半径 |
|---------------|-------------|
| Button | corner-full (高さ40px) / corner-medium |
| Card | corner-medium |
| Dialog | corner-extra-large |
| TextField | corner-extra-small |
| Chip | corner-small |
| FAB | corner-large |

## 6. モーション (Material Design Motion)

### 6.1 イージング

```css
:root {
  /* Emphasized easing - 強調されたアニメーション */
  --md-sys-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --md-sys-motion-easing-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
  --md-sys-motion-easing-emphasized-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
  
  /* Standard easing - 標準的なアニメーション */
  --md-sys-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --md-sys-motion-easing-standard-decelerate: cubic-bezier(0, 0, 0, 1);
  --md-sys-motion-easing-standard-accelerate: cubic-bezier(0.3, 0, 1, 1);
  
  /* Linear */
  --md-sys-motion-easing-linear: cubic-bezier(0, 0, 1, 1);
}
```

### 6.2 デュレーション

```css
:root {
  /* Duration scale */
  --md-sys-motion-duration-short1: 50ms;
  --md-sys-motion-duration-short2: 100ms;
  --md-sys-motion-duration-short3: 150ms;
  --md-sys-motion-duration-short4: 200ms;
  
  --md-sys-motion-duration-medium1: 250ms;
  --md-sys-motion-duration-medium2: 300ms;
  --md-sys-motion-duration-medium3: 350ms;
  --md-sys-motion-duration-medium4: 400ms;
  
  --md-sys-motion-duration-long1: 450ms;
  --md-sys-motion-duration-long2: 500ms;
  --md-sys-motion-duration-long3: 550ms;
  --md-sys-motion-duration-long4: 600ms;
}
```

## 7. スペーシング (Material Design Layout Grid)

### 7.1 スペーシングスケール

```css
:root {
  /* 4dp grid system */
  --md-sys-spacing-base: 4px;
  
  /* Spacing scale */
  --md-sys-spacing-0: 0px;
  --md-sys-spacing-1: 4px;   /* 0.25rem */
  --md-sys-spacing-2: 8px;   /* 0.5rem */
  --md-sys-spacing-3: 12px;  /* 0.75rem */
  --md-sys-spacing-4: 16px;  /* 1rem */
  --md-sys-spacing-5: 20px;  /* 1.25rem */
  --md-sys-spacing-6: 24px;  /* 1.5rem */
  --md-sys-spacing-7: 28px;  /* 1.75rem */
  --md-sys-spacing-8: 32px;  /* 2rem */
  --md-sys-spacing-10: 40px; /* 2.5rem */
  --md-sys-spacing-12: 48px; /* 3rem */
  --md-sys-spacing-16: 64px; /* 4rem */
  --md-sys-spacing-20: 80px; /* 5rem */
}
```

### 7.2 レイアウトガイド

| 用途 | スペーシング |
|------|-------------|
| コンポーネント内パディング | 16px |
| リスト項目間 | 8px |
| セクション間 | 24-32px |
| ページマージン（モバイル） | 16px |
| ページマージン（デスクトップ） | 24px |

## 8. コンポーネントスペック

### 8.1 Button (Material Design 3)

#### Elevated Button
```css
.md-elevated-button {
  position: relative;
  height: 40px;
  padding: 0 24px;
  background: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-primary);
  border: none;
  border-radius: var(--md-sys-shape-corner-full);
  font-size: var(--md-sys-typescale-label-large-size);
  font-weight: var(--md-sys-typescale-label-large-weight);
  box-shadow: var(--md-sys-elevation-level1);
  transition: all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.md-elevated-button:hover {
  box-shadow: var(--md-sys-elevation-level2);
}

.md-elevated-button:hover::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--md-sys-color-primary);
  opacity: var(--md-sys-state-hover-opacity);
  border-radius: inherit;
}
```

#### Filled Button
```css
.md-filled-button {
  height: 40px;
  padding: 0 24px;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
  border-radius: var(--md-sys-shape-corner-full);
  font-size: var(--md-sys-typescale-label-large-size);
  font-weight: var(--md-sys-typescale-label-large-weight);
}
```

#### Tonal Button
```css
.md-tonal-button {
  height: 40px;
  padding: 0 24px;
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  border: none;
  border-radius: var(--md-sys-shape-corner-full);
}
```

#### Outlined Button
```css
.md-outlined-button {
  height: 40px;
  padding: 0 24px;
  background: transparent;
  color: var(--md-sys-color-primary);
  border: 1px solid var(--md-sys-color-outline);
  border-radius: var(--md-sys-shape-corner-full);
}
```

#### Text Button
```css
.md-text-button {
  height: 40px;
  padding: 0 12px;
  background: transparent;
  color: var(--md-sys-color-primary);
  border: none;
}
```

### 8.2 Card (Material Design 3)

```css
.md-card {
  background: var(--md-sys-color-surface-container-low);
  border-radius: var(--md-sys-shape-corner-medium);
  overflow: hidden;
}

/* Elevated Card */
.md-card-elevated {
  box-shadow: var(--md-sys-elevation-level1);
}

/* Filled Card */
.md-card-filled {
  background: var(--md-sys-color-surface-variant);
  box-shadow: var(--md-sys-elevation-level0);
}

/* Outlined Card */
.md-card-outlined {
  background: var(--md-sys-color-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
  box-shadow: var(--md-sys-elevation-level0);
}
```

### 8.3 TextField (Material Design 3)

```css
.md-text-field {
  position: relative;
  min-height: 56px;
}

.md-text-field-input {
  width: 100%;
  height: 56px;
  padding: 16px;
  background: var(--md-sys-color-surface-variant);
  border: 1px solid var(--md-sys-color-outline);
  border-radius: var(--md-sys-shape-corner-extra-small);
  font-size: var(--md-sys-typescale-body-large-size);
  color: var(--md-sys-color-on-surface);
  transition: all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.md-text-field-input:hover {
  border-color: var(--md-sys-color-on-surface);
}

.md-text-field-input:focus {
  outline: none;
  border-width: 2px;
  border-color: var(--md-sys-color-primary);
}

.md-text-field-label {
  position: absolute;
  left: 16px;
  top: 16px;
  font-size: var(--md-sys-typescale-body-large-size);
  color: var(--md-sys-color-on-surface-variant);
  background: var(--md-sys-color-surface-variant);
  padding: 0 4px;
  transition: all var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard);
}

.md-text-field-input:focus + .md-text-field-label,
.md-text-field-input:not(:placeholder-shown) + .md-text-field-label {
  top: -8px;
  font-size: var(--md-sys-typescale-body-small-size);
  color: var(--md-sys-color-primary);
}
```

### 8.4 Chip (Material Design 3)

```css
.md-chip {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 16px;
  background: var(--md-sys-color-surface-variant);
  color: var(--md-sys-color-on-surface-variant);
  border-radius: var(--md-sys-shape-corner-small);
  font-size: var(--md-sys-typescale-label-large-size);
  font-weight: var(--md-sys-typescale-label-large-weight);
}

/* Assist Chip */
.md-chip-assist {
  border: 1px solid var(--md-sys-color-outline);
  background: transparent;
}

/* Filter Chip */
.md-chip-filter {
  background: transparent;
  border: 1px solid var(--md-sys-color-outline);
}

.md-chip-filter.selected {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  border-color: transparent;
}

/* Input Chip */
.md-chip-input {
  position: relative;
  padding-right: 12px;
}

.md-chip-input::after {
  content: "×";
  margin-left: 8px;
  font-size: 18px;
  cursor: pointer;
}

/* Suggestion Chip */
.md-chip-suggestion {
  background: transparent;
  border: 1px solid var(--md-sys-color-outline);
}
```

### 8.5 FAB (Floating Action Button)

```css
/* Regular FAB */
.md-fab {
  width: 56px;
  height: 56px;
  border-radius: var(--md-sys-shape-corner-large);
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  box-shadow: var(--md-sys-elevation-level3);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  transition: all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

.md-fab:hover {
  box-shadow: var(--md-sys-elevation-level4);
}

/* Small FAB */
.md-fab-small {
  width: 40px;
  height: 40px;
  border-radius: var(--md-sys-shape-corner-medium);
}

/* Large FAB */
.md-fab-large {
  width: 96px;
  height: 96px;
  border-radius: var(--md-sys-shape-corner-extra-large);
}

/* Extended FAB */
.md-fab-extended {
  width: auto;
  padding: 0 20px;
  gap: 12px;
}
```

## 9. 適応レイアウト (Adaptive Layout)

### 9.1 ブレークポイント

```css
:root {
  /* Material Design 3 Window Size Classes */
  --md-sys-breakpoint-compact: 600px;   /* Phone */
  --md-sys-breakpoint-medium: 840px;    /* Tablet */
  --md-sys-breakpoint-expanded: 1200px; /* Desktop */
  --md-sys-breakpoint-large: 1600px;    /* Large Desktop */
}
```

### 9.2 レイアウトグリッド

| Window Class | Columns | Margin | Gutter |
|--------------|---------|---------|---------|
| Compact (0-599dp) | 4 | 16dp | 16dp |
| Medium (600-839dp) | 12 | 32dp | 24dp |
| Expanded (840-1239dp) | 12 | 32dp | 24dp |
| Large (1240+dp) | 12 | 32dp | 24dp |

### 9.3 適応的なコンポーネント

```css
/* Compact */
@media (max-width: 599px) {
  .md-container {
    padding: 0 16px;
  }
  
  .md-card {
    margin: 8px 0;
  }
}

/* Medium and up */
@media (min-width: 600px) {
  .md-container {
    padding: 0 32px;
  }
  
  .md-card {
    margin: 16px 0;
  }
}

/* Expanded and up */
@media (min-width: 840px) {
  .md-container {
    max-width: 840px;
    margin: 0 auto;
  }
}
```

## 10. アクセシビリティ

### 10.1 コントラスト要件

| テキストタイプ | 最小コントラスト比 |
|--------------|------------------|
| 通常のテキスト | 4.5:1 |
| 大きいテキスト（18pt以上） | 3:1 |
| アクティブなUI要素 | 3:1 |

### 10.2 タッチターゲット

```css
:root {
  --md-sys-touch-target-min-size: 48px;
}

/* タッチターゲットの確保 */
.touch-target {
  position: relative;
  min-width: var(--md-sys-touch-target-min-size);
  min-height: var(--md-sys-touch-target-min-size);
}

/* 視覚的サイズが小さい場合のタッチエリア拡張 */
.touch-target::after {
  content: "";
  position: absolute;
  inset: 50%;
  transform: translate(-50%, -50%);
  min-width: var(--md-sys-touch-target-min-size);
  min-height: var(--md-sys-touch-target-min-size);
}
```

### 10.3 フォーカス表示

```css
/* Focus visible */
.focusable:focus-visible {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .focusable:focus-visible {
    outline-width: 3px;
  }
}
```

## 11. ダークテーマ対応

### 11.1 ダークテーマカラー

```css
@media (prefers-color-scheme: dark) {
  :root {
    /* Dark theme colors */
    --md-sys-color-primary: #C7CC77;
    --md-sys-color-on-primary: #30340F;
    --md-sys-color-primary-container: #464A02;
    --md-sys-color-on-primary-container: #E3E892;
    
    --md-sys-color-secondary: #C7C8A4;
    --md-sys-color-on-secondary: #313218;
    --md-sys-color-secondary-container: #47492E;
    --md-sys-color-on-secondary-container: #E4E5C0;
    
    --md-sys-color-tertiary: #A2D0BF;
    --md-sys-color-on-tertiary: #0A3829;
    --md-sys-color-tertiary-container: #244E42;
    --md-sys-color-on-tertiary-container: #BEECDB;
    
    --md-sys-color-error: #FFB4AB;
    --md-sys-color-on-error: #690005;
    --md-sys-color-error-container: #93000A;
    --md-sys-color-on-error-container: #FFDAD6;
    
    --md-sys-color-background: #14140C;
    --md-sys-color-on-background: #E6E3D5;
    --md-sys-color-surface: #14140C;
    --md-sys-color-on-surface: #E6E3D5;
    --md-sys-color-surface-variant: #47473B;
    --md-sys-color-on-surface-variant: #C9C7B6;
    
    --md-sys-color-outline: #939284;
    --md-sys-color-outline-variant: #47473B;
  }
}
```

## 12. 実装ガイドライン

### 12.1 命名規則

- Material Designコンポーネント: `.md-[component]-[variant]`
- カスタムコンポーネント: `.app-[component]-[variant]`
- 状態クラス: `.is-[state]`, `.has-[property]`

### 12.2 CSS変数の使用

```css
/* 推奨 */
.component {
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  padding: var(--md-sys-spacing-4);
  border-radius: var(--md-sys-shape-corner-medium);
}

/* 非推奨 - ハードコードされた値 */
.component {
  background: #FCFAEC;
  color: #1C1C14;
  padding: 16px;
  border-radius: 12px;
}
```

### 12.3 コンポーネント構造

```html
<!-- Material Design 3 Button -->
<button class="md-filled-button">
  <span class="md-button-state-layer"></span>
  <span class="md-button-content">
    <span class="md-button-icon">icon</span>
    <span class="md-button-label">Label</span>
  </span>
</button>

<!-- Material Design 3 Card -->
<div class="md-card md-card-elevated">
  <div class="md-card-media">
    <img src="..." alt="...">
  </div>
  <div class="md-card-content">
    <h3 class="md-card-headline">Headline</h3>
    <p class="md-card-supporting-text">Supporting text</p>
  </div>
  <div class="md-card-actions">
    <button class="md-text-button">Action</button>
  </div>
</div>
```

## 13. パフォーマンス最適化

### 13.1 CSS変数の効率的な使用

```css
/* テーマ切り替えの最適化 */
[data-theme="light"] {
  /* light theme variables */
}

[data-theme="dark"] {
  /* dark theme variables */
}
```

### 13.2 アニメーションの最適化

```css
/* GPUアクセラレーションを活用 */
.animated-element {
  will-change: transform, opacity;
  transform: translateZ(0); /* Layer creation */
}

/* アニメーション終了後にwill-changeを削除 */
.animation-done {
  will-change: auto;
}
```

## 14. まとめ

このデザインシステムは、Material Design 3の原則に基づき、ModerationCraftのブランドカラーを組み込んだものです。実装時は以下を心がけてください：

1. **一貫性**: すべてのコンポーネントでデザイントークンを使用
2. **アクセシビリティ**: WCAG 2.1 AA基準の遵守
3. **パフォーマンス**: 必要最小限のスタイルとアニメーション
4. **保守性**: CSS変数による容易なテーマ切り替え
5. **拡張性**: 新しいコンポーネントも同じ原則に従う