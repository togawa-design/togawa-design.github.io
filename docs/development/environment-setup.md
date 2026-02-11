# 環境設定ガイド

## 環境構成図

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              L-SET プロジェクト                               │
├─────────────────────────────────┬───────────────────────────────────────────┤
│           本番環境 (prod)        │            開発環境 (dev)                  │
├─────────────────────────────────┼───────────────────────────────────────────┤
│                                 │                                           │
│  ┌─────────────────────────┐   │   ┌─────────────────────────┐            │
│  │      Firebase           │   │   │      Firebase           │            │
│  │  generated-area-...     │   │   │      lset-dev           │            │
│  └─────────────────────────┘   │   └─────────────────────────┘            │
│              │                  │              │                           │
│              ▼                  │              ▼                           │
│  ┌─────────────────────────┐   │   ┌─────────────────────────┐            │
│  │   Cloud Functions       │   │   │   Cloud Functions       │            │
│  │   asia-northeast1       │   │   │   asia-northeast1       │            │
│  └─────────────────────────┘   │   └─────────────────────────┘            │
│                                 │                                           │
│  ┌─────────────────────────┐   │   ┌─────────────────────────┐            │
│  │     Cloudinary          │   │   │     Cloudinary          │            │
│  │     prod/ フォルダ       │   │   │     dev/ フォルダ        │            │
│  └─────────────────────────┘   │   └─────────────────────────┘            │
│                                 │                                           │
│  ┌─────────────────────────┐   │   ┌─────────────────────────┐            │
│  │     GitHub Pages        │   │   │     GitHub Pages        │            │
│  │     / (ルート)           │   │   │     /dev/               │            │
│  └─────────────────────────┘   │   └─────────────────────────┘            │
│                                 │                                           │
└─────────────────────────────────┴───────────────────────────────────────────┘
```

---

## サービス別 ID 一覧

### Firebase

| 項目 | 本番環境 | 開発環境 |
|------|----------|----------|
| **Project ID** | `generated-area-484613-e3-90bd4` | `lset-dev` |
| **API Key** | `AIzaSyB3eXZoFkXOwnHxPvaHiWO7csmZK4KGqAQ` | `AIzaSyBVFGaoXtmkpJMju6XdNFxN969WcJCggKc` |
| **Auth Domain** | `generated-area-484613-e3-90bd4.firebaseapp.com` | `lset-dev.firebaseapp.com` |
| **Console URL** | [Firebase Console (本番)](https://console.firebase.google.com/project/generated-area-484613-e3-90bd4) | [Firebase Console (開発)](https://console.firebase.google.com/project/lset-dev) |

### Cloud Functions

| 項目 | 本番環境 | 開発環境 |
|------|----------|----------|
| **Region** | `asia-northeast1` | `asia-northeast1` |
| **Base URL** | `https://asia-northeast1-generated-area-484613-e3.cloudfunctions.net` | `https://asia-northeast1-lset-dev.cloudfunctions.net` |

### Cloudinary（共通アカウント）

| 項目 | 値 |
|------|-----|
| **Cloud Name** | `dnvtqyhuw` |
| **Upload Preset** | `rikueko_unsigned` |
| **本番フォルダ** | `prod/` |
| **開発フォルダ** | `dev/` |
| **Console URL** | [Cloudinary Console](https://console.cloudinary.com/) |

#### フォルダ構造
```
dnvtqyhuw/
├── prod/                    # 本番環境
│   ├── companies/{domain}/  # 企業ロゴ・画像
│   ├── jobs/{domain}/       # 求人画像
│   ├── recruit/{domain}/    # 採用ページ画像
│   └── lp/{domain}/         # LP画像
│
└── dev/                     # 開発環境
    ├── companies/{domain}/
    ├── jobs/{domain}/
    ├── recruit/{domain}/
    └── lp/{domain}/
```

### GitHub Pages

| 項目 | 本番環境 | 開発環境 |
|------|----------|----------|
| **Base Path** | `/` | `/dev/` |
| **URL** | `https://togawa-design.github.io/` | `https://togawa-design.github.io/dev/` |
| **ビルドコマンド** | `npm run build` | `npm run build:dev` |
| **対応ブランチ** | `main` | `develop` |

### Google Analytics（共通）

| 項目 | 値 |
|------|-----|
| **Property ID** | `G-E1XC94EG05` |
| **API Key** | `AIzaSyAIC2WGg5dnvMh6TO4sivpbk4HtpYw4tbo` |

### GAS (Google Apps Script)（共通）

| 項目 | 値 |
|------|-----|
| **API URL** | `https://script.google.com/macros/s/AKfycbxj6CqSfY7jq04uDXURhewD_BAKx3csLKBpl1hdRBdNg-R-E6IuoaZGje22Gr9WYWY2/exec` |
| **Spreadsheet ID** | `1NVIDV3OiXbNrVI7EFdRrU2Ggn8dx7Q0rSnvJ6uaWvX0` |

---

## 環境変数ファイル

| ファイル | 用途 | 読み込みタイミング |
|----------|------|-------------------|
| `.env.production` | 本番環境設定 | `npm run build` |
| `.env.development` | 開発環境設定 | `npm run dev` / `npm run build:dev` |
| `.env.local` | ローカル上書き用（Git追跡外） | 常に読み込み |

### 環境変数一覧

| 変数名 | 説明 | 本番 | 開発 |
|--------|------|------|------|
| `VITE_ENV` | 環境識別 | `production` | `development` |
| `VITE_BASE` | ベースパス | `/` | `/dev/` |
| `VITE_FIREBASE_API_KEY` | Firebase APIキー | 本番用 | 開発用 |
| `VITE_FIREBASE_AUTH_DOMAIN` | 認証ドメイン | 本番用 | 開発用 |
| `VITE_FIREBASE_PROJECT_ID` | プロジェクトID | 本番用 | 開発用 |
| `VITE_CLOUD_FUNCTIONS_BASE_URL` | CF URL | 本番用 | 開発用 |
| `VITE_GA_PROPERTY_ID` | GA4プロパティID | 共通 | 共通 |
| `VITE_GAS_API_URL` | GAS API URL | 共通 | 共通 |

---

## アーキテクチャ図

```
┌──────────────────────────────────────────────────────────────────┐
│                         クライアント                              │
│                    (GitHub Pages / Browser)                      │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                      フロントエンド (Vite)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   求人検索   │  │   管理画面   │  │  採用ページ  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└──────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Firebase Auth  │  │    Firestore    │  │   Cloudinary    │
│   (認証)        │  │   (データ)      │  │   (画像)        │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Cloud Functions │
                    │  (バックエンド)  │
                    └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
          ┌─────────────────┐  ┌─────────────────┐
          │   SendGrid      │  │   GAS (GSheet)  │
          │   (メール)       │  │   (スプシ連携)   │
          └─────────────────┘  └─────────────────┘
```

---

## Firestore コレクション構造

```
firestore/
├── admin_users/           # 管理者 (docId = Firebase Auth UID)
│   └── {uid}/
│       ├── email
│       ├── role: "admin"
│       └── companyDomain: null
│
├── company_users/         # 企業ユーザー (docId = Firebase Auth UID)
│   └── {uid}/
│       ├── email
│       ├── role: "company"
│       └── companyDomain
│
├── companies/             # 企業情報
│   └── {companyDomain}/
│       ├── name
│       ├── logoUrl
│       │
│       ├── jobs/          # サブコレクション: 求人
│       │   └── {jobId}/
│       │
│       ├── assignees/     # サブコレクション: 担当者
│       │   └── {assigneeId}/
│       │
│       └── lpSettings/    # サブコレクション: LP設定
│           └── {settingsId}/
│
├── applications/          # 応募データ
├── pageviews/            # ページビュー
├── page_analytics_events/ # アナリティクスイベント
└── page_analytics_daily/  # 日次集計
    └── {dateStr}/
        └── stats/
```

---

## コマンド一覧

### 開発

```bash
# 開発サーバー起動（開発環境）
npm run dev

# ビルド（本番環境）
npm run build

# ビルド（開発環境）
npm run build:dev

# プレビュー
npm run preview
```

### Cloud Functions デプロイ

```bash
# 本番環境
cd functions
firebase deploy --only functions --project generated-area-484613-e3-90bd4

# 開発環境
cd functions
./deploy-dev.sh
```

### 管理者追加

```bash
cd functions

# 本番環境
node add-admin.cjs user@example.com --prod

# 開発環境
node add-admin.cjs user@example.com --dev
```

### データ移行

```bash
# admin_users を UID ベースに移行
cd functions
node ../scripts/migrate-admin-users-to-uid.cjs --prod  # 本番
node ../scripts/migrate-admin-users-to-uid.cjs --dev   # 開発

# Cloudinary 画像を prod/ に移動
CLOUDINARY_API_KEY=xxx CLOUDINARY_API_SECRET=yyy \
  node scripts/migrate-cloudinary-to-prod.cjs
```

---

## 環境判定ロジック

```javascript
// src/shared/env-config.js
export const isDevelopment = import.meta.env.VITE_ENV === 'development';
export const isProduction = import.meta.env.VITE_ENV === 'production';
```

### 使用例

```javascript
import { isDevelopment } from '@shared/env-config';

// Cloudinary フォルダプレフィックス
const ENV_PREFIX = isDevelopment ? 'dev' : 'prod';
const folder = `${ENV_PREFIX}/companies/${companyDomain}`;
```

---

## 注意事項

### Firebase Project ID の違い
- **本番**: `generated-area-484613-e3-90bd4`（GCP自動生成名）
- **開発**: `lset-dev`（明示的に作成）

### Cloud Functions URL の違い
- **本番**: `-e3` で終わる（プロジェクト名の一部が省略される）
- **開発**: 完全なプロジェクト名が使用される

### Cloudinary は共通
- 同じアカウントを使用し、フォルダで環境を分離
- `prod/` と `dev/` プレフィックスで区別

### GAS / Spreadsheet は共通
- 現時点では本番・開発で同じスプレッドシートを使用
- 必要に応じて分離を検討

---

## 関連ファイル

- [.env.development](../.env.development) - 開発環境設定
- [.env.production](../.env.production) - 本番環境設定
- [src/shared/env-config.js](../src/shared/env-config.js) - 環境設定モジュール
- [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) - CI/CD設定
- [functions/add-admin.cjs](../functions/add-admin.cjs) - 管理者追加スクリプト
- [functions/deploy-dev.sh](../functions/deploy-dev.sh) - 開発環境デプロイスクリプト
