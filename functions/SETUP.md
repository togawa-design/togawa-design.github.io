# Google Cloud Functions セットアップガイド

## 1. 前提条件

- Google Cloud SDK (gcloud) がインストールされていること
- Google Cloud プロジェクトが作成済みであること
- 課金が有効になっていること

## 2. Google Cloud プロジェクトの設定

```bash
# プロジェクトIDを設定
gcloud config set project YOUR_PROJECT_ID

# 必要なAPIを有効化
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable analyticsdata.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

## 3. GA4プロパティIDの確認

1. Google Analytics にログイン
2. 管理 > プロパティ設定 を開く
3. プロパティID（数字のみ）をメモ（例: 469598925）

## 4. サービスアカウントの設定

### 4.1 サービスアカウントの作成

```bash
# サービスアカウントを作成
gcloud iam service-accounts create rikueco-analytics \
  --display-name="Rikueco Analytics Service Account"

# プロジェクトIDを取得
PROJECT_ID=$(gcloud config get-value project)

# サービスアカウントのメールアドレスを取得
SA_EMAIL="rikueco-analytics@${PROJECT_ID}.iam.gserviceaccount.com"
echo $SA_EMAIL
```

### 4.2 GA4にサービスアカウントを追加

1. Google Analytics にログイン
2. 管理 > プロパティ > プロパティのアクセス管理
3. 「+」をクリックして「ユーザーを追加」
4. サービスアカウントのメールアドレスを入力
5. 役割は「閲覧者」を選択
6. 保存

## 5. Cloud Functionsのデプロイ

```bash
cd functions

# 依存関係をインストール（ローカルテスト用）
npm install

# デプロイ
gcloud functions deploy getAnalyticsData \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --region asia-northeast1 \
  --set-env-vars GA4_PROPERTY_ID=469598925 \
  --service-account=rikueco-analytics@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

## 6. デプロイ後の確認

デプロイが完了すると、以下のようなURLが表示されます：

```
https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/getAnalyticsData
```

### テスト

```bash
# 概要データを取得
curl "https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/getAnalyticsData?type=overview&days=30"

# 企業別データを取得
curl "https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/getAnalyticsData?type=companies&days=30"
```

## 7. 管理者ダッシュボードの設定

デプロイ後、`js/admin.js` の `config.apiEndpoint` にCloud FunctionsのURLを設定してください：

```javascript
config: {
  apiEndpoint: 'https://asia-northeast1-YOUR_PROJECT_ID.cloudfunctions.net/getAnalyticsData',
  // ...
}
```

## トラブルシューティング

### エラー: Permission denied

サービスアカウントがGA4プロパティにアクセス権限を持っていない可能性があります。
GA4の管理画面でサービスアカウントが「閲覧者」として追加されているか確認してください。

### エラー: API not enabled

Analytics Data APIが有効になっていない可能性があります：

```bash
gcloud services enable analyticsdata.googleapis.com
```

### CORS エラー

`index.js` の `corsHandler` の `origin` 配列に、アクセス元のドメインを追加してください。
