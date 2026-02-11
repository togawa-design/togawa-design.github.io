# GitHub Pages カスタムドメイン設定手順

## 概要

GitHub Pages（togawa-design.github.io）をカスタムドメインに移行するための手順書。

---

## 1. お名前.com DNS設定

### Apexドメイン（example.com）を使う場合

DNS設定画面で以下のAレコードを追加:

| ホスト名 | TYPE | TTL | VALUE |
|---------|------|-----|-------|
| (空白) | A | 3600 | 185.199.108.153 |
| (空白) | A | 3600 | 185.199.109.153 |
| (空白) | A | 3600 | 185.199.110.153 |
| (空白) | A | 3600 | 185.199.111.153 |

### サブドメイン（www.example.com）を使う場合

| ホスト名 | TYPE | TTL | VALUE |
|---------|------|-----|-------|
| www | CNAME | 3600 | togawa-design.github.io |

### 両方使う場合（推奨）

上記のAレコード4つ + CNAMEレコード1つを全て追加。

---

## 2. GitHub リポジトリ設定

1. リポジトリの **Settings** → **Pages** を開く
2. **Custom domain** 欄にドメインを入力（例: `example.com`）
3. **Save** をクリック
4. DNS確認が完了するまで待つ（数分〜最大48時間）
5. **Enforce HTTPS** にチェックを入れる（DNS確認後に有効化可能）

---

## 3. CNAMEファイルの追加

### 方法A: GitHub Actions で自動追加（推奨）

`.github/workflows/deploy.yml` を編集:

```yaml
# 107行目付近の「# .nojekyll ファイルを作成」の後に追加
          # CNAME ファイルを作成（カスタムドメイン用）
          echo "YOUR-DOMAIN.com" > CNAME
```

### 方法B: 手動で追加

gh-pages ブランチのルートに `CNAME` ファイルを作成:

```
YOUR-DOMAIN.com
```

---

## 4. Firebase Authentication 承認済みドメイン追加

### 設定場所

Firebase Console:
https://console.firebase.google.com/project/generated-area-484613-e3-90bd4/authentication/settings

### 手順

1. **Authentication** → **Settings** → **承認済みドメイン** を開く
2. **ドメインを追加** をクリック
3. カスタムドメインを入力（例: `example.com`）
4. 保存

---

## 5. Cloud Functions CORS設定更新

### 修正ファイル

`functions/index.js`

### 修正箇所1: corsHandler（21行目付近）

```javascript
const corsHandler = cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
    'http://localhost:5500',
    'http://localhost:5502',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3003',
    'http://127.0.0.1:3004',
    'http://127.0.0.1:3005',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5502',
    'https://togawa-design.github.io',
    'https://YOUR-DOMAIN.com',      // ← 追加
    'https://www.YOUR-DOMAIN.com'   // ← 追加
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
});
```

### 修正箇所2: legacyLogin の allowedOrigins（3608行目付近）

```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
  'http://127.0.0.1:3000',
  'https://togawa-design.github.io',
  'https://YOUR-DOMAIN.com',      // ← 追加
  'https://www.YOUR-DOMAIN.com'   // ← 追加
];
```

### デプロイ

```bash
cd functions

# 全関数をデプロイ（時間がかかる）
npm run deploy
npm run deploy:auth
npm run deploy:sendEmail
npm run deploy:calendar

# または個別にデプロイ
gcloud functions deploy <関数名> --gen2 --runtime nodejs20 --trigger-http --allow-unauthenticated --region asia-northeast1 --project generated-area-484613-e3
```

---

## 6. OAuth コールバックURL更新

### 修正ファイル

`functions/index.js`

### 修正箇所（2600行目、2731行目付近）

```javascript
// 変更前
const frontendRedirectUri = process.env.FRONTEND_CALLBACK_URL || 'https://togawa-design.github.io/oauth-callback.html';

// 変更後
const frontendRedirectUri = process.env.FRONTEND_CALLBACK_URL || 'https://YOUR-DOMAIN.com/oauth-callback.html';
```

### または環境変数で設定

デプロイ時に環境変数を設定:

```bash
gcloud functions deploy initiateCalendarAuth \
  --set-env-vars FRONTEND_CALLBACK_URL=https://YOUR-DOMAIN.com/oauth-callback.html \
  ...
```

---

## 7. Google Cloud Console OAuth設定

### 設定場所

Google Cloud Console:
https://console.cloud.google.com/apis/credentials?project=generated-area-484613-e3

### 手順

1. **APIとサービス** → **認証情報** を開く
2. OAuth 2.0 クライアントID をクリック
3. **承認済みの JavaScript 生成元** に追加:
   - `https://YOUR-DOMAIN.com`
   - `https://www.YOUR-DOMAIN.com`
4. **承認済みのリダイレクト URI** に追加:
   - `https://YOUR-DOMAIN.com/oauth-callback.html`
5. 保存

---

## 作業順序チェックリスト

| # | 作業 | 状態 | 備考 |
|---|------|------|------|
| 1 | お名前.com DNS設定 | [ ] | Aレコード4つ + CNAME |
| 2 | GitHub Pages カスタムドメイン設定 | [ ] | Settings → Pages |
| 3 | CNAME ファイル追加 | [ ] | deploy.yml または手動 |
| 4 | Firebase 承認済みドメイン追加 | [ ] | Authentication設定 |
| 5 | Cloud Functions CORS更新 | [ ] | index.js 2箇所 |
| 6 | Cloud Functions デプロイ | [ ] | npm run deploy:* |
| 7 | OAuth コールバックURL更新 | [ ] | index.js 2箇所 |
| 8 | Google Cloud OAuth設定 | [ ] | 認証情報 |
| 9 | DNS浸透確認 | [ ] | dig コマンド |
| 10 | HTTPS有効化確認 | [ ] | GitHub Pages設定 |
| 11 | 動作確認 | [ ] | ログイン、API呼び出し |

---

## 確認コマンド

### DNS浸透確認

```bash
# Aレコード確認
dig YOUR-DOMAIN.com +short

# 期待する出力
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153

# CNAME確認
dig www.YOUR-DOMAIN.com +short
```

### HTTPSアクセス確認

```bash
curl -I https://YOUR-DOMAIN.com
```

---

## トラブルシューティング

### DNS浸透に時間がかかる

- 最大48時間かかることがある
- 急ぐ場合はTTLを短く設定（300秒など）

### HTTPS証明書エラー

- DNS確認完了後、GitHub側で証明書が自動発行される
- 数分〜数十分かかる場合がある

### CORSエラー

- Cloud Functionsのデプロイ忘れがないか確認
- ブラウザのキャッシュをクリア

### Googleログインできない

- Firebase Authentication の承認済みドメインを確認
- Google Cloud Console の OAuth設定を確認

---

## 置換リスト

ドメイン決定後、以下を一括置換:

| 検索文字列 | 置換後 |
|-----------|--------|
| `YOUR-DOMAIN.com` | 実際のドメイン |
| `togawa-design.github.io` | 実際のドメイン（必要に応じて残す） |

---

## 関連ドキュメント

- [GitHub Pages カスタムドメイン設定](https://docs.github.com/ja/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [Firebase Authentication 承認済みドメイン](https://firebase.google.com/docs/auth/web/google-signin)
