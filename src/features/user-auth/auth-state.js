/**
 * User Auth - 認証状態管理
 * ヘッダーUIの更新とグローバル認証状態の管理
 */

import {
  initFirebase,
  onAuthStateChange,
  signOut,
  getCurrentUser,
  getUserProfile
} from './auth-service.js';

// 認証状態
export const authState = {
  user: null,
  profile: null,
  isAuthenticated: false,
  isLoading: true
};

/**
 * 認証状態を初期化
 */
export function initAuthState() {
  // Firebase初期化
  const initialized = initFirebase();
  if (!initialized) {
    authState.isLoading = false;
    return;
  }

  // 認証状態の変更を監視
  onAuthStateChange(async (user) => {
    authState.user = user;
    authState.isAuthenticated = !!user;
    authState.isLoading = false;

    if (user) {
      // プロフィールを取得
      authState.profile = await getUserProfile();
    } else {
      authState.profile = null;
    }

    // UIを更新
    updateAuthUI();
  });
}

/**
 * ヘッダーの認証UIを更新
 */
export function updateAuthUI() {
  const headerActions = document.querySelector('.header-actions');
  if (!headerActions) return;

  // 既存のユーザーメニューまたはログインボタンを削除
  const existingUserMenu = headerActions.querySelector('.user-menu');
  const existingLoginBtn = headerActions.querySelector('.btn-user-login');
  if (existingUserMenu) existingUserMenu.remove();
  if (existingLoginBtn) existingLoginBtn.remove();

  if (authState.isAuthenticated && authState.user) {
    // ログイン済み: ユーザーメニューを表示
    const userMenu = createUserMenu(authState.user, authState.profile);
    headerActions.appendChild(userMenu);
  } else {
    // 未ログイン: ログインボタンを表示
    const loginBtn = document.createElement('button');
    loginBtn.id = 'btn-user-login';
    loginBtn.className = 'btn-user-login';
    loginBtn.textContent = 'ログイン';
    loginBtn.addEventListener('click', () => {
      // 認証モーダルを開く
      const event = new CustomEvent('openAuthModal', { detail: { mode: 'login' } });
      document.dispatchEvent(event);
    });
    headerActions.appendChild(loginBtn);
  }
}

/**
 * ユーザーメニューを作成
 */
function createUserMenu(user, profile) {
  const displayName = profile?.displayName || profile?.profile?.name || user.displayName || 'ユーザー';
  const photoURL = user.photoURL || null;

  const menu = document.createElement('div');
  menu.className = 'user-menu';
  menu.innerHTML = `
    <button class="user-menu-trigger" aria-expanded="false" aria-haspopup="true">
      ${photoURL
        ? `<img src="${photoURL}" alt="" class="user-avatar">`
        : `<span class="user-avatar-placeholder">${displayName.charAt(0)}</span>`
      }
      <span class="user-name">${escapeHtml(displayName)}</span>
      <svg class="user-menu-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <div class="user-dropdown" role="menu">
      <a href="mypage.html" class="user-dropdown-item" role="menuitem">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 8C10.21 8 12 6.21 12 4C12 1.79 10.21 0 8 0C5.79 0 4 1.79 4 4C4 6.21 5.79 8 8 8ZM8 10C5.33 10 0 11.34 0 14V16H16V14C16 11.34 10.67 10 8 10Z" fill="currentColor"/>
        </svg>
        マイページ
      </a>
      <a href="mypage.html#favorites" class="user-dropdown-item" role="menuitem">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 14L6.84 12.94C2.72 9.18 0 6.72 0 3.72C0 1.26 1.98 -0.72 4.44 -0.72C5.82 -0.72 7.14 -0.08 8 0.9C8.86 -0.08 10.18 -0.72 11.56 -0.72C14.02 -0.72 16 1.26 16 3.72C16 6.72 13.28 9.18 9.16 12.94L8 14Z" fill="currentColor" transform="translate(0, 1.72)"/>
        </svg>
        お気に入り
      </a>
      <a href="mypage.html#applications" class="user-dropdown-item" role="menuitem">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M14 2H10.82C10.4 0.84 9.3 0 8 0C6.7 0 5.6 0.84 5.18 2H2C0.9 2 0 2.9 0 4V14C0 15.1 0.9 16 2 16H14C15.1 16 16 15.1 16 14V4C16 2.9 15.1 2 14 2ZM8 2C8.55 2 9 2.45 9 3C9 3.55 8.55 4 8 4C7.45 4 7 3.55 7 3C7 2.45 7.45 2 8 2ZM10 12H4V10H10V12ZM12 8H4V6H12V8Z" fill="currentColor"/>
        </svg>
        応募履歴
      </a>
      <div class="user-dropdown-divider"></div>
      <button class="user-dropdown-item user-dropdown-logout" id="btn-user-logout" role="menuitem">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 10.67L14.67 8L12 5.33V8H6V10H12V10.67ZM14 0H2C0.89 0 0 0.9 0 2V6H2V2H14V14H2V10H0V14C0 15.1 0.89 16 2 16H14C15.1 16 16 15.1 16 14V2C16 0.9 15.1 0 14 0Z" fill="currentColor"/>
        </svg>
        ログアウト
      </button>
    </div>
  `;

  // ドロップダウンのトグル
  const trigger = menu.querySelector('.user-menu-trigger');
  const dropdown = menu.querySelector('.user-dropdown');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('is-open');
    dropdown.classList.toggle('is-open');
    trigger.setAttribute('aria-expanded', !isOpen);
  });

  // 外側クリックで閉じる
  document.addEventListener('click', () => {
    dropdown.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  });

  // ログアウトボタン
  const logoutBtn = menu.querySelector('#btn-user-logout');
  logoutBtn.addEventListener('click', async () => {
    await signOut();
    window.location.reload();
  });

  return menu;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 現在のプロフィールを取得
 */
export function getProfile() {
  return authState.profile;
}

/**
 * 認証済みかどうかを確認
 */
export function isAuthenticated() {
  return authState.isAuthenticated;
}

export default {
  authState,
  initAuthState,
  updateAuthUI,
  getProfile,
  isAuthenticated
};
