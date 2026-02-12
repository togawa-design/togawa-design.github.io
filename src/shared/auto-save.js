/**
 * 自動保存モジュール
 * フォームの内容をlocalStorageに定期的に保存し、復元機能を提供
 */

import { showConfirmDialog } from '@shared/modal.js';
import { showToast } from '@shared/utils.js';

/**
 * デフォルト設定
 */
const DEFAULT_OPTIONS = {
  interval: 30000, // 30秒
  prefix: 'admin_draft',
  showRestorePrompt: true,
  onSave: null,
  onRestore: null
};

/**
 * アクティブな自動保存インスタンスを管理
 */
const activeInstances = new Map();

/**
 * localStorageキーを生成
 * @param {string} formId - フォーム識別子
 * @param {string} targetId - 対象ID（求人IDなど）
 * @param {string} prefix - プレフィックス
 * @returns {string} - ストレージキー
 */
function getStorageKey(formId, targetId, prefix) {
  return `${prefix}_${formId}_${targetId || 'new'}`;
}

/**
 * フォームデータを取得
 * @param {HTMLFormElement} form - フォーム要素
 * @returns {Object} - フォームデータ
 */
function getFormData(form) {
  const formData = new FormData(form);
  const data = {};

  for (const [key, value] of formData.entries()) {
    // 同じキーが複数ある場合（チェックボックスなど）は配列に
    if (data[key] !== undefined) {
      if (!Array.isArray(data[key])) {
        data[key] = [data[key]];
      }
      data[key].push(value);
    } else {
      data[key] = value;
    }
  }

  // input[type="checkbox"] の未チェック状態も保存
  form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    if (!formData.has(checkbox.name)) {
      data[checkbox.name] = false;
    }
  });

  return data;
}

/**
 * フォームにデータを復元
 * @param {HTMLFormElement} form - フォーム要素
 * @param {Object} data - 復元するデータ
 */
function restoreFormData(form, data) {
  for (const [key, value] of Object.entries(data)) {
    const elements = form.querySelectorAll(`[name="${key}"]`);

    elements.forEach(element => {
      if (element.type === 'checkbox') {
        element.checked = value === true || value === 'on' || value === element.value;
      } else if (element.type === 'radio') {
        element.checked = element.value === value;
      } else if (element.tagName === 'SELECT') {
        if (Array.isArray(value)) {
          Array.from(element.options).forEach(option => {
            option.selected = value.includes(option.value);
          });
        } else {
          element.value = value;
        }
      } else {
        element.value = value;
      }

      // 変更イベントを発火
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
}

/**
 * 下書きを保存
 * @param {string} key - ストレージキー
 * @param {Object} data - 保存するデータ
 */
function saveDraft(key, data) {
  try {
    const draft = {
      data,
      savedAt: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch (error) {
    console.warn('下書き保存に失敗:', error);
    return false;
  }
}

/**
 * 下書きを取得
 * @param {string} key - ストレージキー
 * @returns {Object|null} - 下書きデータ
 */
function getDraft(key) {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const draft = JSON.parse(item);

    // 24時間以上古い下書きは削除
    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - draft.savedAt > maxAge) {
      localStorage.removeItem(key);
      return null;
    }

    return draft;
  } catch (error) {
    console.warn('下書き取得に失敗:', error);
    return null;
  }
}

/**
 * 下書きを削除
 * @param {string} key - ストレージキー
 */
function clearDraft(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('下書き削除に失敗:', error);
  }
}

/**
 * 自動保存を設定
 * @param {HTMLFormElement} form - フォーム要素
 * @param {string} formId - フォーム識別子
 * @param {string} targetId - 対象ID
 * @param {Object} options - オプション
 * @returns {Object} - { cleanup, save, clear, restore }
 */
export function setupAutoSave(form, formId, targetId = null, options = {}) {
  if (!form) {
    return {
      cleanup: () => {},
      save: () => {},
      clear: () => {},
      restore: () => false
    };
  }

  const config = { ...DEFAULT_OPTIONS, ...options };
  const key = getStorageKey(formId, targetId, config.prefix);

  // 既存のインスタンスがあればクリーンアップ
  if (activeInstances.has(key)) {
    activeInstances.get(key).cleanup();
  }

  let intervalId = null;
  let lastSavedData = null;

  /**
   * 手動で保存
   */
  const save = () => {
    const data = getFormData(form);
    const dataStr = JSON.stringify(data);

    // 変更がない場合はスキップ
    if (dataStr === lastSavedData) return false;

    const success = saveDraft(key, data);
    if (success) {
      lastSavedData = dataStr;
      if (config.onSave) config.onSave(data);
    }
    return success;
  };

  /**
   * 下書きをクリア
   */
  const clear = () => {
    clearDraft(key);
    lastSavedData = null;
  };

  /**
   * 下書きを復元（確認ダイアログ付き）
   */
  const restore = async () => {
    const draft = getDraft(key);
    if (!draft) return false;

    if (config.showRestorePrompt) {
      const savedTime = new Date(draft.savedAt).toLocaleString('ja-JP');
      const confirmed = await showConfirmDialog({
        title: '下書きの復元',
        message: `${savedTime} に保存された下書きがあります。復元しますか？`,
        confirmText: '復元する',
        cancelText: '破棄する',
        type: 'info'
      });

      if (!confirmed) {
        clear();
        return false;
      }
    }

    restoreFormData(form, draft.data);
    if (config.onRestore) config.onRestore(draft.data);
    showToast('下書きを復元しました', 'info');
    return true;
  };

  /**
   * サイレント復元（確認なし）
   */
  const silentRestore = () => {
    const draft = getDraft(key);
    if (!draft) return false;

    restoreFormData(form, draft.data);
    if (config.onRestore) config.onRestore(draft.data);
    return true;
  };

  /**
   * 自動保存を開始
   */
  const start = () => {
    if (intervalId) return;

    intervalId = setInterval(() => {
      save();
    }, config.interval);

    // フォーム送信時に下書きをクリア
    form.addEventListener('submit', clear);
  };

  /**
   * 自動保存を停止
   */
  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  /**
   * クリーンアップ
   */
  const cleanup = () => {
    stop();
    form.removeEventListener('submit', clear);
    activeInstances.delete(key);
  };

  // 自動保存を開始
  start();

  // インスタンスを登録
  const instance = { cleanup, save, clear, restore, silentRestore, start, stop };
  activeInstances.set(key, instance);

  return instance;
}

/**
 * 既存の下書きがあるか確認
 * @param {string} formId - フォーム識別子
 * @param {string} targetId - 対象ID
 * @param {string} prefix - プレフィックス
 * @returns {boolean}
 */
export function hasDraft(formId, targetId = null, prefix = 'admin_draft') {
  const key = getStorageKey(formId, targetId, prefix);
  return getDraft(key) !== null;
}

/**
 * すべての下書きをクリア
 * @param {string} prefix - プレフィックス
 */
export function clearAllDrafts(prefix = 'admin_draft') {
  const keysToRemove = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * すべてのアクティブな自動保存をクリーンアップ
 */
export function cleanupAllAutoSave() {
  activeInstances.forEach(instance => instance.cleanup());
  activeInstances.clear();
}

export default {
  setupAutoSave,
  hasDraft,
  clearAllDrafts,
  cleanupAllAutoSave
};
