# AI求人文章生成 実装プラン

## 概要

求人編集画面にAI機能を追加し、求職者に刺さる文面を自動生成する。

---

## Phase 1: 基盤構築

### 1.1 OpenAI アカウント・API準備

- [ ] OpenAI アカウント作成: https://platform.openai.com/signup
- [ ] APIキー発行: https://platform.openai.com/api-keys
- [ ] クレジット追加（$10程度で開始）
- [ ] APIキーを環境変数として設定

### 1.2 Cloud Function 作成

**エンドポイント**: `/generateJobDescription`

```javascript
// functions/index.js に追加
functions.http('generateJobDescription', (req, res) => {
  // OpenAI API呼び出し
  // 入力: 職種、勤務地、給与、特徴など
  // 出力: 生成された説明文
});
```

**デプロイスクリプト追加** (package.json):
```json
"deploy:ai": "gcloud functions deploy generateJobDescription --gen2 --runtime nodejs20 --trigger-http --allow-unauthenticated --region asia-northeast1 --project generated-area-484613-e3 --set-env-vars OPENAI_API_KEY=$OPENAI_API_KEY"
```

### 1.3 フロントエンド UI

求人編集画面に「AI生成」ボタンを追加:

```
┌─────────────────────────────────────────┐
│ 仕事内容                                 │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │ (テキストエリア)                     │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│ [✨ AIで生成] [📝 AIで改善]              │
└─────────────────────────────────────────┘
```

---

## Phase 2: 基本機能実装

### 2.1 説明文生成

**入力項目**:
- 職種名
- 勤務地
- 給与
- 勤務時間
- 特徴・メリット（箇条書き）

**プロンプト例**:
```
あなたは求人広告のプロライターです。
以下の情報を元に、求職者の心に響く求人説明文を作成してください。

【職種】{jobTitle}
【勤務地】{location}
【給与】{salary}
【特徴】{features}

要件:
- 200〜400文字程度
- 親しみやすいトーン
- 具体的なメリットを強調
- 応募を促す文言を含める
```

### 2.2 タイトル提案

**機能**: 職種名から複数のタイトル候補を生成

**出力例**:
```
1. 【月収30万円以上】未経験歓迎の期間工スタッフ
2. 寮完備で安心！愛知県の製造スタッフ募集
3. 正社員登用あり◎大手メーカーで働く期間工
```

### 2.3 文章改善

**機能**: 既存の説明文を入力し、より魅力的に書き換え

---

## Phase 3: 媒体対応

### 3.1 対応媒体

| 媒体 | 文字数制限 | 特徴 |
|------|-----------|------|
| Indeed | 4000文字 | SEO重視、キーワード含める |
| 求人ボックス | 2000文字 | シンプル・簡潔 |
| スタンバイ | 3000文字 | 条件明確に |
| 自社LP | 制限なし | ストーリー性重視 |

### 3.2 媒体別プロンプト

各媒体の特性に合わせたプロンプトテンプレートを用意:

```javascript
const MEDIA_PROMPTS = {
  indeed: '【Indeed向け】検索されやすいキーワードを含め...',
  kyujinbox: '【求人ボックス向け】簡潔に要点をまとめ...',
  lp: '【自社LP向け】会社の魅力を伝えるストーリー調で...'
};
```

### 3.3 一括生成

1つの求人データから複数媒体向けの文章を一括生成:

```
[求人データ入力]
      ↓
┌─────────────────────────────────┐
│ Indeed向け    │ 生成完了 ✓      │
│ 求人ボックス向け │ 生成完了 ✓      │
│ 自社LP向け    │ 生成完了 ✓      │
└─────────────────────────────────┘
```

---

## Phase 4: 品質向上

### 4.1 フィードバックループ

- 生成文の「採用」「不採用」を記録
- 採用された文のパターンを学習
- プロンプトの継続的改善

### 4.2 A/Bテスト連携

- 複数パターンの文章を生成
- 応募率を比較
- 効果の高いパターンを優先

### 4.3 業界別テンプレート

- 製造業向け
- 物流業向け
- 飲食業向け
- etc.

---

## 技術仕様

### API設計

```
POST /generateJobDescription
Content-Type: application/json

Request:
{
  "jobTitle": "期間工",
  "location": "愛知県豊田市",
  "salary": "月給30万円〜",
  "features": ["寮完備", "未経験OK", "正社員登用あり"],
  "targetMedia": "indeed",  // optional
  "tone": "friendly"        // friendly | formal | casual
}

Response:
{
  "success": true,
  "generated": {
    "description": "生成された説明文...",
    "titles": ["タイトル候補1", "タイトル候補2", "タイトル候補3"]
  },
  "usage": {
    "promptTokens": 150,
    "completionTokens": 300,
    "estimatedCost": 0.0006
  }
}
```

### セキュリティ

- APIキーはCloud Functionsの環境変数に保存
- フロントエンドからは直接OpenAI APIを呼ばない
- レート制限を設定（1社あたり月100回など）

### コスト管理

```javascript
// 使用量をFirestoreに記録
await db.collection('ai_usage').add({
  companyDomain: 'xxx',
  function: 'generateJobDescription',
  tokens: 450,
  cost: 0.0006,
  timestamp: new Date()
});
```

---

## 実装順序

```
Week 1: 基盤
├── OpenAI契約・APIキー取得
├── Cloud Function作成（generateJobDescription）
└── 基本的なプロンプト作成

Week 2: UI実装
├── 求人編集画面にボタン追加
├── 生成結果の表示
└── テキストエリアへの反映

Week 3: 改善
├── プロンプトチューニング
├── エラーハンドリング
└── ローディング表示

Week 4: 拡張
├── 媒体別対応
├── 使用量トラッキング
└── 本番デプロイ
```

---

## コスト見積もり

### GPT-4o-mini 使用時

| 項目 | 単価 | 1回あたり | 月100回 |
|------|------|----------|---------|
| 入力 (500トークン) | $0.15/1M | $0.000075 | $0.0075 |
| 出力 (1000トークン) | $0.60/1M | $0.0006 | $0.06 |
| **合計** | | **約$0.0007** | **約$0.07 (¥10)** |

### 月間想定

| 会社数 | 月間利用回数 | 月額コスト |
|--------|-------------|-----------|
| 10社 | 100回 | 約 ¥10 |
| 50社 | 500回 | 約 ¥50 |
| 100社 | 1000回 | 約 ¥100 |

---

## 次のアクション

1. [ ] OpenAI アカウント作成
2. [ ] APIキー発行
3. [ ] Cloud Function実装開始
