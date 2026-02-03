/**
 * Admin Dashboard - 認証モジュール
 */

import { config, USER_ROLES } from './config.js';

let firebaseAuth = null;
let firebaseDb = null;
let currentUser = null;
let idToken = null;
let userRole = null;         // 'admin' or 'company'
let userCompanyDomain = null; // 会社ユーザーの場合の所属会社ドメイン

// Firebase初期化
export function initFirebase() {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(config.firebaseConfig);
    }
    firebaseAuth = firebase.auth();
    firebaseDb = firebase.firestore();

    firebaseAuth.onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        try {
          idToken = await user.getIdToken();
          console.log('[Admin] Firebase ID token obtained');

          // Firestoreからユーザー権限を取得
          await loadUserRole(user.uid, user.email);

          const session = sessionStorage.getItem(config.sessionKey);
          if (session) {
            // ダッシュボードデータを読み込み
            const event = new CustomEvent('authReady', { detail: { user, idToken, userRole, userCompanyDomain } });
            document.dispatchEvent(event);
          }
        } catch (e) {
          console.error('[Admin] Failed to get ID token:', e);
        }
      } else {
        currentUser = null;
        idToken = null;
        userRole = null;
        userCompanyDomain = null;
      }
    });
  }
}

/**
 * Firestoreからユーザー権限を読み込み
 */
async function loadUserRole(uid, email) {
  if (!firebaseDb) return;

  try {
    // admin_usersコレクションからユーザー情報を取得
    const userDoc = await firebaseDb.collection('admin_users').doc(uid).get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      userRole = userData.role || USER_ROLES.COMPANY;
      userCompanyDomain = userData.companyDomain || null;

      // セッションに保存
      sessionStorage.setItem(config.userRoleKey, userRole);
      if (userCompanyDomain) {
        sessionStorage.setItem(config.userCompanyKey, userCompanyDomain);
      }

      console.log('[Admin] User role loaded:', userRole, userCompanyDomain);
    } else {
      // ユーザーが登録されていない場合は、emailで検索
      const emailQuery = await firebaseDb.collection('admin_users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (!emailQuery.empty) {
        const userData = emailQuery.docs[0].data();
        userRole = userData.role || USER_ROLES.COMPANY;
        userCompanyDomain = userData.companyDomain || null;

        sessionStorage.setItem(config.userRoleKey, userRole);
        if (userCompanyDomain) {
          sessionStorage.setItem(config.userCompanyKey, userCompanyDomain);
        }

        console.log('[Admin] User role loaded by email:', userRole, userCompanyDomain);
      } else {
        // 未登録ユーザーの場合
        userRole = null;
        userCompanyDomain = null;
        console.log('[Admin] User not registered in admin_users');
      }
    }
  } catch (error) {
    console.error('[Admin] Failed to load user role:', error);
  }
}

// セッション確認
export function checkSession() {
  const session = sessionStorage.getItem(config.sessionKey);
  return !!session;
}

// ログイン処理（admin固定認証）
export function handleLogin(username, password) {
  if (username === config.credentials.username &&
      password === config.credentials.password) {
    sessionStorage.setItem(config.sessionKey, 'authenticated');
    sessionStorage.setItem(config.userRoleKey, USER_ROLES.ADMIN);
    userRole = USER_ROLES.ADMIN;
    userCompanyDomain = null;
    return { success: true, role: USER_ROLES.ADMIN };
  }
  return { success: false, error: 'ユーザー名またはパスワードが正しくありません' };
}

// 会社ユーザーログイン処理（ユーザー名とパスワードのみで認証）
export async function handleCompanyLogin(username, password) {
  if (!firebaseDb) {
    return { success: false, error: 'データベースが初期化されていません' };
  }

  try {
    // company_usersコレクションからユーザー名で検索
    const userQuery = await firebaseDb.collection('company_users')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (userQuery.empty) {
      return { success: false, error: 'ユーザーIDまたはパスワードが正しくありません' };
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();

    // 有効チェック
    if (userData.isActive === false) {
      return { success: false, error: 'このアカウントは無効化されています' };
    }

    // パスワード検証（本番では適切なハッシュ化を使用）
    if (userData.password !== password) {
      return { success: false, error: 'ユーザーIDまたはパスワードが正しくありません' };
    }

    const companyDomain = userData.companyDomain;

    sessionStorage.setItem(config.sessionKey, 'authenticated');
    sessionStorage.setItem(config.userRoleKey, USER_ROLES.COMPANY);
    sessionStorage.setItem(config.userCompanyKey, companyDomain);
    sessionStorage.setItem('auth_method', 'company');
    sessionStorage.setItem('company_user_id', username);

    userRole = USER_ROLES.COMPANY;
    userCompanyDomain = companyDomain;

    // 最終ログイン日時を更新
    try {
      await firebaseDb.collection('company_users').doc(userDoc.id).update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.warn('Failed to update last login:', e);
    }

    return {
      success: true,
      role: USER_ROLES.COMPANY,
      companyDomain,
      companyName: userData.companyName || companyDomain,
      userName: userData.name || username,
      userId: userDoc.id
    };
  } catch (error) {
    console.error('Company login error:', error);
    return { success: false, error: 'ログインに失敗しました: ' + error.message };
  }
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

    // ユーザー権限を読み込み
    await loadUserRole(result.user.uid, result.user.email);

    // 未登録ユーザーはログイン不可
    if (!userRole) {
      await firebaseAuth.signOut();
      return { success: false, error: 'このアカウントは管理画面へのアクセス権限がありません。管理者にお問い合わせください。' };
    }

    sessionStorage.setItem(config.sessionKey, 'authenticated');
    sessionStorage.setItem('auth_method', 'google');

    return {
      success: true,
      user: currentUser,
      idToken,
      role: userRole,
      companyDomain: userCompanyDomain
    };
  } catch (error) {
    console.error('Google login error:', error);
    return { success: false, error: 'Googleログインに失敗しました: ' + error.message };
  }
}

// ログアウト処理
export function handleLogout() {
  sessionStorage.removeItem(config.sessionKey);
  sessionStorage.removeItem(config.userRoleKey);
  sessionStorage.removeItem(config.userCompanyKey);
  sessionStorage.removeItem('auth_method');
  sessionStorage.removeItem('company_user_id');

  userRole = null;
  userCompanyDomain = null;

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

// ユーザーロールを取得
export function getUserRole() {
  return userRole || sessionStorage.getItem(config.userRoleKey);
}

// ユーザーの所属会社ドメインを取得
export function getUserCompanyDomain() {
  return userCompanyDomain || sessionStorage.getItem(config.userCompanyKey);
}

// 管理者かどうか
export function isAdmin() {
  const role = getUserRole();
  return role === USER_ROLES.ADMIN;
}

// 特定の会社へのアクセス権限があるか
export function hasAccessToCompany(companyDomain) {
  if (isAdmin()) return true;
  return getUserCompanyDomain() === companyDomain;
}

// パスワードを更新
export function updatePassword(newPassword) {
  config.credentials.password = newPassword;
  localStorage.setItem('admin_password', newPassword);
}

/**
 * 管理者ユーザーを追加（管理者のみ実行可能）
 */
export async function addAdminUser(email, role, companyDomain = null) {
  if (!isAdmin()) {
    return { success: false, error: '権限がありません' };
  }

  if (!firebaseDb) {
    return { success: false, error: 'データベースが初期化されていません' };
  }

  try {
    const docRef = await firebaseDb.collection('admin_users').add({
      email,
      role,
      companyDomain,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Failed to add admin user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 会社ユーザーを追加（管理者のみ実行可能）
 * @param {string} username - ユーザーID
 * @param {string} password - パスワード
 * @param {string} companyDomain - 会社ドメイン
 * @param {string} name - 表示名
 * @param {string} role - 役割 ('admin' | 'staff')
 */
export async function addCompanyUser(username, password, companyDomain, name = '', role = 'staff') {
  if (!isAdmin()) {
    return { success: false, error: '権限がありません' };
  }

  if (!firebaseDb) {
    return { success: false, error: 'データベースが初期化されていません' };
  }

  try {
    // 同じユーザー名が存在するかチェック
    const existing = await firebaseDb.collection('company_users')
      .where('username', '==', username)
      .where('companyDomain', '==', companyDomain)
      .get();

    if (!existing.empty) {
      return { success: false, error: 'このユーザー名は既に使用されています' };
    }

    const docRef = await firebaseDb.collection('company_users').add({
      username,
      password, // 本番では適切にハッシュ化
      companyDomain,
      name,
      role, // 'admin' or 'staff'
      isActive: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Failed to add company user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 会社ユーザー一覧を取得
 */
export async function getCompanyUsers(companyDomain = null) {
  if (!firebaseDb) return [];

  try {
    let query = firebaseDb.collection('company_users');

    if (companyDomain) {
      query = query.where('companyDomain', '==', companyDomain);
    } else if (!isAdmin()) {
      // 管理者以外は自社のユーザーのみ
      query = query.where('companyDomain', '==', getUserCompanyDomain());
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      password: undefined // パスワードは返さない
    }));
  } catch (error) {
    console.error('Failed to get company users:', error);
    return [];
  }
}

/**
 * 全会社ユーザーを取得（会社情報付き）
 */
export async function getAllCompanyUsersWithInfo() {
  if (!firebaseDb || !isAdmin()) return [];

  try {
    const snapshot = await firebaseDb.collection('company_users')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      password: undefined, // パスワードは返さない
      createdAt: doc.data().createdAt?.toDate?.() || null,
      lastLogin: doc.data().lastLogin?.toDate?.() || null
    }));
  } catch (error) {
    console.error('Failed to get all company users:', error);
    return [];
  }
}

/**
 * 会社ユーザーを更新
 */
export async function updateCompanyUser(userId, data) {
  if (!isAdmin()) {
    return { success: false, error: '権限がありません' };
  }

  if (!firebaseDb) {
    return { success: false, error: 'データベースが初期化されていません' };
  }

  try {
    const updateData = { ...data };
    delete updateData.id; // IDは更新しない

    await firebaseDb.collection('company_users').doc(userId).update({
      ...updateData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to update company user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 会社ユーザーを削除
 */
export async function deleteCompanyUser(userId) {
  if (!isAdmin()) {
    return { success: false, error: '権限がありません' };
  }

  if (!firebaseDb) {
    return { success: false, error: 'データベースが初期化されていません' };
  }

  try {
    await firebaseDb.collection('company_users').doc(userId).delete();
    return { success: true };
  } catch (error) {
    console.error('Failed to delete company user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 会社ユーザーのパスワードをリセット
 */
export async function resetCompanyUserPassword(userId, newPassword) {
  if (!isAdmin()) {
    return { success: false, error: '権限がありません' };
  }

  if (!firebaseDb) {
    return { success: false, error: 'データベースが初期化されていません' };
  }

  try {
    await firebaseDb.collection('company_users').doc(userId).update({
      password: newPassword, // 本番では適切にハッシュ化
      passwordResetAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to reset password:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ランダムパスワードを生成
 */
export function generatePassword(length = 12) {
  const charset = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

/**
 * ユーザーIDを自動生成（会社ドメインベース）
 */
export function generateUsername(companyDomain) {
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${companyDomain}_user_${suffix}`;
}

/**
 * 最終ログイン日時を更新（会社ユーザー用）
 */
export async function updateLastLogin(userId) {
  if (!firebaseDb) return;

  try {
    await firebaseDb.collection('company_users').doc(userId).update({
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to update last login:', error);
  }
}

/**
 * 会社にユーザーが存在するかチェック
 */
export async function hasCompanyUser(companyDomain) {
  if (!firebaseDb) return false;

  try {
    const snapshot = await firebaseDb.collection('company_users')
      .where('companyDomain', '==', companyDomain)
      .limit(1)
      .get();

    return !snapshot.empty;
  } catch (error) {
    console.error('Failed to check company user:', error);
    return false;
  }
}

export default {
  initFirebase,
  checkSession,
  handleLogin,
  handleCompanyLogin,
  handleGoogleLogin,
  handleLogout,
  getCurrentUser,
  getIdToken,
  getUserRole,
  getUserCompanyDomain,
  isAdmin,
  hasAccessToCompany,
  updatePassword,
  addAdminUser,
  addCompanyUser,
  getCompanyUsers,
  getAllCompanyUsersWithInfo,
  updateCompanyUser,
  deleteCompanyUser,
  resetCompanyUserPassword,
  generatePassword,
  generateUsername,
  updateLastLogin,
  hasCompanyUser,
  USER_ROLES
};
