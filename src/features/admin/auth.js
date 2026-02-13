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
let availableCompanies = []; // 複数会社対応：ユーザーが所属する全会社

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
 * admin_users と company_users の両方をチェック
 */
async function loadUserRole(uid, email) {
  if (!firebaseDb) return;

  try {
    // 1. admin_usersコレクションからユーザー情報を取得
    const userDoc = await firebaseDb.collection('admin_users').doc(uid).get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      userRole = userData.role || USER_ROLES.ADMIN;
      userCompanyDomain = userData.companyDomain || null;

      // セッションに保存
      sessionStorage.setItem(config.userRoleKey, userRole);
      if (userCompanyDomain) {
        sessionStorage.setItem(config.userCompanyKey, userCompanyDomain);
      }

      console.log('[Admin] User role loaded from admin_users:', userRole, userCompanyDomain);
      return;
    }

    // 2. admin_usersにない場合、emailで検索
    const adminEmailQuery = await firebaseDb.collection('admin_users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!adminEmailQuery.empty) {
      const userData = adminEmailQuery.docs[0].data();
      userRole = userData.role || USER_ROLES.ADMIN;
      userCompanyDomain = userData.companyDomain || null;

      sessionStorage.setItem(config.userRoleKey, userRole);
      if (userCompanyDomain) {
        sessionStorage.setItem(config.userCompanyKey, userCompanyDomain);
      }

      console.log('[Admin] User role loaded from admin_users by email:', userRole, userCompanyDomain);
      return;
    }

    // 3. company_usersコレクションをチェック（複数会社対応）
    const companyUserQuery = await firebaseDb.collection('company_users')
      .where('email', '==', email)
      .where('isActive', '==', true)
      .get();

    if (!companyUserQuery.empty) {
      // 会社ユーザーとして登録されている
      const companies = companyUserQuery.docs.map(doc => ({
        docId: doc.id,
        companyDomain: doc.data().companyDomain,
        companyName: doc.data().companyName || doc.data().companyDomain,
        userName: doc.data().name || doc.data().username || email
      }));

      // 複数会社の場合はavailableCompaniesに保存
      availableCompanies = companies;
      sessionStorage.setItem('available_companies', JSON.stringify(companies));

      // 最初の会社をデフォルトとして設定
      const firstCompany = companies[0];
      userRole = USER_ROLES.COMPANY;
      userCompanyDomain = firstCompany.companyDomain;

      sessionStorage.setItem(config.userRoleKey, userRole);
      sessionStorage.setItem(config.userCompanyKey, userCompanyDomain);

      console.log('[Admin] User role loaded from company_users:', userRole, userCompanyDomain, `(${companies.length} companies)`);

      // 複数会社の場合は選択が必要なことを示すフラグを設定
      if (companies.length > 1) {
        sessionStorage.setItem('requires_company_selection', 'true');
      }
      return;
    }

    // 4. どちらにも登録されていない
    userRole = null;
    userCompanyDomain = null;
    availableCompanies = [];
    console.log('[Admin] User not registered in admin_users or company_users');

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

// 会社ユーザーログイン処理（ハイブリッド認証：Firebase Auth + レガシー認証）
// emailOrUsername: メールアドレス または ユーザーID
export async function handleCompanyLogin(emailOrUsername, password) {
  if (!firebaseAuth || !firebaseDb) {
    return { success: false, error: 'Firebaseが初期化されていません' };
  }

  // メールアドレス形式かどうかを判定
  const isEmail = emailOrUsername.includes('@');

  // 1. メールアドレスの場合、まずFirebase Authを試行
  if (isEmail) {
    const firebaseResult = await handleFirebaseAuthLogin(emailOrUsername, password);
    if (firebaseResult.success) {
      return firebaseResult;
    }
    // Firebase Authで見つからない場合は、レガシー認証にフォールバック
    if (firebaseResult.errorCode !== 'auth/user-not-found' &&
        firebaseResult.errorCode !== 'auth/invalid-credential') {
      return firebaseResult;
    }
    console.log('[Auth] Firebase Auth user not found, trying legacy auth...');
  }

  // 2. レガシー認証（username + password または email + password）
  return await handleLegacyLogin(emailOrUsername, password);
}

/**
 * Firebase Auth でログイン（新規ユーザー用）
 * 複数会社対応：同一emailで複数会社に所属している場合は会社選択を要求
 */
async function handleFirebaseAuthLogin(email, password) {
  try {
    const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;
    currentUser = userCredential.user;
    idToken = await userCredential.user.getIdToken();

    // emailで検索して複数会社対応（UIDベースのドキュメント + emailベースのドキュメント両方）
    const emailSnapshot = await firebaseDb.collection('company_users')
      .where('email', '==', email)
      .get();

    // 有効なドキュメントをフィルタ
    const validDocs = emailSnapshot.docs.filter(doc => doc.data().isActive !== false);

    if (validDocs.length === 0) {
      await firebaseAuth.signOut();
      return { success: false, error: 'ユーザー情報が見つかりません。管理者にお問い合わせください。' };
    }

    // 複数会社に所属している場合
    if (validDocs.length > 1) {
      const companies = validDocs.map(doc => {
        const data = doc.data();
        return {
          docId: doc.id,
          companyDomain: data.companyDomain,
          companyName: data.companyName || data.companyDomain,
          userName: data.name || data.username || email
        };
      });

      // セッションに仮保存（会社選択後に正式認証）
      sessionStorage.setItem('pending_auth', JSON.stringify({
        email,
        uid,
        companies,
        authMethod: 'firebase_auth'
      }));

      availableCompanies = companies;

      console.log('[Auth] Firebase Auth: Multiple companies found:', companies.length);

      return {
        success: true,
        requiresCompanySelection: true,
        companies,
        authMethod: 'firebase_auth'
      };
    }

    // 単一会社の場合
    const userDoc = validDocs[0];
    const userData = userDoc.data();
    const companyDomain = userData.companyDomain;

    sessionStorage.setItem(config.sessionKey, 'authenticated');
    sessionStorage.setItem(config.userRoleKey, USER_ROLES.COMPANY);
    sessionStorage.setItem(config.userCompanyKey, companyDomain);
    sessionStorage.setItem('auth_method', 'firebase_auth');
    sessionStorage.setItem('company_user_id', userData.username || email);
    sessionStorage.setItem('available_companies', JSON.stringify([{
      docId: userDoc.id,
      companyDomain,
      companyName: userData.companyName || companyDomain
    }]));

    userRole = USER_ROLES.COMPANY;
    userCompanyDomain = companyDomain;
    availableCompanies = [{
      docId: userDoc.id,
      companyDomain,
      companyName: userData.companyName || companyDomain
    }];

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
      userName: userData.name || userData.username || email,
      userId: userDoc.id,
      authMethod: 'firebase_auth',
      availableCompanies
    };
  } catch (error) {
    console.error('Firebase Auth login error:', error);

    let errorMessage = 'ログインに失敗しました';
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/invalid-credential':
        errorMessage = 'ユーザーが見つかりません';
        break;
      case 'auth/wrong-password':
        errorMessage = 'パスワードが正しくありません';
        break;
      case 'auth/invalid-email':
        errorMessage = 'メールアドレスの形式が正しくありません';
        break;
      case 'auth/user-disabled':
        errorMessage = 'このアカウントは無効化されています';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'ログイン試行回数が多すぎます。しばらく待ってから再試行してください';
        break;
    }

    return { success: false, error: errorMessage, errorCode: error.code };
  }
}

/**
 * レガシー認証（既存ユーザー用：Cloud Function経由で認証）
 * セキュリティのため、パスワード照合はバックエンドで行う
 * 複数会社対応：同一emailで複数会社に所属している場合は会社選択を要求
 */
async function handleLegacyLogin(usernameOrEmail, password) {
  try {
    // Cloud Function を呼び出してレガシー認証
    const response = await fetch(config.legacyLoginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ usernameOrEmail, password })
    });

    const result = await response.json();

    if (!result.success) {
      return { success: false, error: result.error || 'ログインに失敗しました' };
    }

    // 複数会社に所属している場合
    if (result.requiresCompanySelection) {
      // セッションに仮保存（会社選択後に正式認証）
      sessionStorage.setItem('pending_auth', JSON.stringify({
        email: usernameOrEmail,
        companies: result.companies,
        authMethod: 'legacy'
      }));

      availableCompanies = result.companies;

      console.log('[Auth] Multiple companies found:', result.companies.length);

      return {
        success: true,
        requiresCompanySelection: true,
        companies: result.companies,
        authMethod: 'legacy'
      };
    }

    // 単一会社の場合
    const user = result.user;
    const companyDomain = user.companyDomain;

    sessionStorage.setItem(config.sessionKey, 'authenticated');
    sessionStorage.setItem(config.userRoleKey, USER_ROLES.COMPANY);
    sessionStorage.setItem(config.userCompanyKey, companyDomain);
    sessionStorage.setItem('auth_method', 'legacy');
    sessionStorage.setItem('company_user_id', user.userName);
    sessionStorage.setItem('available_companies', JSON.stringify(result.companies));

    userRole = USER_ROLES.COMPANY;
    userCompanyDomain = companyDomain;
    availableCompanies = result.companies;

    console.log('[Auth] Legacy login successful for:', user.userName);

    return {
      success: true,
      role: USER_ROLES.COMPANY,
      companyDomain,
      companyName: user.companyName,
      userName: user.userName,
      userId: user.docId,
      authMethod: 'legacy',
      availableCompanies
    };
  } catch (error) {
    console.error('Legacy login error:', error);
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

    // 複数会社に所属している場合
    const requiresSelection = sessionStorage.getItem('requires_company_selection') === 'true';
    if (requiresSelection && availableCompanies.length > 1) {
      // 会社選択用の情報をpending_authに保存
      sessionStorage.setItem('pending_auth', JSON.stringify({
        email: result.user.email,
        uid: result.user.uid,
        companies: availableCompanies,
        authMethod: 'google'
      }));

      return {
        success: true,
        requiresCompanySelection: true,
        companies: availableCompanies,
        authMethod: 'google'
      };
    }

    return {
      success: true,
      user: currentUser,
      idToken,
      role: userRole,
      companyDomain: userCompanyDomain,
      availableCompanies
    };
  } catch (error) {
    console.error('Google login error:', error);
    return { success: false, error: 'Googleログインに失敗しました: ' + error.message };
  }
}

/**
 * 複数会社から選択して認証を確定
 * @param {string} companyDomain - 選択した会社ドメイン
 */
export async function confirmCompanySelection(companyDomain) {
  const pendingAuth = sessionStorage.getItem('pending_auth');
  if (!pendingAuth) {
    return { success: false, error: '認証情報が見つかりません' };
  }

  try {
    const pending = JSON.parse(pendingAuth);
    const selectedCompany = pending.companies.find(c => c.companyDomain === companyDomain);

    if (!selectedCompany) {
      return { success: false, error: '選択した会社が見つかりません' };
    }

    // セッションに保存
    sessionStorage.setItem(config.sessionKey, 'authenticated');
    sessionStorage.setItem(config.userRoleKey, USER_ROLES.COMPANY);
    sessionStorage.setItem(config.userCompanyKey, companyDomain);
    sessionStorage.setItem('auth_method', pending.authMethod);
    sessionStorage.setItem('company_user_id', selectedCompany.userName);
    sessionStorage.setItem('available_companies', JSON.stringify(pending.companies));

    // pending_auth と requires_company_selection を削除
    sessionStorage.removeItem('pending_auth');
    sessionStorage.removeItem('requires_company_selection');

    userRole = USER_ROLES.COMPANY;
    userCompanyDomain = companyDomain;
    availableCompanies = pending.companies;

    // 最終ログイン日時を更新
    if (firebaseDb) {
      try {
        await firebaseDb.collection('company_users').doc(selectedCompany.docId).update({
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.warn('Failed to update last login:', e);
      }
    }

    console.log('[Auth] Company selection confirmed:', companyDomain);

    return {
      success: true,
      role: USER_ROLES.COMPANY,
      companyDomain,
      companyName: selectedCompany.companyName,
      userName: selectedCompany.userName,
      userId: selectedCompany.docId,
      availableCompanies
    };
  } catch (error) {
    console.error('Company selection error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 会社を切り替え（複数会社所属ユーザー用）
 * @param {string} companyDomain - 切り替え先の会社ドメイン
 */
export async function switchCompany(companyDomain) {
  const companiesJson = sessionStorage.getItem('available_companies');
  if (!companiesJson) {
    return { success: false, error: '利用可能な会社情報がありません' };
  }

  try {
    const companies = JSON.parse(companiesJson);
    const targetCompany = companies.find(c => c.companyDomain === companyDomain);

    if (!targetCompany) {
      return { success: false, error: '指定された会社にアクセス権限がありません' };
    }

    // セッションを更新
    sessionStorage.setItem(config.userCompanyKey, companyDomain);
    userCompanyDomain = companyDomain;

    console.log('[Auth] Switched company to:', companyDomain);

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
  } catch (error) {
    console.error('Switch company error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 利用可能な会社一覧を取得
 */
export function getAvailableCompanies() {
  if (availableCompanies.length > 0) {
    return availableCompanies;
  }

  const companiesJson = sessionStorage.getItem('available_companies');
  if (companiesJson) {
    try {
      availableCompanies = JSON.parse(companiesJson);
      return availableCompanies;
    } catch (e) {
      return [];
    }
  }
  return [];
}

// ログアウト処理
export function handleLogout() {
  sessionStorage.removeItem(config.sessionKey);
  sessionStorage.removeItem(config.userRoleKey);
  sessionStorage.removeItem(config.userCompanyKey);
  sessionStorage.removeItem('auth_method');
  sessionStorage.removeItem('company_user_id');
  sessionStorage.removeItem('available_companies');
  sessionStorage.removeItem('pending_auth');

  userRole = null;
  userCompanyDomain = null;
  availableCompanies = [];

  // UI要素のクリーンアップ（会社ビューモードなど）
  const companyViewSection = document.getElementById('company-view-section');
  if (companyViewSection) {
    companyViewSection.style.display = 'none';
  }

  if (firebaseAuth) {
    firebaseAuth.signOut();
  }
}

// 現在のユーザー情報を取得
export function getCurrentUser() {
  return currentUser;
}

// IDトークンを取得（有効なトークンを返す）
export async function getIdToken() {
  // currentUserがある場合は最新のトークンを取得
  if (currentUser) {
    try {
      idToken = await currentUser.getIdToken(true);
      return idToken;
    } catch (error) {
      console.error('[Auth] Failed to refresh ID token:', error);
    }
  }
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

// 現在のユーザーのメールアドレスを取得
export function getCurrentUserEmail() {
  if (currentUser && currentUser.email) {
    return currentUser.email;
  }
  return sessionStorage.getItem('company_user_id') || null;
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
 * Cloud Function を呼び出してユーザーを作成
 * @param {string} email - メールアドレス
 * @param {string} password - パスワード
 * @param {string} companyDomain - 会社ドメイン
 * @param {string} name - 表示名
 * @param {string} role - 役割 ('admin' | 'staff')
 * @param {string} username - ユーザーID（オプション、表示用）
 */
export async function addCompanyUser(email, password, companyDomain, name = '', role = 'staff', username = '') {
  if (!isAdmin()) {
    return { success: false, error: '権限がありません' };
  }

  if (!firebaseDb) {
    return { success: false, error: 'データベースが初期化されていません' };
  }

  // メールアドレスの形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: 'メールアドレスの形式が正しくありません' };
  }

  try {
    // 同じメール + 同じ会社の組み合わせのみチェック（別会社への追加はOK）
    const existing = await firebaseDb.collection('company_users')
      .where('email', '==', email)
      .where('companyDomain', '==', companyDomain)
      .get();

    if (!existing.empty) {
      return { success: false, error: 'このメールアドレスは既にこの会社に登録されています' };
    }

    // Cloud Function を呼び出してユーザーを作成
    const token = await getIdToken();
    const response = await fetch(`${config.cloudFunctionsBaseUrl}/createCompanyUser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        email,
        password,
        companyDomain,
        name,
        role,
        username: username || email.split('@')[0]
      })
    });

    const result = await response.json();

    if (result.success) {
      return { success: true, id: result.uid, email };
    } else {
      return { success: false, error: result.error || 'ユーザーの作成に失敗しました' };
    }
  } catch (error) {
    console.error('Failed to add company user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 自社スタッフを追加（会社ユーザー用）
 * 会社ユーザーが自社のスタッフを追加できる
 */
export async function addCompanyStaff(email, password, name = '', username = '') {
  if (!firebaseDb) {
    return { success: false, error: 'データベースが初期化されていません' };
  }

  // メールアドレスの形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: 'メールアドレスの形式が正しくありません' };
  }

  if (!password || password.length < 8) {
    return { success: false, error: 'パスワードは8文字以上で入力してください' };
  }

  try {
    // Cloud Function を呼び出してスタッフを作成（Firebase Auth経由）
    const token = await getIdToken();
    if (!token) {
      return { success: false, error: '認証トークンが取得できません。再ログインしてください。' };
    }

    const response = await fetch(`${config.cloudFunctionsBaseUrl}/createCompanyStaff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        email,
        password,
        name,
        username: username || email.split('@')[0]
      })
    });

    const result = await response.json();

    if (result.success) {
      return { success: true, id: result.uid, email };
    } else {
      return { success: false, error: result.error || 'スタッフの作成に失敗しました' };
    }
  } catch (error) {
    console.error('Failed to add company staff:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 自社スタッフを削除（会社ユーザー用）
 */
export async function deleteCompanyStaff(staffId) {
  if (!firebaseDb) {
    return { success: false, error: 'データベースが初期化されていません' };
  }

  const myCompanyDomain = getUserCompanyDomain();
  if (!myCompanyDomain) {
    return { success: false, error: '会社情報が見つかりません' };
  }

  try {
    // 削除対象のスタッフが自社のものか確認
    const staffDoc = await firebaseDb.collection('company_users').doc(staffId).get();
    if (!staffDoc.exists) {
      return { success: false, error: 'スタッフが見つかりません' };
    }

    const staffData = staffDoc.data();
    if (staffData.companyDomain !== myCompanyDomain) {
      return { success: false, error: '権限がありません' };
    }

    // 自分自身は削除できない
    const myUserId = sessionStorage.getItem('company_user_id');
    if (staffData.username === myUserId || staffData.email === myUserId) {
      return { success: false, error: '自分自身を削除することはできません' };
    }

    await firebaseDb.collection('company_users').doc(staffId).delete();
    return { success: true };
  } catch (error) {
    console.error('Failed to delete company staff:', error);
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
 * Firebase Auth と Firestore の両方から削除
 */
export async function deleteCompanyUser(userId) {
  if (!isAdmin()) {
    return { success: false, error: '権限がありません' };
  }

  if (!firebaseDb) {
    return { success: false, error: 'データベースが初期化されていません' };
  }

  try {
    // ユーザー情報を取得
    const userDoc = await firebaseDb.collection('company_users').doc(userId).get();

    if (!userDoc.exists) {
      return { success: false, error: 'ユーザーが見つかりません' };
    }

    const userData = userDoc.data();

    // Firebase Auth ユーザーの場合は Cloud Function で削除
    if (!userData._legacyAuth) {
      try {
        const token = await getIdToken();
        await fetch(`${config.cloudFunctionsBaseUrl}/deleteCompanyUser`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ uid: userId })
        });
      } catch (fnError) {
        // Cloud Function がない場合は警告のみ
        console.warn('Failed to delete from Firebase Auth:', fnError);
      }
    }

    // Firestore から削除
    await firebaseDb.collection('company_users').doc(userId).delete();

    return { success: true };
  } catch (error) {
    console.error('Failed to delete company user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 会社ユーザーにパスワードリセットメールを送信
 * @param {string} email - ユーザーのメールアドレス
 */
export async function sendPasswordResetEmail(email) {
  if (!isAdmin()) {
    return { success: false, error: '権限がありません' };
  }

  if (!firebaseAuth) {
    return { success: false, error: 'Firebase認証が初期化されていません' };
  }

  try {
    await firebaseAuth.sendPasswordResetEmail(email);
    return { success: true, message: 'パスワードリセットメールを送信しました' };
  } catch (error) {
    console.error('Failed to send password reset email:', error);

    let errorMessage = 'パスワードリセットメールの送信に失敗しました';
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'このメールアドレスのユーザーが見つかりません';
        break;
      case 'auth/invalid-email':
        errorMessage = 'メールアドレスの形式が正しくありません';
        break;
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * 会社ユーザーのパスワードをリセット（レガシー方式）
 * 注意: Firebase Auth を使用するユーザーには sendPasswordResetEmail を使用すること
 */
export async function resetCompanyUserPassword(userId, newPassword) {
  if (!isAdmin()) {
    return { success: false, error: '権限がありません' };
  }

  if (!firebaseDb) {
    return { success: false, error: 'データベースが初期化されていません' };
  }

  try {
    // ユーザー情報を取得してレガシーかどうか確認
    const userDoc = await firebaseDb.collection('company_users').doc(userId).get();

    if (!userDoc.exists) {
      return { success: false, error: 'ユーザーが見つかりません' };
    }

    const userData = userDoc.data();

    // Firebase Auth ユーザーの場合はメールリセットを使用
    if (userData.email && !userData._legacyAuth) {
      return await sendPasswordResetEmail(userData.email);
    }

    // レガシーユーザーの場合は直接更新
    await firebaseDb.collection('company_users').doc(userId).update({
      password: newPassword,
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

/**
 * 既存ユーザーを Firebase Auth に移行（管理者のみ）
 * Cloud Function を呼び出して一括移行
 */
export async function migrateUsersToFirebaseAuth() {
  if (!isAdmin()) {
    return { success: false, error: '権限がありません' };
  }

  try {
    const token = await getIdToken();
    const response = await fetch(`${config.cloudFunctionsBaseUrl}/migrateCompanyUsersToFirebaseAuth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({})
    });

    return await response.json();
  } catch (error) {
    console.error('Failed to migrate users:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ユーザーのメールアドレスを取得（UIDから）
 */
export async function getCompanyUserEmail(userId) {
  if (!firebaseDb) return null;

  try {
    const userDoc = await firebaseDb.collection('company_users').doc(userId).get();
    if (userDoc.exists) {
      return userDoc.data().email || null;
    }
    return null;
  } catch (error) {
    console.error('Failed to get user email:', error);
    return null;
  }
}

/**
 * 管理者ユーザー一覧を取得
 */
export async function getAdminUsers() {
  if (!firebaseDb) return [];

  // 認証チェック（Firebase Auth経由のadminのみ）
  if (!currentUser) {
    console.warn('[Admin] Not authenticated with Firebase Auth');
    return [];
  }

  try {
    const snapshot = await firebaseDb.collection('admin_users')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || null
    }));
  } catch (error) {
    console.error('Failed to get admin users:', error);
    return [];
  }
}

/**
 * 管理者ユーザーを削除
 */
export async function deleteAdminUser(userId) {
  if (!firebaseDb || !currentUser) {
    return { success: false, error: '認証されていません' };
  }

  // 自分自身は削除できない
  if (userId === currentUser.uid) {
    return { success: false, error: '自分自身を削除することはできません' };
  }

  try {
    await firebaseDb.collection('admin_users').doc(userId).delete();
    return { success: true };
  } catch (error) {
    console.error('Failed to delete admin user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 管理者ユーザーを追加（メールアドレスで仮登録）
 * ※ 実際のUIDは初回Googleログイン時に紐付けられる
 */
export async function addAdminUserByEmail(email) {
  if (!firebaseDb || !currentUser) {
    return { success: false, error: '認証されていません' };
  }

  if (!email || !email.includes('@')) {
    return { success: false, error: '有効なメールアドレスを入力してください' };
  }

  try {
    // 既存のemailチェック
    const existing = await firebaseDb.collection('admin_users')
      .where('email', '==', email)
      .get();

    if (!existing.empty) {
      return { success: false, error: 'このメールアドレスは既に登録されています' };
    }

    // emailベースで仮登録（UIDはログイン時に更新）
    const docRef = await firebaseDb.collection('admin_users').add({
      email: email,
      role: USER_ROLES.ADMIN,
      companyDomain: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUser.email
    });

    return { success: true, id: docRef.id, email };
  } catch (error) {
    console.error('Failed to add admin user:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// Admin用：会社ビューモード機能
// ============================================

/**
 * Admin用: 会社ビューモードに入る
 * 任意の会社を選択して、その会社の視点でダッシュボードを表示
 * @param {string} companyDomain - 会社ドメイン
 * @param {string} companyName - 会社名（表示用）
 */
export function enterCompanyViewMode(companyDomain, companyName = '') {
  if (!isAdmin()) {
    console.warn('[Auth] Only admins can enter company view mode');
    return false;
  }

  sessionStorage.setItem('company_view_mode', 'true');
  sessionStorage.setItem('company_view_domain', companyDomain);
  sessionStorage.setItem('company_view_name', companyName || companyDomain);

  // 一時的にcompanyDomainをセット（元のadmin権限は保持）
  userCompanyDomain = companyDomain;
  sessionStorage.setItem(config.userCompanyKey, companyDomain);

  console.log('[Auth] Entered company view mode:', companyDomain);

  // イベント発火
  const event = new CustomEvent('companyViewModeChanged', {
    detail: { active: true, companyDomain, companyName: companyName || companyDomain }
  });
  document.dispatchEvent(event);

  return true;
}

/**
 * Admin用: 会社ビューモードを終了
 */
export function exitCompanyViewMode() {
  if (!isInCompanyViewMode()) {
    return false;
  }

  sessionStorage.removeItem('company_view_mode');
  sessionStorage.removeItem('company_view_domain');
  sessionStorage.removeItem('company_view_name');
  sessionStorage.removeItem(config.userCompanyKey);

  userCompanyDomain = null;

  console.log('[Auth] Exited company view mode');

  // イベント発火
  const event = new CustomEvent('companyViewModeChanged', {
    detail: { active: false }
  });
  document.dispatchEvent(event);

  return true;
}

/**
 * 会社ビューモード中かどうか
 */
export function isInCompanyViewMode() {
  return sessionStorage.getItem('company_view_mode') === 'true';
}

/**
 * 会社ビューモード中の会社情報を取得
 */
export function getCompanyViewInfo() {
  if (!isInCompanyViewMode()) {
    return null;
  }
  return {
    companyDomain: sessionStorage.getItem('company_view_domain'),
    companyName: sessionStorage.getItem('company_view_name')
  };
}

/**
 * 全ての会社一覧を取得（Admin用）
 */
export async function getAllCompanies() {
  if (!isAdmin()) {
    return [];
  }

  if (!firebaseDb) {
    return [];
  }

  try {
    const snapshot = await firebaseDb.collection('companies').get();
    const companies = [];
    snapshot.forEach(doc => {
      companies.push({
        id: doc.id,
        domain: doc.data().domain || doc.id,
        name: doc.data().name || doc.data().companyName || doc.id,
        ...doc.data()
      });
    });
    return companies;
  } catch (error) {
    console.error('[Auth] Failed to get all companies:', error);
    return [];
  }
}

export default {
  initFirebase,
  checkSession,
  handleLogin,
  handleCompanyLogin,
  handleGoogleLogin,
  confirmCompanySelection,
  switchCompany,
  getAvailableCompanies,
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
  sendPasswordResetEmail,
  generatePassword,
  generateUsername,
  updateLastLogin,
  hasCompanyUser,
  migrateUsersToFirebaseAuth,
  getCompanyUserEmail,
  getAdminUsers,
  deleteAdminUser,
  addAdminUserByEmail,
  addCompanyStaff,
  deleteCompanyStaff,
  // 会社ビューモード
  enterCompanyViewMode,
  exitCompanyViewMode,
  isInCompanyViewMode,
  getCompanyViewInfo,
  getAllCompanies,
  USER_ROLES
};
