# パフォーマンス課題

## 未対応

### 1. 採用ページ（company-recruit.html）の読み込み速度改善
- **報告日**: 2026-02-03
- **状況**: 読み込みが遅い
- **対象ファイル**: `src/pages/company-recruit.js`
- **備考**: 原因調査が必要

---

## 対応済み

### 1. アナリティクスAPI（funnel）のGA4リクエスト最適化
- **対応日**: 2026-02-14
- **対象ファイル**: `functions/index.js`
- **変更内容**:
  - 4回のGA4 APIリクエスト → 1回にまとめる
  - `getEventCount`関数 → `getMultipleEventCounts`関数に置き換え
  - `inListFilter`を使用して複数イベントを1リクエストで取得
- **効果**: APIレスポンス時間の短縮（約4倍の高速化が期待）
