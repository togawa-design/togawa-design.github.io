/**
 * 求人管理 - 認証・セッション管理モジュール
 */

// 設定
export const config = {
  gasApiUrl: 'https://script.google.com/macros/s/AKfycbxj6CqSfY7jq04uDXURhewD_BAKx3csLKBpl1hdRBdNg-R-E6IuoaZGje22Gr9WYWY2/exec',
  firebaseConfig: {
    apiKey: "AIzaSyB3eXZoFkXOwnHxPvaHiWO7csmZK4KGqAQ",
    authDomain: "generated-area-484613-e3-90bd4.firebaseapp.com",
    projectId: "generated-area-484613-e3-90bd4"
  },
  sessionKey: 'rikueco_admin_session',
  userRoleKey: 'rikueco_user_role',
  userCompanyKey: 'rikueco_user_company'
};

// ユーザーロール定義
export const USER_ROLES = {
  ADMIN: 'admin',
  COMPANY: 'company'
};

/**
 * セッション確認
 */
export function checkSession() {
  return !!sessionStorage.getItem(config.sessionKey);
}

/**
 * ユーザーロール取得
 */
export function getUserRole() {
  return sessionStorage.getItem(config.userRoleKey);
}

/**
 * ユーザーの所属会社ドメイン取得
 */
export function getUserCompanyDomain() {
  return sessionStorage.getItem(config.userCompanyKey);
}

/**
 * 管理者かどうか
 */
export function isAdmin() {
  return getUserRole() === USER_ROLES.ADMIN;
}

/**
 * 特定の会社へのアクセス権限があるか
 */
export function hasAccessToCompany(domain) {
  if (isAdmin()) return true;
  return getUserCompanyDomain() === domain;
}

/**
 * ログアウト処理
 */
export function handleLogout() {
  sessionStorage.removeItem(config.sessionKey);
  sessionStorage.removeItem(config.userRoleKey);
  sessionStorage.removeItem(config.userCompanyKey);
  sessionStorage.removeItem('auth_method');
  sessionStorage.removeItem('company_user_id');

  // Firebaseからもサインアウト
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().signOut();
  }
}

/**
 * Firebase初期化
 */
export function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn('[JobManager] Firebase not loaded');
    return false;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(config.firebaseConfig);
  }
  return true;
}
