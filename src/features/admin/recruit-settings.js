/**
 * 採用ページ設定機能（管理者用）
 * 会社選択グリッド + 共通コアを使用
 */
import { escapeHtml, showConfirm } from '@shared/utils.js';
import {
  loadRecruitSettings,
  populateForm,
  populateFormWithDefaults,
  handleSave,
  handleReset,
  updatePreviewLink,
  renderHeroImagePresets,
  setupLogoUpload
} from '@features/recruit-settings/core.js';

// 現在選択中の会社
let selectedCompany = null;
let recruitSettings = {};

/**
 * 採用ページ設定を初期化
 */
export async function initRecruitSettings() {
  await loadCompanyGrid();
  setupEventListeners();
  // ヒーロー画像プリセットをレンダリング
  renderHeroImagePresets();
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

  // プレビューリンク更新
  updatePreviewLink(company.companyDomain);

  // ロゴアップロード機能を設定
  setupLogoUpload(company.companyDomain);

  // 設定を読み込み
  recruitSettings = await loadRecruitSettings(company.companyDomain) || {};

  if (Object.keys(recruitSettings).length > 0) {
    populateForm(recruitSettings, company.company);
  } else {
    populateFormWithDefaults(company.company, company.description, company.imageUrl);
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
      }
    });
  }
}

export default {
  initRecruitSettings
};
