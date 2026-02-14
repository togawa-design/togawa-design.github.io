# インフラ構成図

## 概要

本システムはGoogle Cloud Platform（GCP）とFirebaseを基盤とし、GitHub Pagesでフロントエンドをホスティング。

---

## 全体構成図

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              インターネット                               │
└─────────────────────────────────────────────────────────────────────────┘
                │                    │                    │
                ▼                    ▼                    ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────────┐
│   GitHub Pages    │  │   Cloud Functions │  │     外部サービス           │
│  (フロントエンド)   │  │    (バックエンド)   │  │                           │
│                   │  │                   │  │  ・Google Analytics 4     │
│  ・admin.html     │  │  ・getAnalyticsData│  │  ・SendGrid              │
│  ・company-recruit│  │  ・legacyLogin     │  │  ・Cloudinary            │
│  ・lp.html        │  │  ・sendEmail       │  │  ・Google Calendar API   │
│                   │  │  ・etc...          │  │  ・e-Stat API            │
└───────────────────┘  └───────────────────┘  └───────────────────────────┘
                │                    │
                │                    ▼
                │         ┌───────────────────┐
                │         │     Firebase      │
                │         │                   │
                └────────▶│  ・Authentication │
                          │  ・Firestore      │
                          │  ・Storage        │
                          └───────────────────┘
```

---

## 環境構成

### 本番環境

| サービス | プロジェクトID / URL |
|---------|---------------------|
| GCP Project | `generated-area-484613-e3` |
| Firebase Project | `generated-area-484613-e3-90bd4` |
| Cloud Functions | `asia-northeast1-generated-area-484613-e3.cloudfunctions.net` |
| GitHub Pages | `https://togawa-design.github.io` |
| カスタムドメイン | `https://rikueco.jp` |
| GA4 Property | `520379160` |

### 開発環境

| サービス | プロジェクトID / URL |
|---------|---------------------|
| GCP Project | `lset-dev` |
| Firebase Project | `lset-dev` |
| Cloud Functions | `asia-northeast1-lset-dev.cloudfunctions.net` |
| GA4 Property | `524526933` |

---

## GCPリソース詳細

### Cloud Functions

| 関数名 | Gen | ランタイム | メモリ | タイムアウト |
|-------|-----|----------|--------|------------|
| getAnalyticsData | Gen2 | Node.js 22 | 256MB | 60s |
| trackPageAnalytics | Gen2 | Node.js 22 | 256MB | 60s |
| getPageAnalytics | Gen2 | Node.js 22 | 256MB | 60s |
| sendEmail | Gen2 | Node.js 22 | 256MB | 60s |
| inboundParse | Gen2 | Node.js 22 | 256MB | 60s |
| getEmails | Gen2 | Node.js 22 | 256MB | 60s |
| createCompanyUser | Gen2 | Node.js 22 | 256MB | 60s |
| createCompanyStaff | Gen2 | Node.js 22 | 256MB | 60s |
| deleteCompanyUser | Gen2 | Node.js 22 | 256MB | 60s |
| legacyLogin | Gen1 | Node.js 22 | 256MB | 60s |
| resetLegacyPassword | Gen1 | Node.js 22 | 256MB | 60s |
| initiateCalendarAuth | Gen1 | Node.js 22 | 256MB | 60s |
| calendarOAuthCallback | Gen1 | Node.js 22 | 256MB | 60s |
| getCalendarAvailability | Gen1 | Node.js 22 | 256MB | 60s |
| createCalendarEvent | Gen1 | Node.js 22 | 256MB | 60s |
| getCalendarIntegration | Gen1 | Node.js 22 | 256MB | 60s |
| revokeCalendarAuth | Gen1 | Node.js 22 | 256MB | 60s |
| syncSalaryData | Gen2 | Node.js 22 | 256MB | 60s |
| getSalaryData | Gen2 | Node.js 22 | 256MB | 60s |

### Firebase

#### Authentication
- メール/パスワード認証: 有効
- Google認証: 有効

#### Firestore
- リージョン: `asia-northeast1`
- モード: Native

**主要コレクション:**
- `companies` - 会社情報
- `company_users` - 会社ユーザー
- `admins` - システム管理者
- `jobs` - 求人情報
- `applications` - 応募情報
- `emails` - メール履歴
- `calendar_tokens` - カレンダー連携トークン
- `page_analytics` - ページアナリティクス

#### Storage
- バケット: `generated-area-484613-e3-90bd4.appspot.com`
- 用途: 画像アップロード（Cloudinaryへ移行済み）

---

## ネットワーク構成

```
┌──────────────────────────────────────────────────────────────┐
│                         ユーザー                              │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                      CDN / DNS                               │
│  ・GitHub Pages (togawa-design.github.io)                   │
│  ・カスタムドメイン (rikueco.jp)                              │
└──────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
┌───────────────────┐ ┌───────────────┐ ┌───────────────────┐
│   静的コンテンツ    │ │  API リクエスト │ │  Firebase SDK    │
│  (HTML/CSS/JS)    │ │  (HTTPS)      │ │  (WebSocket)     │
└───────────────────┘ └───────────────┘ └───────────────────┘
            │                 │                 │
            ▼                 ▼                 ▼
┌───────────────────┐ ┌───────────────┐ ┌───────────────────┐
│   GitHub Pages    │ │Cloud Functions│ │    Firebase       │
│                   │ │   (Gen1/2)    │ │  Auth/Firestore   │
└───────────────────┘ └───────────────┘ └───────────────────┘
```

---

## セキュリティ

### アクセス制御

| レイヤー | 制御方法 |
|---------|---------|
| Cloud Functions | CORS設定、Firebase ID Token検証 |
| Firestore | セキュリティルール |
| Firebase Auth | メール確認、パスワードポリシー |

### 暗号化

| データ | 暗号化方式 |
|--------|----------|
| 通信 | HTTPS/TLS 1.3 |
| Firestore | 保存時暗号化（デフォルト） |
| パスワード | bcrypt（ソルト付きハッシュ） |

---

## 監視・ログ

| 項目 | サービス |
|------|---------|
| アプリケーションログ | Cloud Logging |
| エラー監視 | Cloud Error Reporting |
| パフォーマンス | Cloud Monitoring |
| アナリティクス | Google Analytics 4 |

---

## コスト構造

### 無料枠内で運用可能な項目

- GitHub Pages: 無料
- Firebase Auth: 10,000 MAU まで無料
- Firestore: 1GB ストレージ、50,000 読み取り/日 まで無料
- Cloud Functions: 200万呼び出し/月 まで無料

### 有料サービス

| サービス | 料金体系 |
|---------|---------|
| SendGrid | 従量課金 or プラン |
| Cloudinary | 従量課金 or プラン |
| GA4 | 無料 |
