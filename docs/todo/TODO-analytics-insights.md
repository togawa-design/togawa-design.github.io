# アナリティクス改善提案機能 - 実装計画

## 概要

LP・採用ページのアナリティクスデータから、自動で改善提案を生成する機能。

---

## 実装フェーズ

### Phase 1: ルールベース分析（優先度: 高）

閾値に基づいた自動判定で改善提案を表示。

#### 判定ルール

| 指標 | 閾値 | 改善提案 |
|------|------|----------|
| CVR | < 1% | CTAボタンの配置・文言の見直しを推奨 |
| CVR | < 0.5% | ファーストビューにCTAを追加することを強く推奨 |
| 平均滞在時間 | < 30秒 | コンテンツの魅力度向上が必要 |
| 平均滞在時間 | < 10秒 | ページ読み込み速度・ファーストビューの問題を確認 |
| スクロール深度25%未達成率 | > 70% | ファーストビューの改善が必要 |
| モバイルCVR / デスクトップCVR | < 0.5 | モバイル表示の最適化が必要 |
| 特定流入元のCVR | 全体平均の2倍以上 | その流入元からの集客を強化 |

#### 実装箇所

- `src/features/admin/page-analytics.js` に `generateInsights(data)` 関数を追加
- `admin.html` に改善提案表示エリアを追加

#### UI案

```html
<!-- 改善提案セクション -->
<div class="insights-section">
  <h4>改善提案</h4>
  <div class="insight-card warning">
    <span class="insight-icon">⚠️</span>
    <div class="insight-content">
      <p class="insight-title">CVRが低下しています</p>
      <p class="insight-desc">現在のCVRは0.8%です。CTAボタンの配置や文言を見直すことで改善が期待できます。</p>
    </div>
  </div>
</div>
```

---

### Phase 2: Claude API連携（優先度: 中）

より高度な分析と自然言語での改善提案。

#### アーキテクチャ

```
[フロントエンド] → [Cloud Function: analyzePageInsights] → [Claude API (Haiku)]
                                    ↓
                            [改善提案を返却]
```

#### Cloud Function実装

```javascript
// functions/index.js に追加
functions.http('analyzePageInsights', async (req, res) => {
  const { analyticsData, companyDomain } = req.body;

  const prompt = `
以下のWebページアナリティクスデータを分析し、具体的な改善提案を3つ以内で提示してください。

データ:
- ページビュー: ${analyticsData.totalPageViews}
- ユニークユーザー: ${analyticsData.totalUniqueVisitors}
- CTAクリック数: ${analyticsData.totalCtaClicks}
- CVR: ${analyticsData.cvr}%
- 平均滞在時間: ${analyticsData.avgTimeOnPage}秒
- 流入元: ${JSON.stringify(analyticsData.byReferrer)}
- デバイス: ${JSON.stringify(analyticsData.byDevice)}

改善提案は以下の形式で返してください:
1. [優先度: 高/中/低] タイトル
   説明文（具体的なアクション含む）
`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  res.json({ success: true, insights: response.content[0].text });
});
```

#### コスト見積もり

| 項目 | 値 |
|------|-----|
| 使用モデル | Claude 3.5 Haiku |
| 入力トークン/回 | 約1,000 |
| 出力トークン/回 | 約300 |
| 1回あたりコスト | 約$0.0006（0.1円未満） |
| 月間コスト（10社×30回） | 約$0.18（約27円） |

---

### Phase 3: 週次レポート自動送信（優先度: 低）

Cloud Schedulerで定期実行し、メールで改善提案を送信。

#### アーキテクチャ

```
[Cloud Scheduler] → [Cloud Function: sendWeeklyReport] → [SendGrid]
        ↓                       ↓
   毎週月曜9:00           各会社のメールアドレスへ送信
```

#### 実装内容

1. `functions/index.js` に `sendWeeklyReport` 関数を追加
2. Cloud Schedulerでcron設定: `0 9 * * 1`（毎週月曜9:00）
3. SendGrid連携でメール送信

---

## 必要な追加データ収集

現在の実装で不足しているデータ:

| データ | 用途 | 実装方法 |
|--------|------|----------|
| スクロール深度到達率 | ファーストビュー改善判定 | `page_analytics_daily` に深度別到達数を集計 |
| デバイス別CVR | モバイル最適化判定 | `byDevice` にクリック数も追加 |
| 前週比較データ | トレンド分析 | 7日前のデータと比較 |

---

## ファイル変更一覧

### Phase 1

| ファイル | 変更内容 |
|----------|----------|
| `src/features/admin/page-analytics.js` | `generateInsights()` 関数追加 |
| `admin.html` | 改善提案表示セクション追加 |
| `public/css/admin.css` | `.insights-section` スタイル追加 |

### Phase 2

| ファイル | 変更内容 |
|----------|----------|
| `functions/index.js` | `analyzePageInsights` Cloud Function追加 |
| `functions/package.json` | `@anthropic-ai/sdk` 依存追加 |
| `src/features/admin/page-analytics.js` | API呼び出し処理追加 |

### Phase 3

| ファイル | 変更内容 |
|----------|----------|
| `functions/index.js` | `sendWeeklyReport` Cloud Function追加 |
| Cloud Console | Cloud Scheduler設定 |

---

## 環境変数（Phase 2以降で必要）

```bash
# Cloud Functions環境変数
ANTHROPIC_API_KEY=sk-ant-xxxxx
SENDGRID_API_KEY=SG.xxxxx  # Phase 3で必要
```

---

## 優先度・スケジュール案

1. **Phase 1（ルールベース）**: すぐに実装可能、工数: 2-3時間
2. **Phase 2（Claude API）**: APIキー取得後に実装、工数: 3-4時間
3. **Phase 3（週次レポート）**: 必要に応じて実装、工数: 4-5時間

---

## 関連ファイル

- [src/features/admin/page-analytics.js](https://github.com/togawa-design/togawa-design.github.io/blob/develop/src/features/admin/page-analytics.js) - アナリティクス表示モジュール
- [src/shared/page-analytics.js](https://github.com/togawa-design/togawa-design.github.io/blob/develop/src/shared/page-analytics.js) - フロントエンドトラッキング
- [functions/index.js](https://github.com/togawa-design/togawa-design.github.io/blob/develop/functions/index.js) - Cloud Functions
- [admin.html](https://github.com/togawa-design/togawa-design.github.io/blob/develop/admin.html) - 管理画面HTML
