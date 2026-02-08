# Firestore DB構成図

## 概要
リクエコで使用するCloud Firestoreのデータベース構成を記述します。

---

## コレクション構成図

```
firestore/
│
├── companies/                    # 会社情報
│   └── {companyDomain}/          # ドキュメントID = 会社ドメイン
│       ├── jobs/                 # サブコレクション: 求人
│       │   └── {jobId}/
│       ├── lpSettings/           # サブコレクション: LP設定
│       │   └── {jobId}/
│       ├── recruitSettings/      # サブコレクション: 採用ページ設定
│       │   └── main/
│       └── assignees/            # サブコレクション: 担当者
│           └── {assigneeId}/
│
├── admin_users/                  # 管理者ユーザー
│   └── {uid}/
│
├── company_users/                # 会社ユーザー
│   └── {username}/
│
├── applications/                 # 応募データ
│   └── {applicationId}/
│
├── users/                        # 一般ユーザー
│   └── {uid}/
│
├── pageviews/                    # ページビュー
│   └── {docId}/
│
├── page_analytics_events/        # アナリティクスイベント
│   └── {docId}/
│
└── page_analytics_daily/         # 日次アナリティクス
    └── {dateStr}/
        └── stats/
            └── {statsId}/
```

---

## コレクション詳細

### companies（会社情報）

```typescript
// /companies/{companyDomain}
{
  company: string,           // 会社名
  companyAddress: string,    // 住所
  description: string,       // 会社説明（HTML可）
  imageUrl: string,          // 会社ロゴURL
  logoUrl: string,           // 会社ロゴURL（別名）
  designPattern: string,     // デザインパターン
  order: number,             // 表示順
  showCompany: boolean,      // 公開フラグ
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### companies/{companyDomain}/jobs（求人情報）

```typescript
// /companies/{companyDomain}/jobs/{jobId}
{
  id: string,                 // 求人ID
  title: string,              // 募集タイトル
  location: string,           // 勤務地
  companyAddress: string,     // 会社住所
  access: string,             // アクセス情報
  
  // 給与情報
  salaryType: string,         // 給与形態（時給/日給/月給）
  monthlySalary: string,      // 月給
  monthlySalaryExample: string, // 月収例
  dailySalaryExample: string,   // 日収例
  yearlySalaryExample: string,  // 年収例
  totalBonus: string,         // 特典総額
  
  // 求人詳細
  jobType: string,            // 職種
  jobDescription: string,     // 仕事内容
  requirements: string,       // 応募資格
  benefits: string,           // 福利厚生
  workingHours: string,       // 勤務時間
  holidays: string,           // 休日
  employmentType: string,     // 雇用形態
  
  // 表示設定
  features: string,           // 特徴タグ（カンマ区切り）
  displayedFeatures: string,  // 表示用特徴タグ
  visible: boolean,           // 公開フラグ
  order: number,              // 表示順
  
  // 掲載期間
  publishStartDate: Timestamp,
  publishEndDate: Timestamp,
  
  // メディア
  jobLogo: string,            // 求人ロゴURL
  showVideoButton: boolean,   // 動画ボタン表示
  videoUrl: string,           // 動画URL
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### companies/{companyDomain}/lpSettings（LP設定）

```typescript
// /companies/{companyDomain}/lpSettings/{jobId}
{
  sections: [                 // セクション配列
    {
      type: string,           // セクションタイプ
      visible: boolean,       // 表示フラグ
      order: number,          // 表示順
      settings: {             // セクション固有設定
        title: string,
        subtitle: string,
        // ... セクションタイプに応じた設定
      }
    }
  ],
  designPattern: string,      // デザインパターン
  themeColor: string,         // テーマカラー
  updatedAt: Timestamp
}
```

### companies/{companyDomain}/recruitSettings（採用ページ設定）

```typescript
// /companies/{companyDomain}/recruitSettings/main
{
  sections: [                 // セクション配列
    {
      type: string,
      visible: boolean,
      order: number,
      settings: { ... }
    }
  ],
  headerSettings: {
    logoUrl: string,
    heroImageUrl: string,
    title: string,
    subtitle: string
  },
  footerSettings: {
    companyName: string,
    address: string,
    phone: string,
    email: string
  },
  designPattern: string,
  updatedAt: Timestamp
}
```

### admin_users（管理者ユーザー）

```typescript
// /admin_users/{uid}
{
  uid: string,
  email: string,
  displayName: string,
  photoURL: string,
  role: string,               // 'admin' | 'super_admin'
  createdAt: Timestamp,
  lastLoginAt: Timestamp
}
```

### company_users（会社ユーザー）

```typescript
// /company_users/{username}
{
  username: string,
  password: string,           // ハッシュ化推奨
  companyDomain: string,      // 紐付け会社
  displayName: string,
  email: string,
  role: string,               // 'company_admin' | 'company_user'
  createdAt: Timestamp,
  lastLoginAt: Timestamp
}
```

### applications（応募データ）

```typescript
// /applications/{applicationId}
{
  // 応募者情報
  applicant: {
    name: string,
    email: string,
    phone: string,
    age: number,
    currentJob: string,
    experience: string,
    message: string
  },
  
  // 求人情報
  companyDomain: string,
  jobId: string,
  jobTitle: string,
  
  // ステータス
  status: string,             // 'new' | 'reviewing' | 'interview' | 'hired' | 'rejected'
  
  // 面談情報
  interviewDate: Timestamp,
  interviewNotes: string,
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### users（一般ユーザー）

```typescript
// /users/{uid}
{
  uid: string,
  email: string,
  displayName: string,
  photoURL: string,
  
  // プロフィール
  profile: {
    name: string,
    phone: string,
    age: number,
    currentJob: string,
    desiredJob: string,
    experience: string
  },
  
  // お気に入り
  favorites: string[],        // 求人ID配列
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### page_analytics_events（アナリティクスイベント）

```typescript
// /page_analytics_events/{docId}
{
  pageType: string,           // 'lp' | 'recruit' | 'job'
  companyDomain: string,
  jobId: string,
  eventType: string,          // 'pageview' | 'apply_click' | 'scroll'
  userAgent: string,
  referrer: string,
  createdAt: Timestamp
}
```

---

## インデックス設定

### jobs コレクション

```json
{
  "collectionGroup": "jobs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "visible", "order": "ASCENDING" },
    { "fieldPath": "order", "order": "ASCENDING" }
  ]
}
```

```json
{
  "collectionGroup": "jobs",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "visible", "order": "ASCENDING" },
    { "fieldPath": "publishEndDate", "order": "DESCENDING" }
  ]
}
```

### applications コレクション

```json
{
  "collectionGroup": "applications",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "companyDomain", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

---

## セキュリティルール概要

| コレクション | 読み取り | 書き込み |
|-------------|---------|---------|
| companies | 全員 | 認証ユーザー |
| jobs | 全員（visible=true） | 認証ユーザー |
| lpSettings | 全員 | 認証ユーザー |
| recruitSettings | 全員 | 認証ユーザー |
| admin_users | 認証ユーザー | 管理者 |
| company_users | 全員 | 管理者 |
| applications | 全員（開発中） | 全員（開発中） |
| users | 全員 | 全員 |
| page_analytics_events | 認証ユーザー | 全員 |

---

## ER図

```
┌─────────────────┐       ┌─────────────────┐
│   companies     │       │   admin_users   │
│─────────────────│       │─────────────────│
│ companyDomain   │       │ uid             │
│ company         │       │ email           │
│ showCompany     │       │ role            │
└────────┬────────┘       └─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐       ┌─────────────────┐
│     jobs        │       │  company_users  │
│─────────────────│       │─────────────────│
│ jobId           │       │ username        │
│ companyDomain   │◄──────│ companyDomain   │
│ title           │       │ password        │
│ visible         │       └─────────────────┘
└────────┬────────┘
         │
         │ 1:1
         ▼
┌─────────────────┐       ┌─────────────────┐
│   lpSettings    │       │ recruitSettings │
│─────────────────│       │─────────────────│
│ jobId           │       │ companyDomain   │
│ sections        │       │ sections        │
│ designPattern   │       │ designPattern   │
└─────────────────┘       └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│  applications   │       │     users       │
│─────────────────│       │─────────────────│
│ applicationId   │       │ uid             │
│ companyDomain   │       │ email           │
│ jobId           │       │ favorites[]     │
│ applicant{}     │       │ profile{}       │
│ status          │       └─────────────────┘
└─────────────────┘
```

---

## データ移行メモ

### GAS → Firestore 移行

| GAS（スプレッドシート） | Firestore |
|----------------------|-----------|
| 会社一覧シート | /companies |
| 各社管理シート | /companies/{domain}/jobs |
| LP設定シート | /companies/{domain}/lpSettings |
| 採用ページ設定シート | /companies/{domain}/recruitSettings |

---

## 関連ドキュメント
- [環境構築手順](./setup.md)
- [画面遷移図](./screen-flow.md)
- [詳細設計書](./detailed-design.md)
