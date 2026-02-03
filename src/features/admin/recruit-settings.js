/**
 * 採用ページ設定機能（管理者用）
 * 会社選択グリッド + 共通コアを使用
 */
import { escapeHtml, showConfirm } from '@shared/utils.js';
import { isAdmin, getUserCompanyDomain } from './auth.js';
import {
  loadRecruitSettings,
  populateForm,
  populateFormWithDefaults,
  handleSave,
  handleReset,
  updatePreviewLink,
  renderHeroImagePresets,
  setupLogoUpload,
  setupLivePreview,
  updateLivePreview,
  initVideoButtonSection,
  renderRecruitSectionsList,
  setupRecruitSectionDragDrop
} from '@features/recruit-settings/core.js';

// 現在選択中の会社
let selectedCompany = null;
let recruitSettings = {};
let pendingCompanyDomain = null; // 遷移時に自動選択する会社ドメイン

/**
 * 採用ページ設定を初期化
 * @param {string} [companyDomain] - 初期選択として自動選択する会社ドメイン
 */
export async function initRecruitSettings(companyDomain = null) {
  // 引数で渡された場合のみ設定（事前にsetPendingCompanyで設定されている場合は上書きしない）
  if (companyDomain) {
    pendingCompanyDomain = companyDomain;
  }
  await loadCompanyGrid();
  setupEventListeners();
  // ヒーロー画像プリセットをレンダリング
  renderHeroImagePresets();
  // 動画ボタンセクションを初期化
  initVideoButtonSection();
  // セクション管理リストを初期化
  renderRecruitSectionsList();
  setupRecruitSectionDragDrop();
}

/**
 * 会社ドメインを設定（外部から呼び出し用）
 * @param {string} companyDomain - 会社ドメイン
 */
export function setPendingCompany(companyDomain) {
  pendingCompanyDomain = companyDomain;
}

/**
 * 会社グリッドを読み込み
 */
async function loadCompanyGrid() {
  const gridEl = document.getElementById('recruit-company-grid');
  if (!gridEl) return;

  try {
    const companies = await window.JobsLoader.fetchCompanies();
    const visibleCompanies = companies.filter(c => window.JobsLoader.isCompanyVisible(c));

    // 会社ユーザーの場合は直接自社を選択
    if (!isAdmin()) {
      const userCompanyDomain = getUserCompanyDomain();
      const userCompany = visibleCompanies.find(c => c.companyDomain === userCompanyDomain);
      if (userCompany) {
        // 会社選択グリッドを非表示
        document.getElementById('recruit-company-select-group').style.display = 'none';
        // 戻るボタンを非表示
        const backBtn = document.getElementById('recruit-back-to-companies');
        if (backBtn) backBtn.style.display = 'none';
        // 直接会社を選択
        selectCompany(userCompany);
        return;
      }
    }

    if (visibleCompanies.length === 0) {
      gridEl.innerHTML = '<p class="no-data">表示可能な会社がありません</p>';
      return;
    }

    gridEl.innerHTML = visibleCompanies.map(company => `
      <div class="lp-company-card" data-company-domain="${escapeHtml(company.companyDomain || '')}">
        <div class="lp-company-card-image" style="${company.imageUrl ? `background-image: url('${escapeHtml(company.imageUrl)}')` : ''}">
          ${!company.imageUrl ? '<span class="no-image-icon">🏢</span>' : ''}
        </div>
        <div class="lp-company-card-content">
          <h4 class="lp-company-card-title">${escapeHtml(company.company || '会社名未設定')}</h4>
          <p class="lp-company-card-domain">${escapeHtml(company.companyDomain || '')}</p>
        </div>
      </div>
    `).join('');

    // 会社カードのクリックイベント
    gridEl.querySelectorAll('.lp-company-card').forEach(card => {
      card.addEventListener('click', () => {
        const domain = card.dataset.companyDomain;
        const company = visibleCompanies.find(c => c.companyDomain === domain);
        if (company) {
          selectCompany(company);
        }
      });
    });

    // 保留中の会社があれば自動選択
    if (pendingCompanyDomain) {
      const pendingCompany = visibleCompanies.find(c => c.companyDomain === pendingCompanyDomain);
      if (pendingCompany) {
        selectCompany(pendingCompany);
      }
      pendingCompanyDomain = null; // 適用後はクリア
    }
  } catch (error) {
    console.error('[RecruitSettings] 会社一覧の読み込みエラー:', error);
    gridEl.innerHTML = '<p class="error">会社一覧の読み込みに失敗しました</p>';
  }
}

/**
 * 会社を選択
 */
async function selectCompany(company) {
  selectedCompany = company;

  // UI更新
  document.getElementById('recruit-company-select-group').style.display = 'none';
  document.getElementById('recruit-editor').style.display = 'block';
  document.getElementById('recruit-selected-company-name').textContent = company.company;

  // URL表示を更新
  updateRecruitUrlDisplay(company.companyDomain);

  // プレビューリンク更新
  updatePreviewLink(company.companyDomain);

  // ロゴアップロード機能を設定
  setupLogoUpload(company.companyDomain);

  // 読み込み中状態を設定
  setFormLoadingState(true);

  try {
    // 設定を読み込み
    recruitSettings = await loadRecruitSettings(company.companyDomain) || {};

    if (Object.keys(recruitSettings).length > 0) {
      populateForm(recruitSettings, company.company);
    } else {
      populateFormWithDefaults(company.company, company.description, company.imageUrl);
    }

    // リアルタイムプレビューをセットアップ
    setupLivePreview();
  } finally {
    // 読み込み完了
    setFormLoadingState(false);
  }
}

/**
 * 採用ページURLの表示を更新
 * @param {string} companyDomain - 会社ドメイン
 */
function updateRecruitUrlDisplay(companyDomain) {
  const urlDisplay = document.getElementById('recruit-url-display');
  const urlLink = document.getElementById('recruit-url-link');
  if (!urlDisplay || !urlLink) return;

  const baseUrl = window.location.origin;
  const fullUrl = `${baseUrl}/company-recruit.html?id=${encodeURIComponent(companyDomain)}`;

  urlLink.href = fullUrl;
  urlLink.textContent = fullUrl;
  urlDisplay.style.display = 'block';
}

/**
 * フォームの読み込み中状態を設定
 */
function setFormLoadingState(isLoading) {
  const editorEl = document.getElementById('recruit-editor');
  if (!editorEl) return;

  // フォーム要素を取得
  const inputs = editorEl.querySelectorAll('input, select, textarea, button');
  inputs.forEach(el => {
    el.disabled = isLoading;
  });

  // 保存・リセットボタン
  const saveBtn = document.getElementById('btn-save-recruit-settings');
  const resetBtn = document.getElementById('btn-reset-recruit-settings');
  if (saveBtn) saveBtn.disabled = isLoading;
  if (resetBtn) resetBtn.disabled = isLoading;

  // ローディング表示
  const loadingOverlay = editorEl.querySelector('.recruit-loading-overlay');
  if (isLoading) {
    if (!loadingOverlay) {
      const overlay = document.createElement('div');
      overlay.className = 'recruit-loading-overlay';
      overlay.innerHTML = '<div class="loading-spinner"></div><p>読み込み中...</p>';
      editorEl.style.position = 'relative';
      editorEl.appendChild(overlay);
    }
  } else {
    loadingOverlay?.remove();
  }
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // 会社検索
  const searchInput = document.getElementById('recruit-company-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const searchTerm = searchInput.value.toLowerCase();
      const cards = document.querySelectorAll('#recruit-company-grid .lp-company-card');
      cards.forEach(card => {
        const title = card.querySelector('.lp-company-card-title')?.textContent.toLowerCase() || '';
        const domain = card.dataset.companyDomain?.toLowerCase() || '';
        card.style.display = (title.includes(searchTerm) || domain.includes(searchTerm)) ? '' : 'none';
      });
    });
  }

  // 会社一覧に戻る
  const backBtn = document.getElementById('recruit-back-to-companies');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      selectedCompany = null;
      recruitSettings = {};
      document.getElementById('recruit-company-select-group').style.display = 'block';
      document.getElementById('recruit-editor').style.display = 'none';
      // URL表示を非表示
      const urlDisplay = document.getElementById('recruit-url-display');
      if (urlDisplay) urlDisplay.style.display = 'none';
    });
  }

  // 保存ボタン
  const saveBtn = document.getElementById('btn-save-recruit-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      if (!selectedCompany) return;
      const saved = await handleSave(selectedCompany.companyDomain, (settings) => {
        recruitSettings = settings;
      });
    });
  }

  // リセットボタン
  const resetBtn = document.getElementById('btn-reset-recruit-settings');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const confirmed = await showConfirm('設定をリセットしますか？', '未保存の変更は失われます。');
      if (confirmed && selectedCompany) {
        handleReset(recruitSettings, selectedCompany.company, selectedCompany.description, selectedCompany.imageUrl);
        updateLivePreview(); // プレビューも更新
      }
    });
  }
}

export default {
  initRecruitSettings,
  setPendingCompany
};
