# 環境構築手順

## 概要
本プロジェクトは求人情報サイト（リクエコ）のフロントエンド・バックエンドを含む統合プロジェクトです。

## 必要環境

### システム要件
- Node.js: v18以上
- npm: v9以上
- Git

### 外部サービス
- **Firebase**: Firestore, Authentication, Functions, Hosting
- **Cloudinary**: 画像ホスティング
- **Google Apps Script (GAS)**: 一部バックエンド処理（移行中）

---

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone git@github.com:togawa-design/togawa-design.github.io.git kikanko
cd kikanko
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. Firebase CLIのインストール（未インストールの場合）

```bash
npm install -g firebase-tools
firebase login
```

### 4. Firebase プロジェクトの接続

```bash
firebase use generated-area-484613-e3-90bd4
```

---

## 開発サーバーの起動

### ローカル開発サーバー

```bash
npm run dev
```

ブラウザで http://localhost:3000 が自動的に開きます。

### ビルド

```bash
npm run build
```

`dist/` ディレクトリに出力されます。

### プレビュー（ビルド後の確認）

```bash
npm run preview
```

---

## プロジェクト構成

```
kikanko/
├── src/                    # ソースコード
│   ├── components/         # UIコンポーネント
│   │   ├── atoms/          # 最小単位のコンポーネント
│   │   └── molecules/      # 複合コンポーネント
│   ├── features/           # 機能別モジュール
│   │   ├── admin/          # 管理画面機能
│   │   ├── home/           # トップページ機能
│   │   ├── jobs/           # 求人一覧機能
│   │   ├── lp/             # LP機能
│   │   ├── recruit-settings/ # 採用ページ設定
│   │   └── user-auth/      # ユーザー認証
│   ├── pages/              # ページエントリーポイント
│   └── shared/             # 共通モジュール
├── public/                 # 静的ファイル
│   ├── admin/sections/     # 管理画面セクションHTML
│   ├── css/                # スタイルシート
│   └── images/             # 画像ファイル
├── functions/              # Cloud Functions
├── gas/                    # Google Apps Script
├── dist/                   # ビルド出力
├── firestore.rules         # Firestoreセキュリティルール
├── firestore.indexes.json  # Firestoreインデックス定義
└── vite.config.js          # Vite設定
```

---

## Firebase設定

### Firestoreルールのデプロイ

```bash
firebase deploy --only firestore:rules
```

### Firestoreインデックスのデプロイ

```bash
firebase deploy --only firestore:indexes
```

### Cloud Functionsのデプロイ

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

---

## 環境変数・設定

### Firebase設定
`src/features/admin/config.js` に Firebase プロジェクト設定が記述されています。

```javascript
export const config = {
  firebaseConfig: {
    apiKey: "...",
    authDomain: "...",
    projectId: "generated-area-484613-e3-90bd4",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
  }
};
```

### Cloudinary設定
`src/features/admin/image-uploader.js` に設定されています。

```javascript
const CLOUDINARY_CONFIG = {
  cloudName: 'dnvtqyhuw',
  uploadPreset: 'rikueko_unsigned'
};
```

---

## デプロイ

### GitHub Pages へのデプロイ

```bash
npm run deploy
```

### Firebase Hosting へのデプロイ

```bash
firebase deploy --only hosting
```

---

## トラブルシューティング

### Firebase SDK 読み込みエラー
各HTMLファイルに以下のスクリプトタグが必要です：

```html
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
```

### Firestoreインデックスエラー
コンソールに表示されるリンクからインデックスを作成するか、以下を実行：

```bash
firebase deploy --only firestore:indexes
```

### CORS エラー
ローカル開発では `npm run dev` で起動したVite開発サーバーを使用してください。

---

## 関連ドキュメント
- [画面遷移図](./screen-flow.md)
- [詳細設計書](./detailed-design.md)
- [Firestore DB構成図](./firestore-schema.md)
