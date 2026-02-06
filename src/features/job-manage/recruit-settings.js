/**
 * 採用ページ設定機能（会社ユーザー用）
 * シンプル版 - 共通コアを使用
 */
import { showToast } from '@shared/utils.js';
import {
  loadRecruitSettings,
  populateForm,
  populateFormWithDefaults,
  handleSave,
  handleReset,
  updatePreviewLink,
  renderHeroImagePresets,
  setupLogoUpload,
  setupHeroUpload,
  setupLivePreview,
  updateLivePreview,
  initVideoButtonSection,
  renderRecruitSectionsList,
  setupRecruitSectionDragDrop,
  setupRecruitInfoPanel
} from '@features/recruit-settings/core.js';

// 現在の会社ドメイン
let companyDomain = null;
let companyName = null;
let recruitSettings = {};

/**
 * 採用ページ設定を初期化
 */
export async function initRecruitSettings(domain) {
  companyDomain = domain;

  // 会社名を取得
  const companyNameEl = document.getElementById('company-name');
  companyName = companyNameEl?.textContent || '';

  // URLを更新
  const urlEl = document.getElementById('recruit-page-url');
  if (urlEl) {
    urlEl.textContent = `/company-recruit.html?id=${domain}`;
  }

  // プレビューリンク更新
  updatePreviewLink(domain);

  // 採用ページ情報パネルを初期化
  setupRecruitInfoPanel(domain);

  // ヒーロー画像プリセットをレンダリング
  renderHeroImagePresets();

  // ロゴアップロード機能を設定
  setupLogoUpload(domain);

  // ヒーロー画像アップロード機能を設定
  setupHeroUpload(domain);

  // 動画ボタンセクションを初期化
  initVideoButtonSection();

  // セクション管理リストを初期化
  renderRecruitSectionsList();
  setupRecruitSectionDragDrop();

  // 読み込み中状態を設定
  setFormLoadingState(true);

  try {
    // 設定を読み込み
    recruitSettings = await loadRecruitSettings(domain) || {};

    if (Object.keys(recruitSettings).length > 0) {
      populateForm(recruitSettings, companyName);
    } else {
      populateFormWithDefaults(companyName);
    }

    // リアルタイムプレビューをセットアップ
    setupLivePreview();

    // イベントリスナーを設定
    setupEventListeners();
  } finally {
    // 読み込み完了
    setFormLoadingState(false);
  }
}

/**
 * フォームの読み込み中状態を設定
 */
function setFormLoadingState(isLoading) {
  const container = document.getElementById('section-recruit-settings');
  if (!container) return;

  // フォーム要素を取得
  const inputs = container.querySelectorAll('input, select, textarea, button');
  inputs.forEach(el => {
    el.disabled = isLoading;
  });

  // 保存・リセットボタン
  const saveBtn = document.getElementById('btn-save-recruit-settings');
  const resetBtn = document.getElementById('btn-reset-recruit-settings');
  if (saveBtn) saveBtn.disabled = isLoading;
  if (resetBtn) resetBtn.disabled = isLoading;

  // ローディング表示
  const loadingOverlay = container.querySelector('.recruit-loading-overlay');
  if (isLoading) {
    if (!loadingOverlay) {
      const overlay = document.createElement('div');
      overlay.className = 'recruit-loading-overlay';
      overlay.innerHTML = '<div class="loading-spinner"></div><p>読み込み中...</p>';
      container.style.position = 'relative';
      container.appendChild(overlay);
    }
  } else {
    loadingOverlay?.remove();
  }
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // 保存ボタン
  const saveBtn = document.getElementById('btn-save-recruit-settings');
  if (saveBtn) {
    // 既存のリスナーを削除して新規追加
    saveBtn.replaceWith(saveBtn.cloneNode(true));
    document.getElementById('btn-save-recruit-settings')?.addEventListener('click', async () => {
      const saved = await handleSave(companyDomain, (settings) => {
        recruitSettings = settings;
        // 成功メッセージ表示
        const successMsg = document.getElementById('recruit-save-message');
        if (successMsg) {
          successMsg.style.display = 'block';
          setTimeout(() => { successMsg.style.display = 'none'; }, 3000);
        }
      });
    });
  }

  // リセットボタン
  const resetBtn = document.getElementById('btn-reset-recruit-settings');
  if (resetBtn) {
    resetBtn.replaceWith(resetBtn.cloneNode(true));
    document.getElementById('btn-reset-recruit-settings')?.addEventListener('click', () => {
      handleReset(recruitSettings, companyName);
      updateLivePreview(); // プレビューも更新
    });
  }
}

export default {
  initRecruitSettings
};
