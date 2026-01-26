/**
 * User Auth - メインエクスポート
 */

export {
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
  getFirestore
} from './auth-service.js';

export {
  authState,
  initAuthState,
  updateAuthUI,
  getProfile,
  isAuthenticated
} from './auth-state.js';

export {
  initAuthModal,
  showAuthModal,
  closeAuthModal
} from './auth-modal.js';

/**
 * ユーザー認証機能を初期化
 */
export function initUserAuth() {
  import('./auth-state.js').then(({ initAuthState }) => {
    initAuthState();
  });
  import('./auth-modal.js').then(({ initAuthModal }) => {
    initAuthModal();
  });
}

export default {
  initUserAuth
};
