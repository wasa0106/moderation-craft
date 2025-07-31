# /ui-check - UIパターンチェック

現在のファイルまたは指定されたファイルがshadcn/ui v4のdashboard-01パターンに準拠しているかチェックします。

## チェック項目
1. レイアウト構造（`flex flex-1 flex-col gap-6 p-4 md:p-6`）
2. セマンティックカラーの使用
3. グリッドパターン（`grid gap-4`）
4. Card境界線（`border border-border`）
5. gray系色指定の有無

## 使用例
```
/ui-check src/app/projects/page.tsx
```