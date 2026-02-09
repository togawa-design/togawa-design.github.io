# Cloud Functions

## プロジェクト構成

このシステムは2つのGCPプロジェクトを使用しています：

| プロジェクト | 用途 | プロジェクトID |
|-------------|------|----------------|
| **Cloud Functions** | API実行環境 | `generated-area-484613-e3` |
| **Firebase** | 認証・データベース | `generated-area-484613-e3-90bd4` |

### 重要な注意事項

- Cloud Functions は `generated-area-484613-e3` にデプロイ
- Firebase Admin SDK は `generated-area-484613-e3-90bd4` のFirestoreとAuthにアクセス
- **クロスプロジェクトアクセス**のため、サービスアカウントに権限付与が必要

### 必要な権限設定

Cloud Functions のサービスアカウント `525806321839-compute@developer.gserviceaccount.com` に、
Firebase プロジェクト (`generated-area-484613-e3-90bd4`) で以下のロールを付与：

- `Firebase Authentication 管理者`
- `Service Usage ユーザー` (serviceusage.services.use)
- `Cloud Datastore ユーザー` (Firestore アクセス用)

設定URL: https://console.cloud.google.com/iam-admin/iam?project=generated-area-484613-e3-90bd4

---

## 関数一覧

### 認証系 (Firebase Auth 操作)

| 関数名 | 用途 | 呼び出し元 | 認証 |
|--------|------|-----------|------|
| `createCompanyUser` | 会社ユーザー作成 | 管理者 | Admin Token |
| `createCompanyStaff` | 会社スタッフ作成 | 会社ユーザー | Company User Token |
| `deleteCompanyUser` | 会社ユーザー削除 | 管理者 | Admin Token |
| `migrateCompanyUsersToFirebaseAuth` | レガシーユーザー移行 | 管理者 | Admin Token |
| `legacyLogin` | レガシー認証 (非推奨) | フロントエンド | なし |

### アナリティクス系

| 関数名 | 用途 | 呼び出し元 | 認証 |
|--------|------|-----------|------|
| `getAnalyticsData` | GA4データ取得 | 管理画面 | オプション |

### メール系

| 関数名 | 用途 | 呼び出し元 | 認証 |
|--------|------|-----------|------|
| `sendEmail` | メール送信 (SendGrid) | フロントエンド | なし |
| `inboundParse` | 受信メール処理 | SendGrid Webhook | なし |
| `getEmails` | メール一覧取得 | 管理画面 | オプション |

### カレンダー系

| 関数名 | 用途 |
|--------|------|
| `initiateCalendarAuth` | Google Calendar OAuth開始 |
| `calendarOAuthCallback` | OAuth コールバック |
| `getCalendarAvailability` | 空き時間取得 |
| `createCalendarEvent` | 予定作成 |
| `getCalendarIntegration` | 連携状態取得 |
| `revokeCalendarAuth` | 連携解除 |

---

## デプロイ方法

### 前提条件

```bash
# gcloud CLIにログイン
gcloud auth login

# プロジェクト設定
gcloud config set project generated-area-484613-e3
```

### 個別デプロイ

```bash
cd functions

# 認証系
npm run deploy:createCompanyUser
npm run deploy:deleteCompanyUser
npm run deploy:migrateCompanyUsers
npm run deploy:legacyLogin

# 認証系まとめてデプロイ
npm run deploy:auth

# その他
npm run deploy              # getAnalyticsData
npm run deploy:sendEmail
npm run deploy:calendar     # カレンダー系全部
```

### 手動デプロイ (Gen2)

```bash
gcloud functions deploy <関数名> \
  --gen2 \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --region asia-northeast1 \
  --project generated-area-484613-e3
```

### 手動デプロイ (Gen1) - カレンダー系など

```bash
gcloud functions deploy <関数名> \
  --no-gen2 \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --region asia-northeast1 \
  --project generated-area-484613-e3
```

---

## エンドポイント

ベースURL: `https://asia-northeast1-generated-area-484613-e3.cloudfunctions.net`

| 関数 | URL |
|------|-----|
| createCompanyUser | `/createCompanyUser` |
| createCompanyStaff | `/createCompanyStaff` |
| deleteCompanyUser | `/deleteCompanyUser` |
| legacyLogin | `/legacyLogin` |
| getAnalyticsData | `/getAnalyticsData` |

---

## ローカル開発

```bash
cd functions
npm install

# 特定の関数をローカルで起動
npm start                    # getAnalyticsData (port 8080)
npm run start:email          # sendEmail (port 8081)
```

---

## トラブルシューティング

### CORS エラー

`corsHandler` の `origin` 配列に許可するオリジンが含まれているか確認。
開発時は `http://localhost:3000` など。

### 権限エラー (403 / PERMISSION_DENIED)

Firebase プロジェクトのIAMで、Cloud Functions のサービスアカウントに適切なロールが付与されているか確認。

### Firebase Auth エラー

`admin.initializeApp()` の `projectId` が正しいか確認（`generated-area-484613-e3-90bd4`）。
