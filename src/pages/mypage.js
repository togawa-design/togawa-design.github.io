/**
 * マイページ エントリーポイント
 */
import { initMyPage } from '@features/mypage/index.js';
import { initAuthState } from '@features/user-auth/auth-state.js';
import { initAuthModal } from '@features/user-auth/auth-modal.js';

document.addEventListener('DOMContentLoaded', () => {
  // 認証状態を初期化
  initAuthState();
  initAuthModal();

  // マイページを初期化
  initMyPage();
});
