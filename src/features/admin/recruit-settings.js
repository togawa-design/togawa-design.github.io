/**
 * 採用ページ設定機能（管理者用）
 * 会社選択グリッド + 共通コアを使用
 */
import { escapeHtml, showConfirm } from '@shared/utils.js';
import { isAdmin, getUserCompanyDomain } from './auth.js';
import {
  initProgressIndicator,
  setupCharCounters,
  initDevicePreviewToggle,
  initAutosaveIndicator,
  markRequiredFields
} from '@shared/form-ux.js';
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
  addCustomLink,
  showTemplateSelectorModal,
  setPreviewJobs,
  designTemplates
} from '@features/recruit-settings/core.js';
import { escapeHtml as escapeHtmlUtil } from '@shared/utils.js';

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
  // テンプレートグリッドをレンダリング
  renderDesignTemplateGrid();
  // ヒーロー画像プリセットをレンダリング
  renderHeroImagePresets();
  // 動画ボタンセクションを初期化
  initVideoButtonSection();
  // セクション管理リストを初期化
  renderRecruitSectionsList();
  setupRecruitSectionDragDrop();
}

/**
 * デザインテンプレートグリッドをレンダリング
 */
function renderDesignTemplateGrid() {
  const gridEl = document.getElementById('recruit-layout-style-grid');
  if (!gridEl) return;

  gridEl.innerHTML = designTemplates.map((template, index) => `
    <label class="layout-option">
      <input type="radio" name="recruit-layout-style" value="${escapeHtmlUtil(template.id)}" ${index === 0 ? 'checked' : ''}>
      <div class="layout-preview" style="position: relative;">
        <div class="template-color-preview" style="
          position: absolute;
          top: 8px;
          right: 8px;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          background: ${template.color};
          border: 2px solid rgba(255,255,255,0.8);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        "></div>
        <span class="layout-name">${escapeHtmlUtil(template.name)}</span>
        <span class="layout-desc">${escapeHtmlUtil(template.description)}</span>
        <span class="layout-industries" style="font-size: 11px; color: #6b7280; margin-top: 4px; display: block;">${template.industries.join(' / ')}</span>
      </div>
    </label>
  `).join('');

  // テンプレート選択時にプレビューを更新するイベントリスナーを追加
  gridEl.querySelectorAll('input[name="recruit-layout-style"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updateLivePreview();
    });
  });
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

  // ヒーロー画像アップロード機能を設定
  setupHeroUpload(company.companyDomain);

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

    // 求人データを読み込んでプレビューに設定
    await loadPreviewJobs(company);

    // リアルタイムプレビューをセットアップ
    setupLivePreview();

    // UX改善: 進捗インジケーターを初期化
    initRecruitProgressIndicator();
  } finally {
    // 読み込み完了
    setFormLoadingState(false);
  }
}

/**
 * 採用ページ設定の進捗インジケーターを初期化
 */
function initRecruitProgressIndicator() {
  initProgressIndicator({
    containerId: 'recruit-form-progress',
    fillId: 'recruit-progress-fill',
    countId: 'recruit-progress-count',
    totalSections: 12,
    checkComplete: () => {
      let completed = 0;
      // 各セクションの完了状態をチェック
      // 1. 基本設定 - 常に完了
      completed++;
      // 2. デザイン - テンプレート選択されていれば完了
      if (document.querySelector('#recruit-layout-style-grid .template-option.selected')) completed++;
      // 3. ヘッダー - ロゴまたは会社名があれば完了
      if (document.getElementById('recruit-header-logo')?.value || document.getElementById('recruit-header-company-name')?.value) completed++;
      // 4. ヒーロー - タイトルがあれば完了
      if (document.getElementById('recruit-hero-title')?.value) completed++;
      // 5. 会社紹介 - テキストがあれば完了
      if (document.getElementById('recruit-company-intro')?.value) completed++;
      // 6. 求人一覧 - 常に完了（デフォルト設定あり）
      completed++;
      // 7. CTA - タイトルがあれば完了
      if (document.getElementById('recruit-cta-title')?.value) completed++;
      // 8. カスタムセクション - オプションなので常に完了扱い
      completed++;
      // 9. セクション管理 - 常に完了
      completed++;
      // 10. フッター - オプションなので常に完了扱い
      completed++;
      // 11. SEO - オプションなので常に完了扱い
      completed++;
      // 12. 埋め込み - 常に完了
      completed++;
      return completed;
    }
  });
}

/**
 * プレビュー用の求人データを読み込み
 */
async function loadPreviewJobs(company) {
  try {
    // manageSheetUrl または jobsSheet のどちらかを使用
    const jobsSource = company.manageSheetUrl || company.jobsSheet;
    if (!jobsSource) {
      setPreviewJobs([]);
      return;
    }

    const allJobs = await window.JobsLoader.fetchCompanyJobs(jobsSource);
    if (!allJobs?.length) {
      setPreviewJobs([]);
      return;
    }

    // 公開中の求人のみフィルタリング
    const visibleJobs = allJobs
      .filter(job => job.visible !== 'false' && job.visible !== 'FALSE')
      .filter(job => window.JobsLoader.isJobInPublishPeriod(job))
      .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999));

    setPreviewJobs(visibleJobs);
  } catch (error) {
    console.error('[RecruitSettings] 求人データ読み込みエラー:', error);
    setPreviewJobs([]);
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

  // 埋込用URLも設定
  const embedUrlInput = document.getElementById('recruit-embed-url');
  if (embedUrlInput) {
    embedUrlInput.value = fullUrl;
  }
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

  // 会社一覧に戻る（動的読み込み対応: 重複登録防止）
  const backBtn = document.getElementById('recruit-back-to-companies');
  if (backBtn && !backBtn.hasAttribute('data-listener-attached')) {
    backBtn.addEventListener('click', () => {
      selectedCompany = null;
      recruitSettings = {};
      document.getElementById('recruit-company-select-group').style.display = 'block';
      document.getElementById('recruit-editor').style.display = 'none';
      // URL表示を非表示
      const urlDisplay = document.getElementById('recruit-url-display');
      if (urlDisplay) urlDisplay.style.display = 'none';
    });
    backBtn.setAttribute('data-listener-attached', 'true');
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

  // カスタムリンク追加ボタン
  const addCustomLinkBtn = document.getElementById('btn-add-custom-link');
  if (addCustomLinkBtn) {
    addCustomLinkBtn.addEventListener('click', () => {
      addCustomLink();
    });
  }

  // カスタムセクション追加ボタン（テンプレート選択モーダルを開く）
  const templateSelectorBtn = document.getElementById('btn-open-template-selector');
  if (templateSelectorBtn) {
    templateSelectorBtn.addEventListener('click', () => {
      showTemplateSelectorModal();
    });
  }

  // 埋込URL コピーボタン
  const copyUrlBtn = document.getElementById('btn-copy-recruit-url');
  if (copyUrlBtn) {
    copyUrlBtn.addEventListener('click', () => {
      const urlInput = document.getElementById('recruit-embed-url');
      if (urlInput && urlInput.value) {
        copyToClipboard(urlInput.value);
      }
    });
  }

  // バナーコードコピーボタン
  document.querySelectorAll('#recruit-embed-banners .btn-copy-banner').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!selectedCompany) return;
      const bannerType = btn.dataset.banner;
      const code = generateBannerCode(bannerType, selectedCompany.companyDomain, selectedCompany.company);
      copyToClipboard(code);
    });
  });

  // UX改善: デバイスプレビュー切替
  initDevicePreviewToggle({
    toggleContainerSelector: '.preview-device-toggle',
    previewPanelSelector: '#recruit-preview-panel'
  });

  // UX改善: 文字数カウンター
  setupCharCounters([
    { selector: '#recruit-hero-title', maxLength: 40 },
    { selector: '#recruit-hero-subtitle', maxLength: 80 },
    { selector: '#recruit-cta-title', maxLength: 30 },
    { selector: '#recruit-meta-title', maxLength: 60 },
    { selector: '#recruit-meta-description', maxLength: 160 }
  ]);

  // UX改善: 必須フィールドマーク
  markRequiredFields('#recruit-settings-form', [
    'recruit-hero-title'
  ]);

  // UX改善: 自動保存インジケーター
  initAutosaveIndicator('recruit-autosave-indicator');
}

/**
 * バナーのHTMLコードを生成
 */
function generateBannerCode(bannerType, companyDomain, companyName) {
  const baseUrl = window.location.origin;
  const recruitUrl = `${baseUrl}/company-recruit.html?id=${encodeURIComponent(companyDomain)}`;
  const safeName = escapeHtml(companyName || '');

  switch (bannerType) {
    case 'button':
      return `<a href="${recruitUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">採用情報はこちら</a>`;

    case 'button-large':
      return `<a href="${recruitUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:16px 32px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;box-shadow:0 4px 14px rgba(14,165,233,0.4);">採用情報はこちら →</a>`;

    case 'card':
      return `<a href="${recruitUrl}" target="_blank" rel="noopener" style="display:block;max-width:300px;padding:20px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><span style="display:block;font-size:12px;color:#6b7280;margin-bottom:4px;">採用情報</span><span style="display:block;font-size:16px;font-weight:bold;color:#1f2937;">${safeName} 採用情報はこちら</span><span style="display:block;margin-top:8px;color:#0ea5e9;font-size:14px;">詳しく見る →</span></a>`;

    case 'recruiting':
      return `<a href="${recruitUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:16px 28px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;text-decoration:none;border-radius:8px;text-align:center;box-shadow:0 4px 14px rgba(249,115,22,0.4);"><span style="display:block;font-size:12px;font-weight:500;">ただいま</span><span style="display:block;font-size:18px;font-weight:bold;">求人募集中！</span></a>`;

    case 'special':
      return `<a href="${recruitUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:20px 32px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;text-decoration:none;border-radius:12px;text-align:center;box-shadow:0 4px 20px rgba(99,102,241,0.4);"><span style="display:block;font-size:14px;font-weight:500;">採用特設ページ</span><span style="display:block;font-size:20px;font-weight:bold;margin-top:4px;">公開中！！</span></a>`;

    default:
      return '';
  }
}

/**
 * クリップボードにコピー
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    const { showToast } = await import('@shared/utils.js');
    showToast('コピーしました', 'success');
  } catch (error) {
    console.error('クリップボードへのコピーに失敗:', error);
    const { showToast } = await import('@shared/utils.js');
    showToast('コピーに失敗しました', 'error');
  }
}

export default {
  initRecruitSettings,
  setPendingCompany
};
