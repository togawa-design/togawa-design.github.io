/**
 * 共通モーダルコンポーネント
 * 統一されたデザインのモーダルダイアログを生成
 */

import { escapeHtml } from './utils.js';

/**
 * リスト形式のセレクターモーダルを表示
 * @param {Object} options - モーダル設定
 * @param {string} options.id - モーダルのID
 * @param {string} options.title - モーダルタイトル
 * @param {string} options.description - 説明テキスト
 * @param {Array} options.items - アイテム配列
 * @param {string} options.items[].id - アイテムID
 * @param {string} options.items[].name - アイテム名
 * @param {string} options.items[].description - アイテム説明
 * @param {string} [options.items[].thumbnail] - サムネイル画像URL
 * @param {string} [options.items[].icon] - アイコン（絵文字）
 * @param {string} [options.items[].iconBgColor] - アイコン背景色
 * @param {boolean} [options.items[].disabled] - 無効化フラグ
 * @param {string} [options.items[].disabledText] - 無効時のボタンテキスト
 * @param {string} [options.buttonText] - ボタンテキスト（デフォルト: "追加する"）
 * @param {string} [options.cancelText] - キャンセルボタンテキスト（デフォルト: "キャンセル"）
 * @param {Function} options.onSelect - アイテム選択時のコールバック (itemId) => void
 * @param {Function} [options.onClose] - モーダル閉じる時のコールバック
 * @returns {HTMLElement} モーダル要素
 */
export function showSelectorModal(options) {
  const {
    id = 'selector-modal-' + Date.now(),
    title = 'アイテムを選択',
    description = '選択してください。',
    items = [],
    buttonText = '追加する',
    cancelText = 'キャンセル',
    onSelect,
    onClose
  } = options;

  // 既存のモーダルがあれば削除
  const existingModal = document.getElementById(id);
  if (existingModal) {
    existingModal.remove();
  }

  const modalHtml = `
    <div id="${id}" class="common-modal-overlay">
      <div class="common-modal">
        <div class="common-modal-header">
          <h3>${escapeHtml(title)}</h3>
          <button type="button" class="common-modal-close">&times;</button>
        </div>
        <div class="common-modal-body">
          <p class="common-modal-description">${escapeHtml(description)}</p>
          <div class="common-modal-list">
            ${items.map(item => renderModalItem(item, buttonText)).join('')}
          </div>
        </div>
        <div class="common-modal-footer">
          <button type="button" class="common-modal-cancel">${escapeHtml(cancelText)}</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.getElementById(id);

  // 閉じる関数
  const closeModal = () => {
    modal.remove();
    if (onClose) onClose();
  };

  // 閉じるボタン
  modal.querySelector('.common-modal-close').addEventListener('click', closeModal);

  // キャンセルボタン
  modal.querySelector('.common-modal-cancel').addEventListener('click', closeModal);

  // オーバーレイクリックで閉じる
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // アイテム選択ボタン
  modal.querySelectorAll('.common-modal-item-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      if (onSelect) {
        onSelect(itemId);
      }
      closeModal();
    });
  });

  return modal;
}

/**
 * モーダルアイテムをレンダリング
 * @param {Object} item - アイテム
 * @param {string} buttonText - ボタンテキスト
 * @returns {string} HTML文字列
 */
function renderModalItem(item, buttonText) {
  const {
    id,
    name,
    description = '',
    thumbnail,
    icon,
    iconBgColor = '#4AA7C0',
    disabled = false,
    disabledText = '追加済み'
  } = item;

  const thumbnailHtml = thumbnail
    ? `<div class="common-modal-item-thumbnail">
         <img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(name)}">
       </div>`
    : icon
      ? `<div class="common-modal-item-thumbnail common-modal-item-icon" style="background-color: ${escapeHtml(iconBgColor)}">
           <span>${icon}</span>
         </div>`
      : '';

  return `
    <div class="common-modal-item ${disabled ? 'disabled' : ''}" data-item-id="${escapeHtml(id)}">
      ${thumbnailHtml}
      <div class="common-modal-item-info">
        <h4 class="common-modal-item-name">${escapeHtml(name)}</h4>
        ${description ? `<p class="common-modal-item-description">${escapeHtml(description)}</p>` : ''}
      </div>
      <button type="button" class="common-modal-item-btn" data-item-id="${escapeHtml(id)}" ${disabled ? 'disabled' : ''}>
        ${disabled ? escapeHtml(disabledText) : escapeHtml(buttonText)}
      </button>
    </div>
  `;
}

/**
 * グリッド形式のセレクターモーダルを表示
 * @param {Object} options - モーダル設定
 * @param {string} options.id - モーダルのID
 * @param {string} options.title - モーダルタイトル
 * @param {string} options.description - 説明テキスト
 * @param {Array} options.items - アイテム配列
 * @param {string} options.items[].id - アイテムID
 * @param {string} options.items[].name - アイテム名
 * @param {string} [options.items[].icon] - アイコン（絵文字）
 * @param {boolean} [options.items[].disabled] - 無効化フラグ
 * @param {string} [options.items[].disabledText] - 無効時のテキスト
 * @param {string} [options.cancelText] - キャンセルボタンテキスト（デフォルト: "キャンセル"）
 * @param {Function} options.onSelect - アイテム選択時のコールバック (itemId) => void
 * @param {Function} [options.onClose] - モーダル閉じる時のコールバック
 * @returns {HTMLElement} モーダル要素
 */
export function showGridSelectorModal(options) {
  const {
    id = 'grid-selector-modal-' + Date.now(),
    title = 'アイテムを選択',
    description = '選択してください。',
    items = [],
    cancelText = 'キャンセル',
    onSelect,
    onClose
  } = options;

  // 既存のモーダルがあれば削除
  const existingModal = document.getElementById(id);
  if (existingModal) {
    existingModal.remove();
  }

  const modalHtml = `
    <div id="${id}" class="common-modal-overlay">
      <div class="common-modal">
        <div class="common-modal-header">
          <h3>${escapeHtml(title)}</h3>
          <button type="button" class="common-modal-close">&times;</button>
        </div>
        <div class="common-modal-body">
          <p class="common-modal-description">${escapeHtml(description)}</p>
          <div class="common-modal-grid">
            ${items.map(item => renderGridItem(item)).join('')}
          </div>
        </div>
        <div class="common-modal-footer">
          <button type="button" class="common-modal-cancel">${escapeHtml(cancelText)}</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.getElementById(id);

  // 閉じる関数
  const closeModal = () => {
    modal.remove();
    if (onClose) onClose();
  };

  // 閉じるボタン
  modal.querySelector('.common-modal-close').addEventListener('click', closeModal);

  // キャンセルボタン
  modal.querySelector('.common-modal-cancel').addEventListener('click', closeModal);

  // オーバーレイクリックで閉じる
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // グリッドアイテムクリック
  modal.querySelectorAll('.common-modal-grid-item:not([disabled])').forEach(item => {
    item.addEventListener('click', () => {
      const itemId = item.dataset.itemId;
      if (onSelect) {
        onSelect(itemId);
      }
      closeModal();
    });
  });

  return modal;
}

/**
 * グリッドアイテムをレンダリング
 * @param {Object} item - アイテム
 * @returns {string} HTML文字列
 */
function renderGridItem(item) {
  const {
    id,
    name,
    icon = '',
    disabled = false,
    disabledText = '追加済み'
  } = item;

  return `
    <div class="common-modal-grid-item ${disabled ? 'disabled' : ''}" data-item-id="${escapeHtml(id)}" ${disabled ? 'disabled' : ''}>
      ${icon ? `<span class="common-modal-grid-icon">${icon}</span>` : ''}
      <span class="common-modal-grid-name">${escapeHtml(name)}</span>
      ${disabled ? `<span class="common-modal-grid-limit">${escapeHtml(disabledText)}</span>` : ''}
    </div>
  `;
}

/**
 * 確認ダイアログを表示
 * @param {Object} options - ダイアログ設定
 * @param {string} options.title - タイトル
 * @param {string} options.message - メッセージ
 * @param {string} [options.confirmText] - 確認ボタンテキスト（デフォルト: "OK"）
 * @param {string} [options.cancelText] - キャンセルボタンテキスト（デフォルト: "キャンセル"）
 * @param {boolean} [options.danger] - 危険なアクションかどうか
 * @returns {Promise<boolean>} 確認結果
 */
export function showConfirmDialog(options) {
  const {
    title = '確認',
    message = '',
    confirmText = 'OK',
    cancelText = 'キャンセル',
    danger = false
  } = options;

  return new Promise((resolve) => {
    const id = 'confirm-dialog-' + Date.now();

    const modalHtml = `
      <div id="${id}" class="common-modal-overlay">
        <div class="common-modal common-modal-sm">
          <div class="common-modal-header">
            <h3>${escapeHtml(title)}</h3>
            <button type="button" class="common-modal-close">&times;</button>
          </div>
          <div class="common-modal-body">
            <p class="common-modal-message">${escapeHtml(message)}</p>
          </div>
          <div class="common-modal-footer common-modal-footer-buttons">
            <button type="button" class="common-modal-cancel">${escapeHtml(cancelText)}</button>
            <button type="button" class="common-modal-confirm ${danger ? 'danger' : ''}">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById(id);

    const closeModal = (result) => {
      modal.remove();
      resolve(result);
    };

    modal.querySelector('.common-modal-close').addEventListener('click', () => closeModal(false));
    modal.querySelector('.common-modal-cancel').addEventListener('click', () => closeModal(false));
    modal.querySelector('.common-modal-confirm').addEventListener('click', () => closeModal(true));

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(false);
      }
    });
  });
}

export default {
  showSelectorModal,
  showGridSelectorModal,
  showConfirmDialog
};
