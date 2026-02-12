/**
 * フォームUX改善モジュール
 * 進捗インジケーター、文字数カウンター、デバイスプレビュー切替など
 */

/**
 * 進捗インジケーターを初期化
 * @param {Object} config - 設定
 * @param {string} config.containerId - コンテナ要素ID
 * @param {string} config.fillId - プログレスバーのfill要素ID
 * @param {string} config.countId - カウント表示要素ID
 * @param {number} config.totalSections - 総セクション数
 * @param {Function} config.checkComplete - セクション完了をチェックする関数
 */
export function initProgressIndicator(config) {
  const { containerId, fillId, countId, totalSections, checkComplete } = config;

  const fill = document.getElementById(fillId);
  const countEl = document.getElementById(countId);

  if (!fill || !countEl) return { update: () => {} };

  const update = () => {
    const completed = checkComplete();
    const percentage = Math.round((completed / totalSections) * 100);

    fill.style.width = `${percentage}%`;
    countEl.textContent = completed;
  };

  // 初回更新
  update();

  return { update };
}

/**
 * 文字数カウンターを追加
 * @param {HTMLInputElement|HTMLTextAreaElement} input - 入力要素
 * @param {number} maxLength - 最大文字数
 * @param {number} warningThreshold - 警告を出す閾値（0-1）
 */
export function addCharCounter(input, maxLength, warningThreshold = 0.8) {
  if (!input) return;

  // 既存のカウンターがあれば削除
  const existing = input.parentElement?.querySelector('.char-counter');
  if (existing) existing.remove();

  // ラッパーを追加
  const parent = input.parentElement;
  if (!parent.classList.contains('input-with-counter')) {
    parent.classList.add('input-with-counter');
    parent.style.position = 'relative';
  }

  // カウンター要素を作成
  const counter = document.createElement('span');
  counter.className = 'char-counter';
  parent.appendChild(counter);

  const updateCounter = () => {
    const length = input.value.length;
    counter.textContent = `${length}/${maxLength}`;

    counter.classList.remove('warning', 'error');
    if (length > maxLength) {
      counter.classList.add('error');
    } else if (length >= maxLength * warningThreshold) {
      counter.classList.add('warning');
    }
  };

  input.addEventListener('input', updateCounter);
  updateCounter();

  return { update: updateCounter };
}

/**
 * 複数の入力フィールドに文字数カウンターを追加
 * @param {Array<{selector: string, maxLength: number}>} fields - フィールド設定
 */
export function setupCharCounters(fields) {
  const counters = [];

  fields.forEach(({ selector, maxLength }) => {
    const input = document.querySelector(selector);
    if (input) {
      counters.push(addCharCounter(input, maxLength));
    }
  });

  return counters;
}

/**
 * デバイスプレビュー切替を初期化
 * @param {Object} config - 設定
 * @param {string} config.toggleContainerSelector - トグルボタンのコンテナセレクター
 * @param {string} config.previewPanelSelector - プレビューパネルのセレクター
 */
export function initDevicePreviewToggle(config) {
  const { toggleContainerSelector, previewPanelSelector } = config;

  const toggleContainer = document.querySelector(toggleContainerSelector);
  const previewPanel = document.querySelector(previewPanelSelector);

  if (!toggleContainer || !previewPanel) return;

  toggleContainer.querySelectorAll('button[data-device]').forEach(btn => {
    btn.addEventListener('click', () => {
      const device = btn.dataset.device;

      // アクティブ状態を更新
      toggleContainer.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b === btn);
      });

      // プレビューパネルのデバイス属性を更新
      previewPanel.dataset.device = device;
    });
  });
}

/**
 * 自動保存インジケーターを初期化
 * @param {string} indicatorId - インジケーター要素ID
 * @returns {Object} - { showSaving, showSaved, showOff }
 */
export function initAutosaveIndicator(indicatorId) {
  const indicator = document.getElementById(indicatorId);
  if (!indicator) {
    return {
      showSaving: () => {},
      showSaved: () => {},
      showOff: () => {}
    };
  }

  const span = indicator.querySelector('span');

  return {
    showSaving: () => {
      indicator.className = 'autosave-indicator saving';
      if (span) span.textContent = '保存中...';
    },
    showSaved: (time = new Date()) => {
      indicator.className = 'autosave-indicator saved';
      const timeStr = time.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      if (span) span.textContent = `最終保存: ${timeStr}`;
    },
    showOff: () => {
      indicator.className = 'autosave-indicator';
      if (span) span.textContent = '自動保存: オフ';
    }
  };
}

/**
 * 必須フィールドにマークを追加
 * @param {string} formSelector - フォームセレクター
 * @param {Array<string>} requiredFields - 必須フィールドのname/id配列
 */
export function markRequiredFields(formSelector, requiredFields) {
  const form = document.querySelector(formSelector);
  if (!form) return;

  requiredFields.forEach(fieldId => {
    const field = form.querySelector(`#${fieldId}`) || form.querySelector(`[name="${fieldId}"]`);
    if (!field) return;

    // ラベルを見つけて必須マークを追加
    const label = form.querySelector(`label[for="${fieldId}"]`) ||
                  field.closest('.form-group')?.querySelector('label');

    if (label && !label.classList.contains('required')) {
      label.classList.add('required');
    }

    // フィールドにrequired属性を追加
    field.setAttribute('required', '');
  });
}

/**
 * セクション完了バッジを更新
 * @param {HTMLElement} sectionHeader - セクションヘッダー要素
 * @param {boolean} isComplete - 完了しているか
 */
export function updateSectionBadge(sectionHeader, isComplete) {
  if (!sectionHeader) return;

  // 既存のバッジを削除
  const existingBadge = sectionHeader.querySelector('.section-complete-badge, .section-incomplete-badge');
  if (existingBadge) existingBadge.remove();

  if (isComplete) {
    const badge = document.createElement('span');
    badge.className = 'section-complete-badge';
    badge.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
      完了
    `;
    sectionHeader.appendChild(badge);
  }
}

export default {
  initProgressIndicator,
  addCharCounter,
  setupCharCounters,
  initDevicePreviewToggle,
  initAutosaveIndicator,
  markRequiredFields,
  updateSectionBadge
};
