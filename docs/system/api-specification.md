# API仕様書

## 概要

本システムのCloud Functions APIエンドポイント一覧と仕様。

**ベースURL:**
- 本番: `https://asia-northeast1-generated-area-484613-e3.cloudfunctions.net`
- 開発: `https://asia-northeast1-lset-dev.cloudfunctions.net`

---

## 認証

### Firebase ID Token認証（推奨）
```
Authorization: Bearer <firebase_id_token>
```

### 認証不要エンドポイント
一部のエンドポイントは認証なしでアクセス可能（CORS制限あり）

---

## エンドポイント一覧

### アナリティクス系

| エンドポイント | メソッド | 認証 | 説明 |
|---------------|---------|------|------|
| `/getAnalyticsData` | GET | 任意 | GA4データ取得 |
| `/trackPageAnalytics` | POST | 不要 | ページアナリティクス記録 |
| `/getPageAnalytics` | GET | 任意 | ページアナリティクス取得 |

### 認証・ユーザー管理系

| エンドポイント | メソッド | 認証 | 説明 |
|---------------|---------|------|------|
| `/createCompanyUser` | POST | 必要 | 会社ユーザー作成 |
| `/createCompanyStaff` | POST | 必要 | スタッフ作成 |
| `/deleteCompanyUser` | POST | 必要 | ユーザー削除 |
| `/legacyLogin` | POST | 不要 | レガシー認証ログイン |
| `/resetLegacyPassword` | POST | 必要 | レガシーパスワードリセット |
| `/migrateCompanyUsersToFirebaseAuth` | POST | 必要 | Firebase Auth移行 |

### メール系

| エンドポイント | メソッド | 認証 | 説明 |
|---------------|---------|------|------|
| `/sendEmail` | POST | 必要 | メール送信 |
| `/inboundParse` | POST | 不要 | 受信メール処理（SendGrid Webhook） |
| `/getEmails` | GET | 必要 | メール一覧取得 |

### カレンダー系

| エンドポイント | メソッド | 認証 | 説明 |
|---------------|---------|------|------|
| `/initiateCalendarAuth` | GET | 必要 | Google Calendar OAuth開始 |
| `/calendarOAuthCallback` | GET | 不要 | OAuth コールバック |
| `/getCalendarAvailability` | GET | 必要 | 空き時間取得 |
| `/createCalendarEvent` | POST | 必要 | 予定作成 |
| `/getCalendarIntegration` | GET | 必要 | 連携状態取得 |
| `/revokeCalendarAuth` | POST | 必要 | 連携解除 |

### 給与データ系

| エンドポイント | メソッド | 認証 | 説明 |
|---------------|---------|------|------|
| `/syncSalaryData` | POST | 必要 | e-Stat給与データ同期 |
| `/getSalaryData` | GET | 任意 | 給与相場データ取得 |

### ヘルスチェック

| エンドポイント | メソッド | 認証 | 説明 |
|---------------|---------|------|------|
| `/health` | GET | 不要 | ヘルスチェック |

---

## 詳細仕様

### getAnalyticsData

GA4からアナリティクスデータを取得する。

**リクエスト:**
```
GET /getAnalyticsData?type={type}&days={days}&company_domain={domain}
```

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| type | string | ○ | データ種別（下記参照） |
| days | number | × | 期間（デフォルト: 30） |
| company_domain | string | × | 会社ドメインでフィルタ |
| domain | string | × | 会社ドメイン（type依存） |

**type一覧:**
- `overview` - 概要データ
- `companies` - 会社別データ
- `daily` - 日別データ
- `applications` - 応募データ
- `engagement` - エンゲージメントデータ
- `traffic` - 流入元データ
- `funnel` - ファネルデータ
- `trends` - トレンドデータ
- `company-detail` - 会社詳細データ

**レスポンス例（overview）:**
```json
{
  "success": true,
  "data": {
    "totalPageviews": 12500,
    "totalUsers": 3200,
    "companyViews": 4500,
    "applyClicks": 120
  }
}
```

---

### legacyLogin

レガシー認証（ID/パスワード）でログインする。

**リクエスト:**
```
POST /legacyLogin
Content-Type: application/json

{
  "usernameOrEmail": "user@example.com",
  "password": "password123"
}
```

**レスポンス（成功）:**
```json
{
  "success": true,
  "user": {
    "docId": "user_123",
    "companyDomain": "example-company",
    "companyName": "株式会社サンプル",
    "userName": "山田太郎",
    "email": "user@example.com"
  },
  "companies": [
    {
      "docId": "user_123",
      "companyDomain": "example-company",
      "companyName": "株式会社サンプル"
    }
  ]
}
```

**レスポンス（複数会社所属）:**
```json
{
  "success": true,
  "requiresCompanySelection": true,
  "companies": [
    { "docId": "...", "companyDomain": "company-a", "companyName": "A社" },
    { "docId": "...", "companyDomain": "company-b", "companyName": "B社" }
  ]
}
```

---

### createCompanyUser

会社ユーザーを作成する。Firebase Authにユーザーを作成し、Firestoreにメタデータを保存。

**リクエスト:**
```
POST /createCompanyUser
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "companyDomain": "example-company",
  "name": "新規ユーザー",
  "role": "staff",
  "username": "newuser"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| email | string | ○ | メールアドレス |
| password | string | ○ | パスワード（8文字以上） |
| companyDomain | string | ○ | 会社ドメイン |
| name | string | × | 表示名 |
| role | string | × | 権限（admin/staff） |
| username | string | × | ユーザーID |

**レスポンス:**
```json
{
  "success": true,
  "uid": "firebase_uid_123",
  "docId": "firebase_uid_123",
  "email": "newuser@example.com",
  "isExistingUser": false,
  "message": "ユーザーを作成しました"
}
```

---

### sendEmail

SendGrid経由でメールを送信する。

**リクエスト:**
```
POST /sendEmail
Content-Type: application/json

{
  "to": "recipient@example.com",
  "subject": "件名",
  "html": "<p>本文</p>",
  "companyDomain": "example-company",
  "applicationId": "app_123"
}
```

**レスポンス:**
```json
{
  "success": true,
  "messageId": "msg_xxx",
  "emailId": "firestore_doc_id"
}
```

---

### getCalendarAvailability

Google Calendarの空き時間を取得する。

**リクエスト:**
```
GET /getCalendarAvailability?companyDomain={domain}&startDate={date}&endDate={date}
```

**レスポンス:**
```json
{
  "success": true,
  "availability": [
    {
      "date": "2026-02-15",
      "slots": [
        { "start": "10:00", "end": "11:00", "available": true },
        { "start": "11:00", "end": "12:00", "available": false }
      ]
    }
  ]
}
```

---

## エラーレスポンス

すべてのエンドポイントで共通のエラー形式を使用。

```json
{
  "success": false,
  "error": "エラーメッセージ"
}
```

| HTTPステータス | 説明 |
|---------------|------|
| 400 | リクエスト不正 |
| 401 | 認証エラー |
| 403 | 権限エラー |
| 404 | リソースが見つからない |
| 500 | サーバーエラー |

---

## CORS設定

許可されているオリジン:
- `https://togawa-design.github.io`
- `https://rikueco.jp`
- `http://localhost:3000`（開発環境）
- `http://localhost:3001`（開発環境）
