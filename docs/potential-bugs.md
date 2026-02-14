# 潜在的な不具合・修正推奨箇所

## 1. エラーハンドリング

### 1-1. Promise.all()の部分的なエラーハンドリング

**優先度**: 高

**該当箇所**: `functions/index.js` 1255-1261行目

**問題**: Promise.all()で複数のAPI呼び出しを並列実行しているが、一部のみ`.catch()`で保護されている。

```javascript
const [companyViews, applyClicks, lineClicks, formSubmits, recentAppsResult, jobPerformance] = await Promise.all([
  getEventCount('view_company_page'),  // エラーハンドリングなし
  getEventCount('click_apply'),        // エラーハンドリングなし
  getEventCount('click_line'),         // エラーハンドリングなし
  getEventCount('form_submit'),        // エラーハンドリングなし
  getRecentApplications(companyDomain, 50).catch(e => {...}),  // あり
  getJobPerformanceData(client, days, companyDomain).catch(e => {...})  // あり
]);
```

**対策案**:
- 全てのPromiseに`.catch()`を追加
- または`Promise.allSettled()`を使用

---

### 1-2. multipart/form-dataパース処理が簡易実装

**優先度**: 高

**該当箇所**: `functions/email.js` 435-464行目

**問題**: コメントに「本番ではbusboyを使用」と記載されているが、簡易的な実装のまま。大容量ファイルやバウンダリ処理が不完全。

**対策案**: package.jsonにbusboyは既に含まれているので、実装を更新

---

## 2. 非同期処理の問題

### 2-1. fetchタイムアウト未設定

**優先度**: 中

**該当箇所**: `src/shared/email-service.js` 93-94行目

**問題**: fetch()がタイムアウトなしで実行される。ネットワークが遅い場合、無期限待機する。

```javascript
const response = await fetch(url, options);
const data = await response.json();
```

**対策案**:
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);
try {
  const response = await fetch(url, { ...options, signal: controller.signal });
  clearTimeout(timeoutId);
  // ...
} catch (error) {
  if (error.name === 'AbortError') {
    throw new Error('リクエストがタイムアウトしました');
  }
  throw error;
}
```

---

### 2-2. Firebase onAuthStateChanged()の重複実行

**優先度**: 中

**該当箇所**: `src/features/admin/auth.js` 24-49行目

**問題**: onAuthStateChanged()内でloadUserRole()をawaitしているが、並列実行時に同じuserのロード処理が複数実行される可能性がある。

**対策案**: フラグやPromiseキャッシュで重複実行を防止

---

## 3. 競合状態（Race Condition）

### 3-1. 自動保存と手動保存の競合

**優先度**: 高

**該当箇所**: `src/shared/auto-save.js` 164-293行目

**問題**: ユーザーが手動保存中に自動保存が実行される可能性がある。両方がFirestoreに同時に書き込みを試みるとデータ競合が発生する。

**対策案**:
```javascript
let isSaving = false;

const save = async () => {
  if (isSaving) return;
  isSaving = true;
  try {
    await actualSave();
  } finally {
    isSaving = false;
  }
};
```

---

## 4. メモリリーク

### 4-1. Firebase onAuthStateChanged()の未unsubscribe

**優先度**: 高

**該当箇所**: `src/features/user-auth/auth-service.js` 39-60行目

**問題**: onAuthStateChanged()の戻り値（unsubscribe関数）が保存されていない。ページ離脱時にリスナーが残る。

```javascript
firebaseAuth.onAuthStateChanged(async (user) => {
  // ... リスナーが永続的に登録されたまま
}); // unsubscribe関数が保存されていない
```

**対策案**:
```javascript
let unsubscribeAuth = null;

export function initAuth() {
  unsubscribeAuth = firebaseAuth.onAuthStateChanged(async (user) => {
    // ...
  });
}

export function cleanupAuth() {
  if (unsubscribeAuth) {
    unsubscribeAuth();
    unsubscribeAuth = null;
  }
}
```

---

### 4-2. イベントリスナーの未クリーンアップ

**優先度**: 中

**該当箇所**: `src/features/admin/index.js` 186-205行目

**問題**: changeイベントリスナーが登録されるが、ページ遷移時にクリーンアップされない。複数回登録される可能性がある。

---

### 4-3. Chart.jsインスタンスの未破棄

**優先度**: 低〜中

**該当箇所**: `src/features/admin/analytics.js` 15-21行目

**問題**: グローバルなChart.jsインスタンス(dailyChart, dayOfWeekChart等)が破棄されずに再作成される可能性がある。

**対策案**:
```javascript
if (dailyChart) {
  dailyChart.destroy();
}
dailyChart = new Chart(ctx, config);
```

---

### 4-4. AutoSaveインスタンスの不完全なクリーンアップ

**優先度**: 中

**該当箇所**: `src/shared/auto-save.js` 178-180, 327-330行目

**問題**: cleanupAllAutoSave()が呼び出されない場合、setInterval()が実行され続ける。

---

## 5. データ整合性

### 5-1. トランザクション未使用の複数更新

**優先度**: 中

**該当箇所**: `functions/email.js` 135-154行目

**問題**: メール送信時にメタデータとメール本体が別々に保存される。途中で失敗するとデータ不整合が生じる。

**対策案**: Firestoreトランザクションを使用

---

### 5-2. 複数タブでのキャッシュ不整合

**優先度**: 中

**該当箇所**: `src/features/job-manage/state.js` 11-19行目

**問題**: グローバルステート変数(jobsCache等)が手動で更新される。複数タブで開かれた場合の同期メカニズムがない。

---

## 6. nullチェック漏れ

### 6-1. Firestoreドキュメントの存在確認不足

**優先度**: 低

**該当箇所**: `functions/email.js` 368-380行目

**問題**: getCompanyInfo()で取得したドキュメントがnullの場合、fromNameが「null」文字列になる可能性。

---

## 修正優先度サマリー

| 優先度 | 項目 | ファイル |
|--------|------|----------|
| 高 | Promise.allエラーハンドリング | functions/index.js |
| 高 | 自動保存競合 | src/shared/auto-save.js |
| 高 | Firebase unsubscribe漏れ | src/features/user-auth/auth-service.js |
| 高 | multipartパーサー | functions/email.js |
| 中 | fetchタイムアウト | src/shared/email-service.js |
| 中 | 重複実行防止 | src/features/admin/auth.js |
| 中 | イベントリスナー | src/features/admin/index.js |
| 中 | Chart.js破棄 | src/features/admin/analytics.js |
| 中 | トランザクション | functions/email.js |
| 低 | nullチェック | functions/email.js |
