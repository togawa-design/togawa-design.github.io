# セキュリティ対策が必要な箇所

## 対応済み

### パスワードの平文保存
- **ファイル**: `functions/index.js`, `src/features/admin/auth.js`
- **対応内容**: bcryptでハッシュ化するよう修正済み

### XSS脆弱性（innerHTML直接代入）
- **対応内容**: escapeHtml関数でエスケープ処理を追加
- **修正ファイル**:
  - `src/features/admin/index.js:2031` - user.id, user.emailをエスケープ
  - `src/features/admin/analytics.js:1787` - app.typeをエスケープ
  - `src/features/admin/job-manage-embedded.js:2308` - meetingTypeをエスケープ
  - `src/features/admin/announcements.js:106,116,122` - announcement.idをエスケープ

---

### 2. sessionStorageへの認証情報保存

**優先度**: 高

**該当箇所**:
| ファイル | 行番号 | 保存内容 |
|----------|--------|----------|
| `src/features/admin/auth.js` | 70-130 | userRole, companyDomain |
| `src/features/admin/auth.js` | 254-259 | pending_auth（email, uid, companies） |
| `src/features/admin/auth.js` | 365-370 | available_companies |

**問題**: 認証情報がsessionStorageに平文で保存されている。XSS攻撃でJavaScriptが注入された場合、これらの情報が窃取される。

**対策案**:
- メモリ内のみで保持する（グローバル変数やクロージャ）
- HTTPOnly Cookieを使用する（サーバーサイドで設定）
- 最低限必要な情報のみ保存し、sensitive情報は保存しない

---

### 3. CORS設定に開発用オリジンが含まれる

**優先度**: 中

**該当箇所**: `functions/index.js` 30-48行目

**問題**: 本番環境のCloud Functionsに`localhost:3000`など開発用オリジンが許可されている。

```javascript
const corsHandler = cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    // ... 多数のlocalhostポート
  ]
});
```

**対策案**:
- 環境変数で本番/開発を切り替える
- 本番デプロイ時は開発用オリジンを除外する

---

### 4. APIパラメータのバリデーション不足

**優先度**: 中

**該当箇所**:
| ファイル | 行番号 | パラメータ |
|----------|--------|-----------|
| `functions/email.js` | 269-281 | `limit`パラメータ |

**問題**: `limit`パラメータを`parseInt()`で処理しているが、負の値や極端に大きな値のバリデーションがない。

```javascript
.limit(parseInt(limit)); // バリデーションなし
```

**対策案**:
```javascript
const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
```

---

### 5. Firestoreセキュリティルールの確認

**優先度**: 高

**確認が必要な項目**:
- `company_users`コレクションへの書き込み権限
- 他社のデータへのアクセス制御
- 管理者権限の検証

**確認方法**:
1. Firebase Console → Firestore → ルール
2. 各コレクションのread/write条件を確認
3. テストツールでルールを検証

---

### 6. Cloud Functions認証の強化

**優先度**: 中

**該当箇所**: `functions/index.js` の各エンドポイント

**問題**: 一部のエンドポイントが`--allow-unauthenticated`でデプロイされている。

**対策案**:
- Firebase ID Tokenの検証を追加
- 管理者用APIは`admin.auth().verifyIdToken()`で検証
- Rate Limitingの導入を検討

```javascript
// 例: ID Token検証
const idToken = req.headers.authorization?.split('Bearer ')[1];
const decodedToken = await admin.auth().verifyIdToken(idToken);
```

---

## Firestoreセキュリティルール推奨設定

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // company_users: 自分のドキュメントのみ読み書き可能
    match /company_users/{userId} {
      allow read: if request.auth != null &&
        (request.auth.uid == resource.data.uid ||
         isCompanyAdmin(resource.data.companyDomain));
      allow write: if request.auth != null &&
        isCompanyAdmin(resource.data.companyDomain);
    }

    // ヘルパー関数
    function isCompanyAdmin(companyDomain) {
      return get(/databases/$(database)/documents/company_users/$(request.auth.uid)).data.role == 'admin'
        && get(/databases/$(database)/documents/company_users/$(request.auth.uid)).data.companyDomain == companyDomain;
    }
  }
}
```

---

## チェックリスト

- [x] パスワードハッシュ化（bcrypt）
- [x] XSS対策（escapeHtml追加）
- [ ] sessionStorage → メモリ保持に変更
- [ ] CORS設定を環境別に分離
- [ ] APIパラメータバリデーション追加
- [ ] Firestoreセキュリティルール確認・更新
- [ ] Cloud Functions認証強化
