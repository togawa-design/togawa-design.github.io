# Twilio SMS連絡機能 実装計画

## 概要

応募者とSMSで連絡を取れる双方向SMS機能をTwilioを使って実装します。

### 機能要件

- 応募受付確認の自動SMS送信
- 面接日程通知
- 管理画面からの手動SMS送信
- 応募者からの返信SMS受信

---

## データモデル設計

### 既存の`messages`コレクションを拡張（新規コレクション作成不要）

```javascript
{
  // 既存フィールド
  applicationId: string,
  companyDomain: string,
  from: 'company' | 'applicant',
  content: string,
  read: boolean,
  createdAt: timestamp,

  // 新規フィールド（SMS対応）
  channel: 'app' | 'sms' | 'email',  // デフォルト: 'app'
  smsStatus: 'pending' | 'sent' | 'delivered' | 'failed' | 'received',
  twilioSid: string,
  phoneNumber: string,  // E.164形式
  errorCode: string,
  errorMessage: string
}
```

---

## 実装フェーズ

### Phase 1: インフラストラクチャ設定

**変更ファイル:**

- `/functions/package.json` - Twilio SDK追加

**作業内容:**

1. Twilioアカウント設定・日本の電話番号購入（+81）
2. `twilio` パッケージをfunctionsに追加
3. 環境変数設定（TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER）

---

### Phase 2: SMS送信Cloud Function

**変更ファイル:**

- `/functions/index.js`

**実装するエンドポイント:**

1. **`sendSms`** - SMS送信API
   - 認証チェック
   - 電話番号をE.164形式に変換
   - Twilio経由で送信
   - Firestoreにメッセージ保存

2. **`smsStatusCallback`** - 配信ステータス更新Webhook
   - Twilioからの署名検証
   - メッセージステータス更新

```javascript
// 電話番号変換ユーティリティ
function formatJapanesePhoneToE164(phone) {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+81')) return cleaned;
  if (cleaned.startsWith('81')) return '+' + cleaned;
  if (cleaned.startsWith('0')) return '+81' + cleaned.slice(1);
  return '+81' + cleaned;
}
```

---

### Phase 3: SMS受信Cloud Function

**変更ファイル:**

- `/functions/index.js`

**実装するエンドポイント:**

**`twilioWebhook`** - 着信SMS受信

- Twilioリクエスト署名検証
- 送信元電話番号から応募者を特定
- Firestoreにメッセージ保存
- 未知の番号は`unknown_sms`コレクションに保存

---

### Phase 4: 自動SMSトリガー

**変更ファイル:**

- `/functions/index.js`

**Firestoreトリガー:**

1. **`onApplicationCreated`** - 応募作成時
   - 応募受付確認SMSを自動送信
   - 会社設定で無効化可能

2. **`onApplicationStatusChange`** - ステータス変更時
   - `interviewing`ステータスへの変更で面接調整SMS送信

---

### Phase 5: フロントエンド統合

**変更ファイル:**

- `/src/features/applicants/index.js`
- `/job-manage.html`

**実装内容:**

1. **SMSテンプレート追加**

```javascript
const smsTemplates = {
  application_confirmation: {
    subject: '応募受付確認',
    body: `【{companyName}】\n{applicantName}様\n\nご応募ありがとうございます。担当者より改めてご連絡いたします。`
  },
  interview_schedule: {
    subject: '面接日程',
    body: `【{companyName}】\n{applicantName}様\n\n面接日程のご連絡です。\n日時: ◯月◯日 ◯◯:00\n場所: {address}\n\nご確認お願いいたします。`
  },
  interview_reminder: {
    subject: '面接リマインダー',
    body: `【{companyName}】\n{applicantName}様\n\n明日の面接のリマインドです。\n日時: ◯月◯日 ◯◯:00\n持ち物: 履歴書、筆記用具`
  }
};
```

2. **SMS送信UI**
   - チャネル切り替えタブ（アプリ内/SMS）
   - 送信先電話番号表示
   - テンプレート選択
   - 文字数カウント（70文字/1通、最大670文字）

3. **統合タイムライン表示**
   - チャネルバッジ（SMS/アプリ）
   - 配信ステータスバッジ

---

### Phase 6: セキュリティ設定

**変更ファイル:**

- `/firestore.rules`
- `/firestore.indexes.json`

**Firestoreルール:**

```javascript
match /messages/{messageId} {
  // 企業ユーザーは自社のメッセージのみ読み取り可能
  allow read: if request.auth != null && (
    get(/databases/$(database)/documents/company_users/$(request.auth.uid))
      .data.companyDomain == resource.data.companyDomain
  );

  // SMS/メールの作成はCloud Functionsからのみ
  allow create: if request.auth != null &&
    request.resource.data.channel == 'app';
}
```

**インデックス追加:**

```json
{
  "collectionGroup": "messages",
  "fields": [
    { "fieldPath": "twilioSid", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "applications",
  "fields": [
    { "fieldPath": "applicantPhone", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

---

### Phase 7: 会社設定UI

**変更ファイル:**

- `/job-manage.html`
- `/src/features/job-manage/index.js`

**設定項目:**

- 応募受付確認SMS自動送信ON/OFF
- 面接調整SMS自動送信ON/OFF
- SMS署名設定

---

## 修正が必要なファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `/functions/package.json` | twilio SDK追加 |
| `/functions/index.js` | sendSms, twilioWebhook, smsStatusCallback, Firestoreトリガー追加 |
| `/src/features/applicants/index.js` | SMS送信UI、テンプレート、タイムライン表示 |
| `/job-manage.html` | SMS送信フォーム、設定パネルUI |
| `/firestore.rules` | messagesコレクションのルール更新 |
| `/firestore.indexes.json` | SMS用インデックス追加 |

---

## 検証方法

### 1. 機能テスト

- [ ] 管理画面からSMS送信 → 自分の携帯で受信確認
- [ ] 携帯からTwilio番号に返信 → 管理画面に表示確認
- [ ] 新規応募 → 自動確認SMS受信確認
- [ ] ステータス変更 → 自動面接SMSの確認

### 2. 設定確認

- [ ] Twilio ConsoleでWebhook URLが正しく設定されているか
- [ ] Cloud Functionsがデプロイされているか
- [ ] Firestoreルールとインデックスがデプロイされているか

### 3. セキュリティテスト

- [ ] 他社のSMSが見えないことを確認
- [ ] Twilioの署名検証が機能していることを確認

---

## デプロイ手順

### 1. Twilio設定

```bash
# 環境変数設定
gcloud secrets create TWILIO_ACCOUNT_SID --data-file=-
gcloud secrets create TWILIO_AUTH_TOKEN --data-file=-
gcloud secrets create TWILIO_PHONE_NUMBER --data-file=-
```

### 2. Cloud Functionsデプロイ

```bash
cd functions
npm install
gcloud functions deploy sendSms --trigger-http --runtime nodejs20 --region asia-northeast1
gcloud functions deploy twilioWebhook --trigger-http --runtime nodejs20 --region asia-northeast1
gcloud functions deploy smsStatusCallback --trigger-http --runtime nodejs20 --region asia-northeast1
```

### 3. Firestore設定

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 4. Twilio Webhook設定

```
Twilio Console > Phone Numbers > 購入した番号 > Messaging
Webhook URL: https://asia-northeast1-{PROJECT_ID}.cloudfunctions.net/twilioWebhook
```

---

## コスト見積もり

| 項目 | 費用 |
|------|------|
| Twilio日本電話番号 | 約$15/月 |
| 送信SMS（日本） | 約$0.09/通 |
| 受信SMS（日本） | 無料 |

**月間見積もり（100応募、各3通SMS）:**

- 電話番号: $15
- 送信SMS: $0.09 × 300 = $27
- **合計: 約$42/月（約6,000円）**
