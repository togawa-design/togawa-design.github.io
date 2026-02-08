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

  // Firebase Auth の状態を監視
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      // ログイン中 - セッションを維持
      console.log('[JobManager] Firebase Auth: logged in as', user.email);
    } else {
      // ログアウト - セッションをクリアしてリダイレクト
      const currentSession = sessionStorage.getItem(config.sessionKey);
      const authMethod = sessionStorage.getItem('auth_method');

      // 会社ユーザー（Firebase Auth）でログインしていた場合
      if (currentSession && authMethod === 'company') {
        console.log('[JobManager] Firebase Auth: logged out, clearing session');
        handleLogout();
        // ログイン画面にリダイレクト
        window.location.href = 'admin.html';
      }
    }
  });

  return true;
}

/**
 * 現在のFirebase Auth ユーザーを取得
 */
export function getCurrentUser() {
  if (typeof firebase === 'undefined' || !firebase.auth) {
    return null;
  }
  return firebase.auth().currentUser;
}

/**
 * Firebase Auth IDトークンを取得
 */
export async function getIdToken() {
  const user = getCurrentUser();
  if (!user) return null;

  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('[JobManager] Failed to get ID token:', error);
    return null;
  }
}

/**
 * 利用可能な会社一覧を取得
 */
export function getAvailableCompanies() {
  const companiesJson = sessionStorage.getItem('available_companies');
  if (companiesJson) {
    try {
      return JSON.parse(companiesJson);
    } catch (e) {
      return [];
    }
  }
  return [];
}

/**
 * 会社を切り替え（複数会社所属ユーザー用）
 * @param {string} companyDomain - 切り替え先の会社ドメイン
 */
export function switchCompany(companyDomain) {
  const companies = getAvailableCompanies();
  const targetCompany = companies.find(c => c.companyDomain === companyDomain);

  if (!targetCompany) {
    return { success: false, error: '指定された会社にアクセス権限がありません' };
  }

  // セッションを更新
  sessionStorage.setItem(config.userCompanyKey, companyDomain);

  console.log('[JobManager] Switched company to:', companyDomain);

  // カスタムイベントを発火して画面を更新
  const event = new CustomEvent('companyChanged', {
    detail: {
      companyDomain,
      companyName: targetCompany.companyName,
      docId: targetCompany.docId
    }
  });
  document.dispatchEvent(event);

  return {
    success: true,
    companyDomain,
    companyName: targetCompany.companyName
  };
}
