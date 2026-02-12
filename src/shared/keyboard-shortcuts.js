/**
 * キーボードショートカットモジュール
 * モーダル内でのCtrl+S保存、Escapeでのモーダル閉じ等
 */

/**
 * アクティブなショートカットハンドラを管理
 */
const activeHandlers = new Map();

/**
 * キーボードショートカットを初期化
 * @param {Object} options - オプション
 * @param {Function} options.onSave - Ctrl/Cmd+S 押下時のコールバック
 * @param {Function} options.onEscape - Escape 押下時のコールバック
 * @param {HTMLElement} options.scope - スコープ要素（デフォルト: document）
 * @returns {Function} - クリーンアップ関数
 */
export function initKeyboardShortcuts(options = {}) {
  const { onSave, onEscape, scope = document } = options;

  const handler = (e) => {
    // Ctrl/Cmd + S で保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (onSave) {
        onSave(e);
      }
    }

    // Escape でモーダルを閉じる
    if (e.key === 'Escape') {
      // 入力中のフィールドからフォーカスを外さない場合のみ
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT'
      );

      // 入力フィールドにフォーカスがある場合は、まずフォーカスを外す
      if (isInputFocused) {
        activeElement.blur();
        return;
      }

      if (onEscape) {
        onEscape(e);
      }
    }
  };

  scope.addEventListener('keydown', handler);

  // クリーンアップ関数を返す
  return () => {
    scope.removeEventListener('keydown', handler);
  };
}

/**
 * モーダル用のショートカットを設定
 * @param {HTMLElement} modal - モーダル要素
 * @param {Object} options - オプション
 * @param {Function} options.onSave - 保存コールバック
 * @param {Function} options.onClose - 閉じるコールバック
 * @returns {Function} - クリーンアップ関数
 */
export function setupModalShortcuts(modal, options = {}) {
  const { onSave, onClose } = options;

  if (!modal) return () => {};

  // 既存のハンドラがあれば削除
  if (activeHandlers.has(modal)) {
    activeHandlers.get(modal)();
    activeHandlers.delete(modal);
  }

  const cleanup = initKeyboardShortcuts({
    onSave: () => {
      // モーダルが表示されている場合のみ実行
      if (modal.style.display !== 'none' && !modal.classList.contains('hidden')) {
        if (onSave) onSave();
      }
    },
    onEscape: () => {
      // モーダルが表示されている場合のみ実行
      if (modal.style.display !== 'none' && !modal.classList.contains('hidden')) {
        if (onClose) onClose();
      }
    },
    scope: modal
  });

  activeHandlers.set(modal, cleanup);

  return cleanup;
}

/**
 * グローバルなEscapeハンドラを設定（開いているモーダルを閉じる）
 * @param {Function} getActiveModal - アクティブなモーダルを取得する関数
 * @param {Function} closeModal - モーダルを閉じる関数
 * @returns {Function} - クリーンアップ関数
 */
export function setupGlobalEscapeHandler(getActiveModal, closeModal) {
  const handler = (e) => {
    if (e.key === 'Escape') {
      const modal = getActiveModal();
      if (modal) {
        e.preventDefault();
        closeModal(modal);
      }
    }
  };

  document.addEventListener('keydown', handler);

  return () => {
    document.removeEventListener('keydown', handler);
  };
}

/**
 * フォーム用のCtrl+S保存ショートカットを設定
 * @param {HTMLFormElement} form - フォーム要素
 * @param {Function} onSave - 保存コールバック
 * @returns {Function} - クリーンアップ関数
 */
export function setupFormSaveShortcut(form, onSave) {
  if (!form) return () => {};

  const handler = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (onSave) onSave();
    }
  };

  form.addEventListener('keydown', handler);

  return () => {
    form.removeEventListener('keydown', handler);
  };
}

/**
 * すべてのアクティブなハンドラをクリーンアップ
 */
export function cleanupAllShortcuts() {
  activeHandlers.forEach((cleanup) => cleanup());
  activeHandlers.clear();
}

export default {
  initKeyboardShortcuts,
  setupModalShortcuts,
  setupGlobalEscapeHandler,
  setupFormSaveShortcut,
  cleanupAllShortcuts
};
