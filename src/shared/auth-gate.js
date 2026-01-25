/**
 * 簡易認証ゲート
 * 開発中のサイトへのアクセス制限用
 * リリース時に削除すること
 */

const AUTH_CONFIG = {
  password: 'rikueko2025',  // パスワード（変更推奨）
  storageKey: 'rikueko_auth',
  expiryHours: 24  // 認証の有効期限（時間）
};

/**
 * 認証状態をチェック
 */
function isAuthenticated() {
  const auth = localStorage.getItem(AUTH_CONFIG.storageKey);
  if (!auth) return false;

  try {
    const { expiry } = JSON.parse(auth);
    if (Date.now() > expiry) {
      localStorage.removeItem(AUTH_CONFIG.storageKey);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 認証を保存
 */
function saveAuth() {
  const expiry = Date.now() + (AUTH_CONFIG.expiryHours * 60 * 60 * 1000);
  localStorage.setItem(AUTH_CONFIG.storageKey, JSON.stringify({ expiry }));
}

/**
 * 認証モーダルを表示
 */
function showAuthModal() {
  // 既に認証済みなら何もしない
  if (isAuthenticated()) return;

  // モーダルのスタイル
  const style = document.createElement('style');
  style.textContent = `
    .auth-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
    }
    .auth-modal {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      max-width: 400px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .auth-modal h2 {
      margin: 0 0 0.5rem;
      color: #1a1a2e;
      font-size: 1.5rem;
    }
    .auth-modal p {
      margin: 0 0 1.5rem;
      color: #666;
      font-size: 0.9rem;
    }
    .auth-modal input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 1rem;
      margin-bottom: 1rem;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    .auth-modal input:focus {
      outline: none;
      border-color: #6366f1;
    }
    .auth-modal input.error {
      border-color: #ef4444;
      animation: shake 0.3s;
    }
    .auth-modal button {
      width: 100%;
      padding: 12px 24px;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .auth-modal button:hover {
      background: #4f46e5;
    }
    .auth-error {
      color: #ef4444;
      font-size: 0.85rem;
      margin-top: -0.5rem;
      margin-bottom: 1rem;
      display: none;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
  `;
  document.head.appendChild(style);

  // モーダル要素
  const overlay = document.createElement('div');
  overlay.className = 'auth-overlay';
  overlay.innerHTML = `
    <div class="auth-modal">
      <h2>開発中サイト</h2>
      <p>このサイトは現在開発中です。<br>アクセスにはパスワードが必要です。</p>
      <input type="password" id="auth-password" placeholder="パスワードを入力" autocomplete="off">
      <p class="auth-error" id="auth-error">パスワードが正しくありません</p>
      <button type="button" id="auth-submit">アクセスする</button>
    </div>
  `;
  document.body.appendChild(overlay);

  // ページのスクロールを無効化
  document.body.style.overflow = 'hidden';

  const input = document.getElementById('auth-password');
  const button = document.getElementById('auth-submit');
  const error = document.getElementById('auth-error');

  function tryAuth() {
    const password = input.value;
    if (password === AUTH_CONFIG.password) {
      saveAuth();
      overlay.remove();
      style.remove();
      document.body.style.overflow = '';
    } else {
      input.classList.add('error');
      error.style.display = 'block';
      setTimeout(() => {
        input.classList.remove('error');
      }, 300);
    }
  }

  button.addEventListener('click', tryAuth);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryAuth();
  });

  // 入力時にエラー表示をリセット
  input.addEventListener('input', () => {
    error.style.display = 'none';
  });

  // フォーカスを当てる
  setTimeout(() => input.focus(), 100);
}

// ページ読み込み時に認証チェック
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', showAuthModal);
} else {
  showAuthModal();
}

export { isAuthenticated, showAuthModal };
