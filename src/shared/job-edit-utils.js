/**
 * 求人編集関連の共通ユーティリティ
 * admin.html (job-manage-embedded.js) と job-manage.html (jobs.js) で共有
 */

import { escapeHtml } from '@shared/utils.js';

/**
 * 表示する特徴のコンテナを更新
 * @param {Object} options - オプション
 * @param {string} options.containerId - コンテナのID
 * @param {string} options.checkboxName - チェックボックスのname属性
 * @param {Array} options.checkedFeatures - チェックされた特徴の配列
 * @param {Array} [options.selectedDisplayed=[]] - 表示用に選択された特徴の配列
 * @param {Function} [options.onWarning] - 警告表示用のコールバック関数
 */
export function updateDisplayedFeaturesContainer(options) {
  const {
    containerId,
    checkboxName,
    checkedFeatures,
    selectedDisplayed = [],
    onWarning = (msg) => alert(msg)
  } = options;

  const container = document.getElementById(containerId);
  if (!container) return;

  if (checkedFeatures.length === 0) {
    container.innerHTML = '<div class="displayed-features-empty">上記から特徴を選択すると、ここに表示されます</div>';
    return;
  }

  container.innerHTML = checkedFeatures.map(feature => {
    const isSelected = selectedDisplayed.includes(feature);
    return `
      <label class="displayed-feature-item ${isSelected ? 'selected' : ''}" data-feature="${escapeHtml(feature)}">
        <input type="checkbox" name="${checkboxName}" value="${escapeHtml(feature)}" ${isSelected ? 'checked' : ''}>
        <span class="displayed-feature-label">${escapeHtml(feature)}</span>
        <span class="displayed-feature-badge">${isSelected ? '表示中' : ''}</span>
      </label>
    `;
  }).join('');

  // 表示する特徴のチェックボックスにイベントを設定
  setupDisplayedFeaturesEvents({ containerId, onWarning });
}

/**
 * 表示する特徴のイベントを設定
 * @param {Object} options - オプション
 * @param {string} options.containerId - コンテナのID
 * @param {Function} [options.onWarning] - 警告表示用のコールバック関数
 */
export function setupDisplayedFeaturesEvents(options) {
  const {
    containerId,
    onWarning = (msg) => alert(msg)
  } = options;

  const checkboxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]`);

  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`);

      // 最大3つまでの制限
      if (checked.length > 3) {
        cb.checked = false;
        onWarning('表示する特徴は最大3つまでです');
        return;
      }

      // UIを更新
      const item = cb.closest('.displayed-feature-item');
      const badge = item.querySelector('.displayed-feature-badge');

      if (cb.checked) {
        item.classList.add('selected');
        badge.textContent = '表示中';
      } else {
        item.classList.remove('selected');
        badge.textContent = '';
      }
    });
  });
}

/**
 * 特徴チェックボックスの変更を監視
 * @param {Object} options - オプション
 * @param {string} options.featuresGridId - 特徴チェックボックスグリッドのID
 * @param {string} options.displayedContainerId - 表示する特徴コンテナのID
 * @param {string} options.checkboxName - チェックボックスのname属性
 * @param {Function} [options.onWarning] - 警告表示用のコールバック関数
 */
export function setupFeaturesCheckboxEvents(options) {
  const {
    featuresGridId,
    displayedContainerId,
    checkboxName,
    onWarning = (msg) => alert(msg)
  } = options;

  const checkboxes = document.querySelectorAll(`#${featuresGridId} input[type="checkbox"]`);

  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      // チェックされた特徴を取得
      const checkedFeatures = Array.from(
        document.querySelectorAll(`#${featuresGridId} input[type="checkbox"]:checked`)
      ).map(c => c.value);

      // 現在表示用に選択されている特徴を取得
      const currentDisplayed = Array.from(
        document.querySelectorAll(`#${displayedContainerId} input[type="checkbox"]:checked`)
      ).map(c => c.value);

      // チェックが外された特徴は表示用からも削除
      const validDisplayed = currentDisplayed.filter(f => checkedFeatures.includes(f));

      // コンテナを更新
      updateDisplayedFeaturesContainer({
        containerId: displayedContainerId,
        checkboxName,
        checkedFeatures,
        selectedDisplayed: validDisplayed,
        onWarning
      });
    });
  });
}

/**
 * フォームから表示する特徴を取得
 * @param {string} containerId - コンテナのID
 * @returns {string} カンマ区切りの特徴文字列
 */
export function getDisplayedFeaturesFromForm(containerId) {
  const checkboxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`);
  const featuresArray = Array.from(checkboxes).map(cb => cb.value);
  return featuresArray.join(',');
}

/**
 * 表示する特徴を設定
 * @param {Object} options - オプション
 * @param {string} options.featuresGridId - 特徴チェックボックスグリッドのID
 * @param {string} options.displayedContainerId - 表示する特徴コンテナのID
 * @param {string} options.checkboxName - チェックボックスのname属性
 * @param {string} options.features - カンマ区切りの特徴文字列
 * @param {string} options.displayedFeatures - カンマ区切りの表示する特徴文字列
 * @param {Function} [options.onWarning] - 警告表示用のコールバック関数
 */
export function populateDisplayedFeatures(options) {
  const {
    featuresGridId,
    displayedContainerId,
    checkboxName,
    features,
    displayedFeatures,
    onWarning = (msg) => alert(msg)
  } = options;

  // 特徴を配列に変換
  const featuresData = features || '';
  const featuresString = typeof featuresData === 'string' ? featuresData : String(featuresData);
  const featuresArray = featuresString.split(',').map(f => f.trim()).filter(f => f);

  // 表示する特徴を配列に変換
  const displayedFeaturesData = displayedFeatures || '';
  const displayedFeaturesString = typeof displayedFeaturesData === 'string' ? displayedFeaturesData : String(displayedFeaturesData);
  const displayedFeaturesArray = displayedFeaturesString.split(',').map(f => f.trim()).filter(f => f);

  // コンテナを更新
  updateDisplayedFeaturesContainer({
    containerId: displayedContainerId,
    checkboxName,
    checkedFeatures: featuresArray,
    selectedDisplayed: displayedFeaturesArray,
    onWarning
  });
}

/**
 * 表示する特徴をクリア
 * @param {string} containerId - コンテナのID
 */
export function clearDisplayedFeatures(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '<div class="displayed-features-empty">上記から特徴を選択すると、ここに表示されます</div>';
  }
}

/**
 * 特徴チェックボックスをクリア
 * @param {string} featuresGridId - 特徴チェックボックスグリッドのID
 */
export function clearFeaturesCheckboxes(featuresGridId) {
  document.querySelectorAll(`#${featuresGridId} input[type="checkbox"]`).forEach(cb => {
    cb.checked = false;
  });
}
