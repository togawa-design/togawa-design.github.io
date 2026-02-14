# 外部連携仕様書

## 概要

本システムが連携している外部サービスの仕様を記載する。

---

## 連携サービス一覧

| サービス | 用途 | 連携方式 |
|---------|------|---------|
| Google Analytics 4 | アクセス解析 | Data API |
| SendGrid | メール送信・受信 | Web API / Inbound Parse |
| Cloudinary | 画像ホスティング | Upload API |
| Google Calendar | 面接日程調整 | Calendar API (OAuth) |
| e-Stat | 給与相場データ | REST API |

---

## Google Analytics 4

### 概要

ユーザー行動データの収集と分析。

### 設定情報

| 項目 | 本番 | 開発 |
|------|------|------|
| Property ID | `520379160` | `524526933` |
| Measurement ID | `G-XXXXXXX` | `G-XXXXXXX` |

### 使用API

**Google Analytics Data API v1**

```
https://analyticsdata.googleapis.com/v1beta
```

### 認証

サービスアカウント認証（ADC: Application Default Credentials）

```javascript
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const client = new BetaAnalyticsDataClient();
```

### 取得データ

| データ種別 | イベント名 | 説明 |
|-----------|-----------|------|
| ページビュー | `page_view` | ページ閲覧 |
| 企業ページ閲覧 | `view_company_page` | 企業詳細ページ閲覧 |
| 応募クリック | `click_apply` | 応募ボタンクリック |
| LINE相談 | `click_line` | LINEボタンクリック |
| フォーム送信 | `form_submit` | フォーム送信完了 |

### カスタムディメンション

| ディメンション | 説明 |
|---------------|------|
| `company_domain` | 会社ドメイン |
| `job_id` | 求人ID |
| `page_type` | ページ種別 |

---

## SendGrid

### 概要

メール送信と受信（Inbound Parse）。

### 設定情報

| 項目 | 値 |
|------|-----|
| API Version | v3 |
| From Domain | `mail.rikueco.jp` |

### 環境変数

```
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
```

### メール送信

**エンドポイント:** `POST /v3/mail/send`

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: 'recipient@example.com',
  from: 'noreply@mail.rikueco.jp',
  subject: '件名',
  html: '<p>本文</p>'
};

await sgMail.send(msg);
```

### Inbound Parse（受信メール）

**Webhook URL:** `/inboundParse`

SendGrid管理画面で設定:
1. Settings → Inbound Parse
2. Domain: `mail.rikueco.jp`
3. URL: `https://asia-northeast1-generated-area-484613-e3.cloudfunctions.net/inboundParse`

**受信データ形式:**
```json
{
  "from": "sender@example.com",
  "to": "company@mail.rikueco.jp",
  "subject": "件名",
  "text": "本文（テキスト）",
  "html": "<p>本文（HTML）</p>",
  "attachments": "添付ファイル数"
}
```

---

## Cloudinary

### 概要

画像のアップロード、変換、配信。

### 設定情報

| 項目 | 値 |
|------|-----|
| Cloud Name | `rikueco` |
| Upload Preset | `ml_default` |
| Base URL | `https://res.cloudinary.com/rikueco` |

### クライアントサイドアップロード

```javascript
const formData = new FormData();
formData.append('file', file);
formData.append('upload_preset', 'ml_default');
formData.append('folder', 'companies/logos');

const response = await fetch(
  'https://api.cloudinary.com/v1_1/rikueco/image/upload',
  { method: 'POST', body: formData }
);

const data = await response.json();
const imageUrl = data.secure_url;
```

### 画像変換（URL変換）

```
# オリジナル
https://res.cloudinary.com/rikueco/image/upload/v123/folder/image.jpg

# リサイズ（幅300px）
https://res.cloudinary.com/rikueco/image/upload/w_300/v123/folder/image.jpg

# クロップ（正方形）
https://res.cloudinary.com/rikueco/image/upload/c_fill,w_200,h_200/v123/folder/image.jpg
```

### フォルダ構成

| フォルダ | 用途 |
|---------|------|
| `companies/logos` | 会社ロゴ |
| `companies/photos` | 会社写真 |
| `jobs/images` | 求人画像 |
| `lp/hero` | LPヒーロー画像 |

---

## Google Calendar API

### 概要

面接日程の空き時間確認と予定作成。

### 認証フロー（OAuth 2.0）

```
┌─────────┐     ┌──────────────────┐     ┌─────────────┐
│ ユーザー │────▶│ initiateCalendarAuth │────▶│ Google OAuth │
└─────────┘     └──────────────────┘     └─────────────┘
                                                │
                ┌──────────────────┐            │
                │calendarOAuthCallback│◀───────────┘
                └──────────────────┘
                        │
                        ▼
                ┌──────────────────┐
                │ Firestore保存     │
                │ (calendar_tokens) │
                └──────────────────┘
```

### 環境変数

```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

### スコープ

```
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/calendar.events
```

### API使用例

**空き時間取得:**
```javascript
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

const response = await calendar.freebusy.query({
  requestBody: {
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    items: [{ id: 'primary' }]
  }
});
```

**予定作成:**
```javascript
const event = await calendar.events.insert({
  calendarId: 'primary',
  requestBody: {
    summary: '面接: 山田太郎様',
    start: { dateTime: '2026-02-20T10:00:00+09:00' },
    end: { dateTime: '2026-02-20T11:00:00+09:00' },
    attendees: [{ email: 'applicant@example.com' }],
    conferenceData: {
      createRequest: { requestId: 'unique-id' }
    }
  },
  conferenceDataVersion: 1
});
```

### Firestoreスキーマ（calendar_tokens）

```javascript
{
  companyDomain: "example-company",
  accessToken: "ya29.xxxxx",
  refreshToken: "1//xxxxx",
  expiryDate: 1234567890000,
  calendarEmail: "user@example.com",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## e-Stat API

### 概要

政府統計ポータルから給与相場データを取得。

### 設定情報

| 項目 | 値 |
|------|-----|
| Base URL | `https://api.e-stat.go.jp/rest/3.0/app` |
| 統計ID | 賃金構造基本統計調査 |

### API使用例

```javascript
const response = await fetch(
  'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?' +
  `appId=${API_KEY}&statsDataId=${STATS_ID}&cdCat01=${industryCode}`
);

const data = await response.json();
```

### データ取得項目

| 項目 | 説明 |
|------|------|
| 業種別平均賃金 | 月額給与 |
| 年齢別賃金 | 年齢層ごとの平均 |
| 地域別賃金 | 都道府県ごとの平均 |

### Firestoreキャッシュ（salary_data）

```javascript
{
  industryCode: "I",
  region: "tokyo",
  averageSalary: 350000,
  ageDistribution: {...},
  lastSyncedAt: Timestamp
}
```

---

## 連携状態確認

### エンドポイント

| サービス | 確認方法 |
|---------|---------|
| GA4 | `/getAnalyticsData?type=overview` |
| SendGrid | `/health` で確認 |
| Calendar | `/getCalendarIntegration?companyDomain=xxx` |

### ダッシュボード

- SendGrid: https://app.sendgrid.com
- Cloudinary: https://cloudinary.com/console
- GA4: https://analytics.google.com
- GCP: https://console.cloud.google.com

---

## トラブルシューティング

### GA4データが取得できない

1. サービスアカウントの権限確認
2. Property IDの確認
3. Data API有効化確認

### SendGrid送信エラー

1. API Keyの確認
2. From ドメインの認証確認
3. 送信制限の確認

### Calendar連携失敗

1. OAuth同意画面の確認
2. リダイレクトURIの設定確認
3. トークンの有効期限確認

### Cloudinaryアップロード失敗

1. Upload Presetの確認
2. ファイルサイズ制限確認
3. CORSの確認
