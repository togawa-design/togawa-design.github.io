/**
 * User Auth - 認証サービス
 * Firebase Authenticationを使用したユーザー認証
 */

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyB3eXZoFkXOwnHxPvaHiWO7csmZK4KGqAQ",
  authDomain: "generated-area-484613-e3-90bd4.firebaseapp.com",
  projectId: "generated-area-484613-e3-90bd4"
};

// セッションキー（管理者と分離）
const USER_SESSION_KEY = 'rikueko_user_session';

let firebaseAuth = null;
let firebaseDb = null;
let currentUser = null;
let idToken = null;
let authStateListeners = [];

/**
 * Firebase初期化
 */
export function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn('[UserAuth] Firebase SDK not loaded');
    return false;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  firebaseAuth = firebase.auth();
  firebaseDb = firebase.firestore();

  // 認証状態の監視
  firebaseAuth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      try {
        idToken = await user.getIdToken();
        sessionStorage.setItem(USER_SESSION_KEY, 'authenticated');

        // Firestoreにユーザー情報がなければ作成
        await ensureUserDocument(user);

        // リスナーに通知
        notifyAuthStateChange(user);
      } catch (e) {
        console.error('[UserAuth] Failed to get ID token:', e);
      }
    } else {
      currentUser = null;
      idToken = null;
      sessionStorage.removeItem(USER_SESSION_KEY);
      notifyAuthStateChange(null);
    }
  });

  return true;
}

/**
 * 認証状態変更リスナーを登録
 */
export function onAuthStateChange(callback) {
  authStateListeners.push(callback);
  // 現在の状態を即座に通知
  if (currentUser !== null || firebaseAuth?.currentUser !== undefined) {
    callback(currentUser);
  }
  return () => {
    authStateListeners = authStateListeners.filter(cb => cb !== callback);
  };
}

/**
 * リスナーに通知
 */
function notifyAuthStateChange(user) {
  authStateListeners.forEach(callback => {
    try {
      callback(user);
    } catch (e) {
      console.error('[UserAuth] Listener error:', e);
    }
  });
}

/**
 * Firestoreにユーザードキュメントを確保
 */
async function ensureUserDocument(user) {
  if (!firebaseDb) return;

  const userRef = firebaseDb.collection('users').doc(user.uid);
  const doc = await userRef.get();

  if (!doc.exists) {
    // 新規ユーザーの場合、ドキュメントを作成
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      photoURL: user.photoURL || null,
      profile: {
        name: user.displayName || '',
        phone: '',
        age: '',
        address: ''
      },
      authProvider: user.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await userRef.set(userData);
    console.log('[UserAuth] Created user document');
  }
}

/**
 * メール/パスワードで新規登録
 */
export async function signUpWithEmail(email, password, displayName) {
  if (!firebaseAuth) {
    return { success: false, error: 'Firebase認証が初期化されていません' };
  }

  try {
    const result = await firebaseAuth.createUserWithEmailAndPassword(email, password);

    // 表示名を更新
    if (displayName) {
      await result.user.updateProfile({ displayName });
    }

    // メール確認を送信
    await result.user.sendEmailVerification();

    return {
      success: true,
      user: result.user,
      message: '確認メールを送信しました。メールを確認してください。'
    };
  } catch (error) {
    console.error('[UserAuth] Sign up error:', error);
    return {
      success: false,
      error: getErrorMessage(error.code)
    };
  }
}

/**
 * メール/パスワードでログイン
 */
export async function signInWithEmail(email, password) {
  if (!firebaseAuth) {
    return { success: false, error: 'Firebase認証が初期化されていません' };
  }

  try {
    const result = await firebaseAuth.signInWithEmailAndPassword(email, password);
    currentUser = result.user;
    idToken = await result.user.getIdToken();

    return { success: true, user: result.user };
  } catch (error) {
    console.error('[UserAuth] Sign in error:', error);
    return {
      success: false,
      error: getErrorMessage(error.code)
    };
  }
}

/**
 * Googleでログイン
 */
export async function signInWithGoogle() {
  if (!firebaseAuth) {
    return { success: false, error: 'Firebase認証が初期化されていません' };
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await firebaseAuth.signInWithPopup(provider);
    currentUser = result.user;
    idToken = await result.user.getIdToken();

    // プロフィールの完全性をチェック
    const profile = await getUserProfile();
    const isProfileComplete = checkProfileComplete(profile);

    return {
      success: true,
      user: result.user,
      isProfileComplete,
      needsProfileSetup: !isProfileComplete
    };
  } catch (error) {
    console.error('[UserAuth] Google sign in error:', error);
    return {
      success: false,
      error: getErrorMessage(error.code)
    };
  }
}

/**
 * プロフィールが完全かチェック（名前、電話番号、メールアドレス）
 */
export function checkProfileComplete(profile) {
  if (!profile) return false;

  const name = profile.profile?.name || profile.displayName || '';
  const phone = profile.profile?.phone || '';
  const email = profile.email || '';

  return !!(name.trim() && phone.trim() && email.trim());
}

/**
 * ログアウト
 */
export async function signOut() {
  if (!firebaseAuth) return;

  try {
    await firebaseAuth.signOut();
    currentUser = null;
    idToken = null;
    sessionStorage.removeItem(USER_SESSION_KEY);
    return { success: true };
  } catch (error) {
    console.error('[UserAuth] Sign out error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * パスワードリセットメールを送信
 */
export async function sendPasswordReset(email) {
  if (!firebaseAuth) {
    return { success: false, error: 'Firebase認証が初期化されていません' };
  }

  try {
    await firebaseAuth.sendPasswordResetEmail(email);
    return {
      success: true,
      message: 'パスワードリセットメールを送信しました'
    };
  } catch (error) {
    console.error('[UserAuth] Password reset error:', error);
    return {
      success: false,
      error: getErrorMessage(error.code)
    };
  }
}

/**
 * パスワードを変更
 */
export async function updatePassword(newPassword) {
  if (!currentUser) {
    return { success: false, error: 'ログインしていません' };
  }

  try {
    await currentUser.updatePassword(newPassword);
    return { success: true, message: 'パスワードを変更しました' };
  } catch (error) {
    console.error('[UserAuth] Update password error:', error);
    return {
      success: false,
      error: getErrorMessage(error.code)
    };
  }
}

/**
 * ユーザープロフィールを更新
 */
export async function updateUserProfile(profileData) {
  if (!currentUser || !firebaseDb) {
    return { success: false, error: 'ログインしていません' };
  }

  try {
    const userRef = firebaseDb.collection('users').doc(currentUser.uid);
    await userRef.update({
      ...profileData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Firebase Authの表示名も更新
    if (profileData.displayName || profileData.profile?.name) {
      await currentUser.updateProfile({
        displayName: profileData.displayName || profileData.profile?.name
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[UserAuth] Update profile error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Firestoreからユーザープロフィールを取得
 */
export async function getUserProfile() {
  if (!currentUser || !firebaseDb) {
    return null;
  }

  try {
    const doc = await firebaseDb.collection('users').doc(currentUser.uid).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error('[UserAuth] Get profile error:', error);
    return null;
  }
}

/**
 * 現在のユーザーを取得
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * セッションを確認
 */
export function checkSession() {
  return !!sessionStorage.getItem(USER_SESSION_KEY);
}

/**
 * IDトークンを取得
 */
export function getIdToken() {
  return idToken;
}

/**
 * Firestoreインスタンスを取得
 */
export function getFirestore() {
  return firebaseDb;
}

/**
 * エラーメッセージを日本語に変換
 */
function getErrorMessage(errorCode) {
  const messages = {
    'auth/email-already-in-use': 'このメールアドレスは既に登録されています',
    'auth/invalid-email': 'メールアドレスの形式が正しくありません',
    'auth/operation-not-allowed': 'この操作は許可されていません',
    'auth/weak-password': 'パスワードは6文字以上で設定してください',
    'auth/user-disabled': 'このアカウントは無効になっています',
    'auth/user-not-found': 'アカウントが見つかりません',
    'auth/wrong-password': 'パスワードが正しくありません',
    'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません',
    'auth/too-many-requests': 'リクエストが多すぎます。しばらくしてからお試しください',
    'auth/popup-closed-by-user': 'ログインがキャンセルされました',
    'auth/requires-recent-login': '再度ログインしてください'
  };

  return messages[errorCode] || 'エラーが発生しました。もう一度お試しください';
}

export default {
  initFirebase,
  onAuthStateChange,
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  sendPasswordReset,
  updatePassword,
  updateUserProfile,
  getUserProfile,
  getCurrentUser,
  checkSession,
  getIdToken,
  getFirestore,
  checkProfileComplete
};
