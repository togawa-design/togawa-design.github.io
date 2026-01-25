/**
 * Admin Dashboard - 認証モジュール
 */

import { config } from './config.js';

let firebaseAuth = null;
let currentUser = null;
let idToken = null;

// Firebase初期化
export function initFirebase() {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(config.firebaseConfig);
    firebaseAuth = firebase.auth();

    firebaseAuth.onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        try {
          idToken = await user.getIdToken();
          console.log('[Admin] Firebase ID token obtained');
          const session = sessionStorage.getItem(config.sessionKey);
          if (session) {
            // ダッシュボードデータを読み込み
            const event = new CustomEvent('authReady', { detail: { user, idToken } });
            document.dispatchEvent(event);
          }
        } catch (e) {
          console.error('[Admin] Failed to get ID token:', e);
        }
      } else {
        currentUser = null;
        idToken = null;
      }
    });
  }
}

// セッション確認
export function checkSession() {
  const session = sessionStorage.getItem(config.sessionKey);
  return !!session;
}

// ログイン処理
export function handleLogin(username, password) {
  if (username === config.credentials.username &&
      password === config.credentials.password) {
    sessionStorage.setItem(config.sessionKey, 'authenticated');
    return { success: true };
  }
  return { success: false, error: 'ユーザー名またはパスワードが正しくありません' };
}

// Googleログイン処理
export async function handleGoogleLogin() {
  if (!firebaseAuth) {
    return { success: false, error: 'Firebase認証が初期化されていません' };
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await firebaseAuth.signInWithPopup(provider);
    currentUser = result.user;
    idToken = await result.user.getIdToken();

    sessionStorage.setItem(config.sessionKey, 'authenticated');
    sessionStorage.setItem('auth_method', 'google');
    return { success: true, user: currentUser, idToken };
  } catch (error) {
    console.error('Google login error:', error);
    return { success: false, error: 'Googleログインに失敗しました: ' + error.message };
  }
}

// ログアウト処理
export function handleLogout() {
  sessionStorage.removeItem(config.sessionKey);
  sessionStorage.removeItem('auth_method');

  if (firebaseAuth) {
    firebaseAuth.signOut();
  }
}

// 現在のユーザー情報を取得
export function getCurrentUser() {
  return currentUser;
}

// IDトークンを取得
export function getIdToken() {
  return idToken;
}

// パスワードを更新
export function updatePassword(newPassword) {
  config.credentials.password = newPassword;
  localStorage.setItem('admin_password', newPassword);
}

export default {
  initFirebase,
  checkSession,
  handleLogin,
  handleGoogleLogin,
  handleLogout,
  getCurrentUser,
  getIdToken,
  updatePassword
};
