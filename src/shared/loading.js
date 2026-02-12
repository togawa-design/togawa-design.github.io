/**
 * ローディング状態管理モジュール
 * ボタン、オーバーレイ、スケルトンUIの共通実装
 */

// スタイルを動的に追加
function ensureStyles() {
  if (document.getElementById('loading-component-styles')) return;

  const style = document.createElement('style');
  style.id = 'loading-component-styles';
  style.textContent = `
    /* ボタンローディング */
    .btn-loading {
      position: relative;
      pointer-events: none;
      opacity: 0.7;
    }
    .btn-loading::after {
      content: '';
      position: absolute;
      width: 1em;
      height: 1em;
      top: 50%;
      left: 50%;
      margin-top: -0.5em;
      margin-left: -0.5em;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: btn-spin 0.6s linear infinite;
    }
    @keyframes btn-spin {
      to { transform: rotate(360deg); }
    }

    /* ボタン内スピナー */
    .button-spinner {
      display: inline-block;
      width: 1em;
      height: 1em;
      margin-right: 0.5em;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: btn-spin 0.6s linear infinite;
      vertical-align: middle;
    }
    .button-loading-text {
      vertical-align: middle;
    }
    button.is-loading {
      pointer-events: none;
      opacity: 0.8;
    }

    /* オーバーレイローディング */
    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      border-radius: inherit;
    }
    .loading-overlay-spinner {
      width: 2rem;
      height: 2rem;
      border: 3px solid #e5e7eb;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: btn-spin 0.8s linear infinite;
    }
    .loading-overlay-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    .loading-text {
      color: #6b7280;
      font-size: 0.875rem;
    }
    .loading-spinner {
      width: 2rem;
      height: 2rem;
      border: 3px solid #e5e7eb;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: btn-spin 0.8s linear infinite;
    }
    .loading-spinner-sm {
      width: 1rem;
      height: 1rem;
      border-width: 2px;
    }
    .loading-spinner-lg {
      width: 3rem;
      height: 3rem;
      border-width: 4px;
    }

    /* スケルトンUI */
    .skeleton {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.5s infinite;
      border-radius: 4px;
    }
    .skeleton-text {
      height: 1em;
      margin-bottom: 0.5em;
    }
    .skeleton-text.short {
      width: 60%;
    }
    .skeleton-text:last-child {
      margin-bottom: 0;
    }
    .skeleton-title {
      height: 1.5em;
      width: 70%;
      margin-bottom: 0.75em;
    }
    .skeleton-image {
      width: 100%;
      height: 150px;
      margin-bottom: 1rem;
    }
    .skeleton-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .skeleton-card {
      padding: 1rem;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .skeleton-card-body {
      padding: 0.5rem 0;
    }
    .skeleton-card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .skeleton-row {
      display: flex;
      gap: 1rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .skeleton-cell {
      flex: 1;
      height: 1.5rem;
    }
    .skeleton-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .skeleton-list-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .skeleton-list-content {
      flex: 1;
    }
    .skeleton-table {
      width: 100%;
      border-collapse: collapse;
    }
    .skeleton-table th,
    .skeleton-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #f0f0f0;
    }
    .skeleton-table th .skeleton {
      width: 60%;
    }
    .skeleton-table td .skeleton {
      width: 80%;
    }
    @keyframes skeleton-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ローディング状態 */
    .is-loading {
      pointer-events: none;
    }
    .has-skeleton {
      min-height: 200px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * ボタンをローディング状態にする
 * @param {HTMLButtonElement} button - 対象ボタン
 * @param {string} loadingText - ローディング中のテキスト
 * @returns {Object} - { reset: Function } 復帰用オブジェクト
 */
export function setButtonLoading(button, loadingText = '処理中...') {
  if (!button) return { reset: () => {} };

  ensureStyles();

  const originalText = button.textContent;
  const originalDisabled = button.disabled;

  button.disabled = true;
  button.textContent = loadingText;
  button.classList.add('btn-loading');

  return {
    reset: () => {
      button.disabled = originalDisabled;
      button.textContent = originalText;
      button.classList.remove('btn-loading');
    }
  };
}

/**
 * ボタンをローディング状態に変更（スピナー表示版）
 * @param {HTMLButtonElement} button - ボタン要素
 * @param {string} loadingText - ローディング中のテキスト（デフォルト: '処理中...'）
 * @returns {Object} { originalText, originalDisabled }
 */
export function showButtonLoading(button, loadingText = '処理中...') {
  if (!button) return null;

  ensureStyles();

  const originalText = button.textContent;
  const originalDisabled = button.disabled;
  const originalHtml = button.innerHTML;

  button.disabled = true;
  button.classList.add('is-loading');
  button.innerHTML = `
    <span class="button-spinner"></span>
    <span class="button-loading-text">${loadingText}</span>
  `;

  // 元の状態を保存
  button.dataset.originalText = originalText;
  button.dataset.originalHtml = originalHtml;
  button.dataset.originalDisabled = originalDisabled;

  return { originalText, originalDisabled, originalHtml };
}

/**
 * ボタンのローディング状態を解除
 * @param {HTMLButtonElement} button - ボタン要素
 * @param {string} text - 復帰後のテキスト（省略時は元のテキスト）
 */
export function resetButtonLoading(button, text = null) {
  if (!button) return;

  button.classList.remove('is-loading');

  if (text) {
    button.textContent = text;
  } else if (button.dataset.originalHtml) {
    button.innerHTML = button.dataset.originalHtml;
  } else if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
  }

  // 元のdisabled状態を復元
  if (button.dataset.originalDisabled !== 'true') {
    button.disabled = false;
  }

  // データ属性をクリア
  delete button.dataset.originalText;
  delete button.dataset.originalHtml;
  delete button.dataset.originalDisabled;
}

/**
 * 要素にローディングオーバーレイを表示
 * @param {HTMLElement} element - 対象要素
 * @param {string} text - ローディングテキスト（オプション）
 * @returns {Object} - { remove: Function } 削除用オブジェクト
 */
export function showLoadingOverlay(element, text = '') {
  if (!element) return { remove: () => {} };

  ensureStyles();

  // 既存のオーバーレイを削除
  hideLoadingOverlay(element);

  // 親要素をrelativeに
  const originalPosition = element.style.position;
  if (getComputedStyle(element).position === 'static') {
    element.style.position = 'relative';
    element.dataset.loadingPositionAdded = 'true';
  }

  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';

  if (text) {
    overlay.innerHTML = `
      <div class="loading-overlay-content">
        <div class="loading-spinner"></div>
        <span class="loading-text">${text}</span>
      </div>
    `;
  } else {
    overlay.innerHTML = '<div class="loading-overlay-spinner"></div>';
  }

  element.appendChild(overlay);
  element.classList.add('is-loading');

  return {
    remove: () => {
      hideLoadingOverlay(element);
    }
  };
}

/**
 * 要素からローディングオーバーレイを削除
 * @param {HTMLElement} element - 対象要素
 */
export function hideLoadingOverlay(element) {
  if (!element) return;

  const overlay = element.querySelector('.loading-overlay');
  if (overlay) {
    overlay.remove();
  }

  element.classList.remove('is-loading');

  // 追加したpositionを削除
  if (element.dataset.loadingPositionAdded) {
    element.style.position = '';
    delete element.dataset.loadingPositionAdded;
  }
}

/**
 * スケルトンテーブル行を生成
 * @param {number} rows - 行数
 * @param {number} cols - 列数
 * @returns {string} - HTML文字列
 */
export function createSkeletonTable(rows = 5, cols = 4) {
  ensureStyles();

  let html = '';
  for (let i = 0; i < rows; i++) {
    html += '<tr class="skeleton-row">';
    for (let j = 0; j < cols; j++) {
      html += `<td><div class="skeleton skeleton-cell"></div></td>`;
    }
    html += '</tr>';
  }
  return html;
}

/**
 * テーブル用スケルトンUIを生成（ヘッダー付き）
 * @param {number} rows - 行数
 * @param {number} cols - 列数
 * @returns {string} スケルトンHTML
 */
export function createTableSkeleton(rows = 5, cols = 4) {
  ensureStyles();

  const headerCells = Array(cols).fill('<th><div class="skeleton skeleton-text"></div></th>').join('');
  const bodyCells = Array(cols).fill('<td><div class="skeleton skeleton-text"></div></td>').join('');
  const bodyRows = Array(rows).fill(`<tr>${bodyCells}</tr>`).join('');

  return `
    <table class="skeleton-table">
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `;
}

/**
 * スケルトンカードを生成
 * @param {number} count - カード数
 * @returns {string} - HTML文字列
 */
export function createSkeletonCards(count = 3) {
  ensureStyles();

  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-card">
        <div class="skeleton skeleton-text" style="width: 70%"></div>
        <div class="skeleton skeleton-text" style="width: 90%"></div>
        <div class="skeleton skeleton-text" style="width: 50%"></div>
      </div>
    `;
  }
  return html;
}

/**
 * カード用スケルトンUIを生成（画像付き）
 * @param {number} count - カード数
 * @param {boolean} hasImage - 画像があるか
 * @returns {string} スケルトンHTML
 */
export function createCardSkeleton(count = 3, hasImage = true) {
  ensureStyles();

  const cards = Array(count).fill(`
    <div class="skeleton-card">
      ${hasImage ? '<div class="skeleton skeleton-image"></div>' : ''}
      <div class="skeleton-card-body">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
    </div>
  `).join('');

  return `<div class="skeleton-card-grid">${cards}</div>`;
}

/**
 * リスト用スケルトンUIを生成
 * @param {number} count - 項目数
 * @returns {string} スケルトンHTML
 */
export function createListSkeleton(count = 5) {
  ensureStyles();

  const items = Array(count).fill(`
    <div class="skeleton-list-item">
      <div class="skeleton skeleton-avatar"></div>
      <div class="skeleton-list-content">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
    </div>
  `).join('');

  return `<div class="skeleton-list">${items}</div>`;
}

/**
 * 要素にスケルトンUIを表示
 * @param {HTMLElement} element - 表示先要素
 * @param {string} type - スケルトンタイプ（'table', 'card', 'list'）
 * @param {Object} options - オプション
 */
export function showSkeleton(element, type = 'table', options = {}) {
  if (!element) return;

  ensureStyles();

  let skeletonHtml;

  switch (type) {
    case 'table':
      skeletonHtml = createTableSkeleton(options.rows || 5, options.cols || 4);
      break;
    case 'card':
      skeletonHtml = createCardSkeleton(options.count || 3, options.hasImage !== false);
      break;
    case 'list':
      skeletonHtml = createListSkeleton(options.count || 5);
      break;
    default:
      skeletonHtml = createTableSkeleton();
  }

  element.innerHTML = skeletonHtml;
  element.classList.add('has-skeleton');
}

/**
 * 要素からスケルトンUIを削除
 * @param {HTMLElement} element - 対象要素
 */
export function hideSkeleton(element) {
  if (!element) return;
  element.classList.remove('has-skeleton');
}

/**
 * インラインローディングスピナーを生成
 * @param {string} size - サイズ（'sm', 'md', 'lg'）
 * @returns {string} スピナーHTML
 */
export function createSpinner(size = 'md') {
  ensureStyles();
  return `<span class="loading-spinner loading-spinner-${size}"></span>`;
}

export default {
  setButtonLoading,
  showButtonLoading,
  resetButtonLoading,
  showLoadingOverlay,
  hideLoadingOverlay,
  createSkeletonTable,
  createTableSkeleton,
  createSkeletonCards,
  createCardSkeleton,
  createListSkeleton,
  showSkeleton,
  hideSkeleton,
  createSpinner
};
