# 環境設定ガイド

## 概要

本プロジェクトはViteの環境変数機能を使用して、開発環境と本番環境を切り替えます。

---

## 環境構成

| 環境 | ブランチ | URL | 環境変数ファイル |
|------|---------|-----|-----------------|
| 本番 | main | `https://togawa-design.github.io/` | `.env.production` |
| 開発 | develop | `https://togawa-design.github.io/dev/` | `.env.development` |
| ローカル | - | `http://localhost:3000/` | `.env.development` |

---

## 環境変数ファイル

### .env.development（開発環境）

ローカル開発 (`npm run dev`) 時に自動で読み込まれます。

```bash
VITE_ENV=development
VITE_BASE=/dev/
```

### .env.production（本番環境）

ビルド (`npm run build`) 時に自動で読み込まれます。

```bash
VITE_ENV=production
VITE_BASE=/
```

### .env.local（ローカル上書き用）

個人の設定を上書きしたい場合に作成します。Gitで追跡されません。

```bash
# .env.example をコピーして作成
cp .env.example .env.local
```

---

## 環境変数一覧

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `VITE_ENV` | 環境識別（development/production） | 自動判定 |
| `VITE_BASE` | ベースパス | `/` |
| `VITE_FIREBASE_API_KEY` | Firebase APIキー | ハードコード値 |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase認証ドメイン | ハードコード値 |
| `VITE_FIREBASE_PROJECT_ID` | FirebaseプロジェクトID | ハードコード値 |
| `VITE_CLOUD_FUNCTIONS_BASE_URL` | Cloud Functions URL | ハードコード値 |
| `VITE_GA_PROPERTY_ID` | GA4プロパティID | `G-E1XC94EG05` |
| `VITE_GA_API_KEY` | GA APIキー | ハードコード値 |
| `VITE_GAS_API_URL` | GAS API URL | ハードコード値 |
| `VITE_SPREADSHEET_ID` | スプレッドシートID | ハードコード値 |

---

## コードでの使用方法

### 環境設定のインポート

```javascript
import { envConfig, apiEndpoints, firebaseConfig } from '@shared/env-config.js';

// 環境チェック
if (envConfig.isDevelopment) {
  console.log('開発環境で実行中');
}

// API呼び出し
const response = await fetch(apiEndpoints.analytics);

// Firebase初期化
firebase.initializeApp(firebaseConfig);
```

### 利用可能なエクスポート

```javascript
// 個別エクスポート
import {
  isDevelopment,      // boolean: 開発環境かどうか
  isProduction,       // boolean: 本番環境かどうか
  firebaseConfig,     // Firebase設定オブジェクト
  cloudFunctionsBaseUrl,  // Cloud Functions URL
  gaConfig,           // GA設定
  gasConfig,          // GAS設定
  apiEndpoints        // 全APIエンドポイント
} from '@shared/env-config.js';

// まとめてエクスポート
import { envConfig } from '@shared/env-config.js';
// envConfig.isDevelopment
// envConfig.firebase
// envConfig.api.analytics
```

---

## GitHub Actions での環境変数

### 自動設定（現在の構成）

```yaml
env:
  VITE_ENV: ${{ github.ref_name == 'main' && 'production' || 'development' }}
  VITE_BASE: ${{ github.ref_name == 'main' && '/' || '/dev/' }}
```

### GitHub Secretsを使う場合（オプション）

機密情報をSecretに移行する場合:

1. リポジトリ Settings → Secrets → Actions で設定
2. deploy.yml でコメントアウトを解除:

```yaml
env:
  VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
  VITE_CLOUD_FUNCTIONS_BASE_URL: ${{ secrets.VITE_CLOUD_FUNCTIONS_BASE_URL }}
```

---

## カスタムドメイン対応

カスタムドメインを設定する場合、以下の環境変数を更新:

```bash
# .env.production
VITE_CLOUD_FUNCTIONS_BASE_URL=https://asia-northeast1-generated-area-484613-e3.cloudfunctions.net
```

詳細は [custom-domain-setup.md](./custom-domain-setup.md) を参照。

---

## ローカル開発

```bash
# 開発サーバー起動（.env.development を使用）
npm run dev

# 本番ビルド（.env.production を使用）
npm run build

# ビルド結果をプレビュー
npm run preview
```

---

## トラブルシューティング

### 環境変数が反映されない

1. Vite開発サーバーを再起動
2. ブラウザキャッシュをクリア
3. 変数名が `VITE_` で始まっているか確認

### 本番と開発で異なる設定を使いたい

`.env.development` と `.env.production` で異なる値を設定。

```bash
# .env.development
VITE_DEBUG=true

# .env.production
VITE_DEBUG=false
```

---

## 関連ファイル

- [.env.development](../.env.development) - 開発環境設定
- [.env.production](../.env.production) - 本番環境設定
- [.env.example](../.env.example) - 設定テンプレート
- [src/shared/env-config.js](../src/shared/env-config.js) - 環境設定モジュール
- [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) - CI/CD設定
