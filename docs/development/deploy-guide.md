# デプロイ手順書

## 概要

本システムのデプロイ手順を記載する。

---

## 前提条件

### 必要なツール

```bash
# Google Cloud SDK
gcloud --version

# Node.js 22
node --version

# Git
git --version
```

### 認証設定

```bash
# GCPにログイン
gcloud auth login

# プロジェクト設定（本番）
gcloud config set project generated-area-484613-e3

# プロジェクト設定（開発）
gcloud config set project lset-dev
```

---

## 環境別設定

| 項目 | 本番環境 | 開発環境 |
|------|---------|---------|
| GCP Project | `generated-area-484613-e3` | `lset-dev` |
| Firebase Project | `generated-area-484613-e3-90bd4` | `lset-dev` |
| GitHub Branch | `main` | `develop` |

---

## フロントエンドデプロイ

### GitHub Pages（自動デプロイ）

`main`ブランチへのプッシュで自動デプロイ。

```bash
# developで開発
git checkout develop
# ... 変更 ...
git add .
git commit -m "feat: 機能追加"
git push origin develop

# mainにマージ
git checkout main
git merge develop
git push origin main  # 自動でGitHub Pagesにデプロイ
```

---

## Cloud Functions デプロイ

### ディレクトリ移動

```bash
cd functions
```

### 依存関係インストール

```bash
npm install
```

### 個別デプロイコマンド

#### アナリティクス系

```bash
# getAnalyticsData（本番）
gcloud functions deploy getAnalyticsData \
  --gen2 \
  --runtime nodejs22 \
  --trigger-http \
  --allow-unauthenticated \
  --region asia-northeast1 \
  --project generated-area-484613-e3

# 開発環境
gcloud functions deploy getAnalyticsData \
  --gen2 \
  --runtime nodejs22 \
  --trigger-http \
  --allow-unauthenticated \
  --region asia-northeast1 \
  --project lset-dev \
  --set-env-vars FIREBASE_PROJECT_ID=lset-dev,GA4_PROPERTY_ID=524526933
```

#### 認証系

```bash
# legacyLogin（本番）
gcloud functions deploy legacyLogin \
  --no-gen2 \
  --runtime nodejs22 \
  --trigger-http \
  --allow-unauthenticated \
  --region asia-northeast1 \
  --project generated-area-484613-e3

# resetLegacyPassword（本番）
gcloud functions deploy resetLegacyPassword \
  --no-gen2 \
  --runtime nodejs22 \
  --trigger-http \
  --allow-unauthenticated \
  --region asia-northeast1 \
  --project generated-area-484613-e3

# IAMポリシー追加（初回のみ）
gcloud functions add-iam-policy-binding resetLegacyPassword \
  --region=asia-northeast1 \
  --member=allUsers \
  --role=roles/cloudfunctions.invoker \
  --project generated-area-484613-e3
```

#### ユーザー管理系

```bash
# 一括デプロイ
npm run deploy:auth
```

#### メール系

```bash
# sendEmail
gcloud functions deploy sendEmail \
  --gen2 \
  --runtime nodejs22 \
  --trigger-http \
  --allow-unauthenticated \
  --region asia-northeast1 \
  --project generated-area-484613-e3 \
  --set-env-vars SENDGRID_API_KEY=$SENDGRID_API_KEY
```

#### カレンダー系

```bash
# 一括デプロイ
npm run deploy:calendar
```

### npm scripts 一覧

| コマンド | 説明 |
|---------|------|
| `npm run deploy` | getAnalyticsData |
| `npm run deploy:sendEmail` | sendEmail |
| `npm run deploy:auth` | 認証系一括 |
| `npm run deploy:calendar` | カレンダー系一括 |
| `npm run deploy:salary` | 給与データ系一括 |

---

## 環境変数

### 本番環境で必要な環境変数

| 変数名 | 設定場所 | 説明 |
|--------|---------|------|
| `SENDGRID_API_KEY` | sendEmail | SendGrid APIキー |
| `GOOGLE_CLIENT_ID` | Calendar系 | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Calendar系 | Google OAuth Client Secret |
| `GA4_PROPERTY_ID` | getAnalyticsData | GA4プロパティID |
| `FIREBASE_PROJECT_ID` | 全般 | FirebaseプロジェクトID |

### 環境変数の設定方法

```bash
# デプロイ時に設定
gcloud functions deploy functionName \
  --set-env-vars KEY1=value1,KEY2=value2

# 既存関数の環境変数更新
gcloud functions deploy functionName \
  --update-env-vars KEY1=new_value
```

---

## デプロイ確認

### Cloud Functions 確認

```bash
# 関数一覧
gcloud functions list --project generated-area-484613-e3

# 特定関数の詳細
gcloud functions describe getAnalyticsData \
  --region asia-northeast1 \
  --project generated-area-484613-e3

# ログ確認
gcloud functions logs read getAnalyticsData \
  --region asia-northeast1 \
  --project generated-area-484613-e3 \
  --limit 50
```

### ヘルスチェック

```bash
curl https://asia-northeast1-generated-area-484613-e3.cloudfunctions.net/health
```

---

## ロールバック

### Cloud Functions

```bash
# 前のバージョンを確認
gcloud functions versions list getAnalyticsData \
  --region asia-northeast1 \
  --project generated-area-484613-e3

# 特定バージョンにロールバック（再デプロイ）
# ※ Gitで該当コミットをチェックアウトして再デプロイ
git checkout <commit_hash>
npm run deploy
```

### フロントエンド

```bash
# Gitで前のコミットにリバート
git revert HEAD
git push origin main
```

---

## トラブルシューティング

### デプロイ失敗時

1. ログを確認
```bash
gcloud functions logs read functionName --limit 100
```

2. Cloud Build ログを確認
   - GCPコンソール → Cloud Build → 履歴

3. 権限エラーの場合
```bash
gcloud auth login
gcloud config set project <project_id>
```

### IAMエラー

```bash
# allUsersにinvoker権限を付与
gcloud functions add-iam-policy-binding functionName \
  --region=asia-northeast1 \
  --member=allUsers \
  --role=roles/cloudfunctions.invoker
```

---

## チェックリスト

### デプロイ前

- [ ] ローカルでテスト完了
- [ ] developブランチで動作確認
- [ ] 環境変数の確認
- [ ] 依存関係の更新（npm install）

### デプロイ後

- [ ] ヘルスチェック確認
- [ ] 主要機能の動作確認
- [ ] ログにエラーがないこと確認
- [ ] 本番環境でのE2Eテスト
