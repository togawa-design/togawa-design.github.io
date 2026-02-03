/**
 * User Auth - 認証モーダル
 * ログイン・新規登録・パスワードリセットのモーダルUI
 */

import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  sendPasswordReset
} from './auth-service.js';

let currentMode = 'login'; // 'login' | 'register' | 'forgot'

/**
 * 認証モーダルを初期化
 */
export function initAuthModal() {
  // モーダルがない場合は作成
  if (!document.getElementById('user-auth-modal')) {
    createAuthModalHTML();
  }

  setupEventListeners();

  // カスタムイベントでモーダルを開く
  document.addEventListener('openAuthModal', (e) => {
    const mode = e.detail?.mode || 'login';
    showAuthModal(mode);
  });
}

/**
 * モーダルHTMLを作成
 */
function createAuthModalHTML() {
  const modalHTML = `
    <div id="user-auth-modal" class="auth-modal-overlay" style="display: none;">
      <div class="auth-modal-content">
        <button class="auth-modal-close" id="auth-modal-close" aria-label="閉じる">&times;</button>

        <!-- ログインフォーム -->
        <div id="auth-login-view" class="auth-view">
          <div class="auth-modal-header">
            <h2>ログイン</h2>
            <p>L-SETにログイン</p>
          </div>

          <form id="login-form" class="auth-form">
            <div class="auth-form-group">
              <label for="login-email">メールアドレス</label>
              <input type="email" id="login-email" name="email" required placeholder="example@mail.com">
            </div>
            <div class="auth-form-group">
              <label for="login-password">パスワード</label>
              <input type="password" id="login-password" name="password" required placeholder="パスワード">
            </div>
            <div class="auth-form-error" id="login-error"></div>
            <button type="submit" class="auth-btn-submit" id="login-submit">ログイン</button>
          </form>

          <div class="auth-divider"><span>または</span></div>

          <button type="button" id="google-login-btn" class="auth-btn-google">
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
              <path fill="#EA4335" d="M8.98 3.58c1.16 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.9z"/>
            </svg>
            Googleでログイン
          </button>

          <div class="auth-links">
            <a href="#" id="show-register-link">アカウントを作成</a>
            <a href="#" id="show-forgot-link">パスワードを忘れた方</a>
          </div>
        </div>

        <!-- 新規登録フォーム -->
        <div id="auth-register-view" class="auth-view" style="display: none;">
          <div class="auth-modal-header">
            <h2>新規登録</h2>
            <p>L-SETに登録</p>
          </div>

          <form id="register-form" class="auth-form">
            <div class="auth-form-group">
              <label for="register-name">お名前</label>
              <input type="text" id="register-name" name="name" required placeholder="山田 太郎">
            </div>
            <div class="auth-form-group">
              <label for="register-email">メールアドレス</label>
              <input type="email" id="register-email" name="email" required placeholder="example@mail.com">
            </div>
            <div class="auth-form-group">
              <label for="register-password">パスワード</label>
              <input type="password" id="register-password" name="password" required placeholder="6文字以上" minlength="6">
            </div>
            <div class="auth-form-group">
              <label for="register-password-confirm">パスワード（確認）</label>
              <input type="password" id="register-password-confirm" name="passwordConfirm" required placeholder="パスワードを再入力">
            </div>
            <div class="auth-form-agreement">
              <label class="auth-checkbox-label">
                <input type="checkbox" id="register-agreement" required>
                <span><a href="#" target="_blank">利用規約</a>と<a href="#" target="_blank">プライバシーポリシー</a>に同意する</span>
              </label>
            </div>
            <div class="auth-form-error" id="register-error"></div>
            <button type="submit" class="auth-btn-submit" id="register-submit">登録する</button>
          </form>

          <div class="auth-divider"><span>または</span></div>

          <button type="button" id="google-register-btn" class="auth-btn-google">
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
              <path fill="#EA4335" d="M8.98 3.58c1.16 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.9z"/>
            </svg>
            Googleで登録
          </button>

          <div class="auth-links">
            <a href="#" id="show-login-link">すでにアカウントをお持ちの方</a>
          </div>
        </div>

        <!-- パスワードリセットフォーム -->
        <div id="auth-forgot-view" class="auth-view" style="display: none;">
          <div class="auth-modal-header">
            <h2>パスワードをリセット</h2>
            <p>登録済みのメールアドレスを入力してください</p>
          </div>

          <form id="forgot-form" class="auth-form">
            <div class="auth-form-group">
              <label for="forgot-email">メールアドレス</label>
              <input type="email" id="forgot-email" name="email" required placeholder="example@mail.com">
            </div>
            <div class="auth-form-error" id="forgot-error"></div>
            <div class="auth-form-success" id="forgot-success"></div>
            <button type="submit" class="auth-btn-submit" id="forgot-submit">リセットメールを送信</button>
          </form>

          <div class="auth-links">
            <a href="#" id="back-to-login-link">ログインに戻る</a>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // 閉じるボタン
  document.getElementById('auth-modal-close')?.addEventListener('click', closeAuthModal);

  // オーバーレイクリックで閉じる
  document.getElementById('user-auth-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('auth-modal-overlay')) {
      closeAuthModal();
    }
  });

  // ESCキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('user-auth-modal')?.style.display !== 'none') {
      closeAuthModal();
    }
  });

  // ビュー切り替えリンク
  document.getElementById('show-register-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchAuthView('register');
  });

  document.getElementById('show-login-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchAuthView('login');
  });

  document.getElementById('show-forgot-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchAuthView('forgot');
  });

  document.getElementById('back-to-login-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchAuthView('login');
  });

  // ログインフォーム送信
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);

  // 新規登録フォーム送信
  document.getElementById('register-form')?.addEventListener('submit', handleRegister);

  // パスワードリセットフォーム送信
  document.getElementById('forgot-form')?.addEventListener('submit', handleForgotPassword);

  // Googleログイン
  document.getElementById('google-login-btn')?.addEventListener('click', handleGoogleAuth);
  document.getElementById('google-register-btn')?.addEventListener('click', handleGoogleAuth);
}

/**
 * モーダルを表示
 */
export function showAuthModal(mode = 'login') {
  const modal = document.getElementById('user-auth-modal');
  if (!modal) return;

  // エラーメッセージをクリア
  clearErrors();

  // ビューを切り替え
  switchAuthView(mode);

  // モーダルを表示
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // 最初の入力フィールドにフォーカス
  setTimeout(() => {
    const firstInput = modal.querySelector('.auth-view:not([style*="display: none"]) input');
    firstInput?.focus();
  }, 100);
}

/**
 * モーダルを閉じる
 */
export function closeAuthModal() {
  const modal = document.getElementById('user-auth-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  // フォームをリセット
  document.getElementById('login-form')?.reset();
  document.getElementById('register-form')?.reset();
  document.getElementById('forgot-form')?.reset();
  clearErrors();
}

/**
 * ビューを切り替え
 */
function switchAuthView(mode) {
  currentMode = mode;

  const views = {
    login: document.getElementById('auth-login-view'),
    register: document.getElementById('auth-register-view'),
    forgot: document.getElementById('auth-forgot-view')
  };

  Object.entries(views).forEach(([key, view]) => {
    if (view) {
      view.style.display = key === mode ? 'block' : 'none';
    }
  });

  clearErrors();
}

/**
 * エラーメッセージをクリア
 */
function clearErrors() {
  document.querySelectorAll('.auth-form-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.auth-form-success').forEach(el => el.textContent = '');
}

/**
 * エラーを表示
 */
function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
  }
}

/**
 * 成功メッセージを表示
 */
function showSuccess(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
  }
}

/**
 * ログイン処理
 */
async function handleLogin(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('login-submit');
  const email = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;

  if (!email || !password) {
    showError('login-error', 'メールアドレスとパスワードを入力してください');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'ログイン中...';

  try {
    const result = await signInWithEmail(email, password);

    if (result.success) {
      closeAuthModal();
      window.location.reload();
    } else {
      showError('login-error', result.error);
    }
  } catch (error) {
    showError('login-error', 'ログインに失敗しました');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'ログイン';
  }
}

/**
 * 新規登録処理
 */
async function handleRegister(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('register-submit');
  const name = document.getElementById('register-name')?.value?.trim();
  const email = document.getElementById('register-email')?.value?.trim();
  const password = document.getElementById('register-password')?.value;
  const passwordConfirm = document.getElementById('register-password-confirm')?.value;
  const agreement = document.getElementById('register-agreement')?.checked;

  // バリデーション
  if (!name || !email || !password || !passwordConfirm) {
    showError('register-error', 'すべての項目を入力してください');
    return;
  }

  if (password !== passwordConfirm) {
    showError('register-error', 'パスワードが一致しません');
    return;
  }

  if (password.length < 6) {
    showError('register-error', 'パスワードは6文字以上で設定してください');
    return;
  }

  if (!agreement) {
    showError('register-error', '利用規約への同意が必要です');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '登録中...';

  try {
    const result = await signUpWithEmail(email, password, name);

    if (result.success) {
      closeAuthModal();
      alert(result.message || '登録が完了しました');
      window.location.reload();
    } else {
      showError('register-error', result.error);
    }
  } catch (error) {
    showError('register-error', '登録に失敗しました');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '登録する';
  }
}

/**
 * パスワードリセット処理
 */
async function handleForgotPassword(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('forgot-submit');
  const email = document.getElementById('forgot-email')?.value?.trim();

  if (!email) {
    showError('forgot-error', 'メールアドレスを入力してください');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '送信中...';

  try {
    const result = await sendPasswordReset(email);

    if (result.success) {
      showSuccess('forgot-success', result.message);
      document.getElementById('forgot-form')?.reset();
    } else {
      showError('forgot-error', result.error);
    }
  } catch (error) {
    showError('forgot-error', '送信に失敗しました');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'リセットメールを送信';
  }
}

/**
 * Google認証処理
 */
async function handleGoogleAuth() {
  try {
    const result = await signInWithGoogle();

    if (result.success) {
      closeAuthModal();

      // プロフィールが未完了の場合はマイページへ遷移
      if (result.needsProfileSetup) {
        alert('プロフィール情報を入力してください');
        window.location.href = 'mypage.html#profile';
      } else {
        window.location.reload();
      }
    } else {
      const errorId = currentMode === 'login' ? 'login-error' : 'register-error';
      showError(errorId, result.error);
    }
  } catch (error) {
    const errorId = currentMode === 'login' ? 'login-error' : 'register-error';
    showError(errorId, 'Googleログインに失敗しました');
  }
}

export default {
  initAuthModal,
  showAuthModal,
  closeAuthModal
};
