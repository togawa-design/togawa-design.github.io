# ユーザー登録・認証フロー

## 概要

このドキュメントでは、管理者ユーザーと会社ユーザーの登録・ログインフローについて説明します。

---

## ユーザータイプ

| タイプ | コレクション | 認証方法 | 権限 |
|--------|--------------|----------|------|
| 管理者ユーザー | `admin_users` | Google認証 | 全会社のデータ閲覧・編集 |
| 会社ユーザー | `company_users` | メール+パスワード | 自社のデータのみ |
| 管理者+会社ユーザー | 両方 | Google認証（共通） | 両方の権限 |

---

## 登録フロー

### ケース1: 管理者ユーザーのみ

管理者が別の管理者を招待するケース。

```mermaid
sequenceDiagram
    autonumber
    participant Admin as 既存管理者
    participant Console as 管理画面
    participant Auth as Firebase Auth
    participant FS as Firestore<br/>(admin_users)
    participant NewUser as 新規管理者

    Note over Admin,FS: Phase 1: 管理者による事前登録
    Admin->>Console: 管理者ユーザー追加<br/>(メールアドレス入力)
    Console->>Auth: getUserByEmail(email)

    alt ユーザーが存在しない
        Auth-->>Console: エラー (user-not-found)
        Console->>Auth: createUser(email)
        Auth-->>Console: userRecord (UID生成)
    else ユーザーが存在する
        Auth-->>Console: userRecord (既存UID)
    end

    Console->>FS: doc('admin_users/{uid}').set({<br/>  email, role: 'admin'<br/>})
    FS-->>Console: 成功
    Console-->>Admin: 登録完了

    Note over NewUser,FS: Phase 2: 新規管理者のログイン
    NewUser->>Console: ログインページアクセス
    NewUser->>Auth: Googleログイン
    Auth-->>Console: credential (UID)

    Console->>FS: doc('admin_users/{uid}').get()
    FS-->>Console: ドキュメント発見
    Console-->>NewUser: ログイン成功（管理者として）
```

**ポイント:**
- パスワード不要（Google認証のため）
- ドキュメントIDはFirebase Auth UIDを使用
- 招待後、新規管理者はGoogleアカウントでログイン

---

### ケース2: 会社ユーザーのみ（新規）

管理者が会社ユーザーを新規作成するケース。

```mermaid
sequenceDiagram
    autonumber
    participant Admin as 管理者
    participant Console as 管理画面
    participant CF as Cloud Function<br/>(createCompanyUser)
    participant Auth as Firebase Auth
    participant FS as Firestore<br/>(company_users)
    participant CompanyUser as 会社ユーザー

    Note over Admin,FS: Phase 1: 管理者による登録
    Admin->>Console: 会社ユーザー追加<br/>(email, password, 会社)
    Console->>CF: createCompanyUser(email, password, companyDomain)

    CF->>Auth: createUser(email, password)
    Auth-->>CF: userRecord (UID生成)

    CF->>FS: doc('company_users/{uid}').set({<br/>  email, companyDomain, role<br/>})
    FS-->>CF: 成功
    CF-->>Console: 成功 (uid)
    Console-->>Admin: 登録完了<br/>（発行情報表示）

    Note over CompanyUser,FS: Phase 2: 会社ユーザーのログイン
    CompanyUser->>Console: ログインページアクセス
    CompanyUser->>Auth: メール+パスワードでログイン
    Auth-->>Console: credential (UID)

    Console->>FS: where('email', '==', email).get()
    FS-->>Console: ドキュメント発見
    Console-->>CompanyUser: ログイン成功（会社ユーザーとして）
```

**ポイント:**
- パスワード必須（8文字以上）
- Cloud Functionがユーザー作成を担当
- 会社ユーザーはメール+パスワードでログイン

---

### ケース3: 管理者ユーザー → 会社ユーザーに追加

既存の管理者を特定の会社にも所属させるケース。

```mermaid
sequenceDiagram
    autonumber
    participant Admin as 管理者
    participant Console as 管理画面
    participant CF as Cloud Function<br/>(createCompanyUser)
    participant Auth as Firebase Auth
    participant FS as Firestore

    Note over Admin,FS: 前提: admin_usersに既に存在
    Admin->>Console: 会社ユーザー追加<br/>(email, パスワード空, 会社)
    Console->>CF: createCompanyUser(email, '', companyDomain)

    CF->>Auth: getUserByEmail(email)
    Auth-->>CF: userRecord (既存UID) ✓

    Note right of CF: Firebase Authに<br/>既に存在するので<br/>パスワード不要

    CF->>FS: doc('company_users/{uid}').set({<br/>  email, companyDomain, role<br/>})
    FS-->>CF: 成功
    CF-->>Console: 成功
    Console-->>Admin: 登録完了

    Note over FS: 結果: 同じUIDで<br/>admin_users ✓<br/>company_users ✓
```

**ポイント:**
- パスワード不要（Firebase Authに既存ユーザーがあるため）
- 既存のUIDを再利用
- ログイン時はGoogle認証で両方の権限を取得

---

### ケース4: 会社ユーザー → 別会社にも追加

既存の会社ユーザーを別の会社にも所属させるケース（複数会社対応）。

```mermaid
sequenceDiagram
    autonumber
    participant Admin as 管理者
    participant Console as 管理画面
    participant CF as Cloud Function<br/>(createCompanyUser)
    participant Auth as Firebase Auth
    participant FS as Firestore<br/>(company_users)

    Note over Admin,FS: 前提: company_users/uid_companyA に存在
    Admin->>Console: 会社ユーザー追加<br/>(email, パスワード空, companyB)
    Console->>CF: createCompanyUser(email, '', companyB)

    CF->>FS: where('email', '==', email).get()
    FS-->>CF: 既存ドキュメント発見 (uid)

    Note right of CF: 既存ユーザーなので<br/>パスワード不要

    CF->>FS: doc('company_users/{uid}_companyB').set({<br/>  email, companyDomain: companyB<br/>})
    FS-->>CF: 成功
    CF-->>Console: 成功
    Console-->>Admin: 登録完了

    Note over FS: 結果:<br/>company_users/uid_companyA ✓<br/>company_users/uid_companyB ✓
```

**ポイント:**
- パスワード不要（既存ユーザー）
- ドキュメントIDは `{uid}_{companyDomain}` 形式
- ログイン時に会社選択画面が表示される

---

## ログインフロー

### 管理者ユーザー

```mermaid
flowchart TD
    A[ログイン画面] --> B[Googleログイン]
    B --> C{Firebase Auth}
    C --> D[UID取得]
    D --> E{admin_users 存在確認}
    E -->|Yes| F[管理者としてログイン]
    E -->|No| G{company_users 検索}
    G -->|Yes| H[会社ユーザーとしてログイン]
    G -->|No| I[アクセス拒否]
```

### 会社ユーザー

```mermaid
flowchart TD
    A[ログイン画面] --> B[メール+パスワード入力]
    B --> C{Firebase Auth}
    C -->|認証成功| D[UID取得]
    C -->|認証失敗| E[エラー表示]
    D --> F{company_users 検索}
    F -->|1件| G[会社ユーザーとしてログイン]
    F -->|複数件| H[会社選択画面]
    H --> I[選択した会社でログイン]
    F -->|0件| J[アクセス拒否]
```

---

## データ構造

### admin_users コレクション

```javascript
// ドキュメントID: Firebase Auth UID
{
  email: "admin@example.com",
  role: "admin",           // 常に "admin"
  createdAt: Timestamp,
  createdBy: "uid"         // 作成した管理者のUID
}
```

### company_users コレクション

```javascript
// ドキュメントID: {uid} または {uid}_{companyDomain}
{
  uid: "abc123xyz",
  email: "user@example.com",
  companyDomain: "company-a",
  companyName: "株式会社A",
  name: "山田太郎",
  username: "yamada",
  role: "manager",         // "manager" | "staff"
  isActive: true,
  createdAt: Timestamp
}
```

---

## Firestore Security Rules

```javascript
// 管理者かどうかの判定
function isAdmin() {
  return isAuthenticated() &&
    exists(/databases/$(database)/documents/admin_users/$(request.auth.uid));
}

// 会社ユーザーかどうかの判定
function isCompanyUser() {
  return isAuthenticated() &&
    exists(/databases/$(database)/documents/company_users/$(request.auth.uid));
}

// 特定の会社に所属しているかの判定
function isCompanyMember(companyDomain) {
  return isAuthenticated() && (
    isAdmin() ||
    exists(/databases/$(database)/documents/company_users/$(request.auth.uid)) ||
    exists(/databases/$(database)/documents/company_users/$(request.auth.uid + '_' + companyDomain))
  );
}
```

---

## まとめ

| ケース | admin_users | company_users | Firebase Auth | パスワード |
|--------|-------------|---------------|---------------|------------|
| 管理者のみ | ✓ | - | Google認証 | 不要 |
| 会社ユーザーのみ（新規） | - | ✓ | Email+PW | **必須** |
| 管理者→会社ユーザー追加 | ✓ | ✓ | 既存流用 | 不要 |
| 会社ユーザー→別会社追加 | - | ✓✓ | 既存流用 | 不要 |

### 重要なポイント

1. **既存ユーザーの招待はパスワード不要**: Firebase Authに既に存在するユーザーを別の会社に追加する場合、パスワードは不要
2. **UIDの共有**: 同じメールアドレスのユーザーは同じUIDを共有し、複数のコレクションに存在可能
3. **複数会社対応**: 会社ユーザーは複数の会社に所属可能（ドキュメントIDで区別）
4. **認証方法の違い**: 管理者はGoogle認証、会社ユーザーはメール+パスワード

---

## 関連ファイル

| ファイル | 説明 |
|----------|------|
| `src/features/admin/auth.js` | 認証ロジック、`addCompanyUser()` |
| `src/features/admin/index.js` | 管理画面UI、`saveCompanyUser()` |
| `functions/index.js` | Cloud Function `createCompanyUser` |
| `firestore.rules` | セキュリティルール |
