/**
 * Admin Dashboard - LP設定モジュール
 */

import { escapeHtml } from '@shared/utils.js';
import { spreadsheetConfig, heroImagePresets } from './config.js';
import { parseCSVLine } from './csv-utils.js';
import { getCompaniesCache, loadCompanyManageData } from './company-manager.js';
import { isAdmin, getUserCompanyDomain } from './auth.js';
import {
  initSectionManager,
  loadSectionsFromSettings,
  getCurrentLPContent,
  renderSectionsList
} from './lp-section-manager.js';
import { LAYOUT_STYLES } from '@features/lp/LPEditor.js';

let previewUpdateTimer = null;
const MAX_POINTS = 6;
let sectionManagerInitialized = false;
let allJobsCache = [];
let currentJobData = null;
let visibleCompaniesCache = [];
let selectedCompanyDomain = null;

// LP設定用の会社・求人リストを読み込み
export async function loadJobListForLP() {
  const companySelectGroup = document.getElementById('lp-company-select-group');
  const jobSelectGroup = document.getElementById('lp-job-select-group');
  const stepsIndicator = document.getElementById('lp-selection-steps');

  // 会社データを取得
  let companiesCache = getCompaniesCache();
  if (!companiesCache || companiesCache.length === 0) {
    await loadCompanyManageData();
    companiesCache = getCompaniesCache();
  }

  visibleCompaniesCache = companiesCache.filter(c =>
    c.companyDomain && (c.showCompany === '○' || c.showCompany === '◯')
  );

  // 権限に応じた表示
  if (isAdmin()) {
    // admin: 会社選択 → 求人選択
    if (companySelectGroup) companySelectGroup.style.display = 'block';
    if (jobSelectGroup) jobSelectGroup.style.display = 'none';
    if (stepsIndicator) stepsIndicator.style.display = 'flex';

    // 会社カードグリッドを作成
    renderCompanyCards(visibleCompaniesCache);

    // 検索機能を設定
    const searchInput = document.getElementById('lp-company-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = query
          ? visibleCompaniesCache.filter(c =>
              c.company?.toLowerCase().includes(query) ||
              c.companyDomain?.toLowerCase().includes(query)
            )
          : visibleCompaniesCache;
        renderCompanyCards(filtered);
      });
    }

    // 戻るボタンのイベント
    const backBtn = document.getElementById('lp-back-to-companies');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (companySelectGroup) companySelectGroup.style.display = 'block';
        if (jobSelectGroup) jobSelectGroup.style.display = 'none';
        const editor = document.getElementById('lp-editor');
        if (editor) editor.style.display = 'none';
        updateStepIndicator('company');
      });
    }
  } else {
    // 会社ユーザー: 自社の求人のみ表示
    const userCompanyDomain = getUserCompanyDomain();
    if (companySelectGroup) companySelectGroup.style.display = 'none';
    if (stepsIndicator) stepsIndicator.style.display = 'none';

    if (userCompanyDomain) {
      selectedCompanyDomain = userCompanyDomain;
      await loadJobsForCompany(userCompanyDomain);
      if (jobSelectGroup) jobSelectGroup.style.display = 'block';
    } else {
      console.warn('[LP設定] 会社ドメインが設定されていません');
      if (jobSelectGroup) jobSelectGroup.style.display = 'none';
    }
  }
}

// 会社カードをレンダリング
function renderCompanyCards(companies) {
  const grid = document.getElementById('lp-company-grid');
  if (!grid) return;

  if (companies.length === 0) {
    grid.innerHTML = '<div class="lp-no-results"><p>該当する会社がありません</p></div>';
    return;
  }

  grid.innerHTML = companies.map(company => {
    const initial = (company.company || company.companyDomain || '?').charAt(0).toUpperCase();
    return `
      <div class="lp-company-card" data-domain="${escapeHtml(company.companyDomain)}">
        <div class="lp-company-icon">${escapeHtml(initial)}</div>
        <div class="lp-company-name">${escapeHtml(company.company || company.companyDomain)}</div>
        <div class="lp-company-domain">${escapeHtml(company.companyDomain)}</div>
      </div>
    `;
  }).join('');

  // カードクリックイベント
  grid.querySelectorAll('.lp-company-card').forEach(card => {
    card.addEventListener('click', async () => {
      const domain = card.dataset.domain;
      selectedCompanyDomain = domain;

      // 選択状態を更新
      grid.querySelectorAll('.lp-company-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      // 求人を読み込んで表示を切り替え
      await loadJobsForCompany(domain);

      const companySelectGroup = document.getElementById('lp-company-select-group');
      const jobSelectGroup = document.getElementById('lp-job-select-group');
      if (companySelectGroup) companySelectGroup.style.display = 'none';
      if (jobSelectGroup) jobSelectGroup.style.display = 'block';

      // ステップインジケーターを更新
      updateStepIndicator('job');

      // 選択した会社名を表示
      const companyNameEl = document.getElementById('lp-selected-company-name');
      if (companyNameEl) {
        const company = visibleCompaniesCache.find(c => c.companyDomain === domain);
        companyNameEl.textContent = `${company?.company || domain} の求人`;
      }
    });
  });
}

// ステップインジケーターを更新
function updateStepIndicator(currentStep) {
  const steps = document.querySelectorAll('.lp-step');
  const stepOrder = ['company', 'job', 'edit'];
  const currentIndex = stepOrder.indexOf(currentStep);

  steps.forEach(step => {
    const stepName = step.dataset.step;
    const stepIndex = stepOrder.indexOf(stepName);

    step.classList.remove('active', 'completed');
    if (stepIndex < currentIndex) {
      step.classList.add('completed');
    } else if (stepIndex === currentIndex) {
      step.classList.add('active');
    }
  });
}

// 特定の会社の求人を読み込む
async function loadJobsForCompany(companyDomain) {
  const jobGrid = document.getElementById('lp-job-grid');
  const jobSelect = document.getElementById('lp-job-select');

  // 会社データを取得
  const company = visibleCompaniesCache.find(c => c.companyDomain === companyDomain);
  if (!company) {
    console.warn(`[LP設定] 会社が見つかりません: ${companyDomain}`);
    return;
  }

  // ローディング表示
  if (jobGrid) {
    jobGrid.innerHTML = '<div class="lp-loading-placeholder">求人を読み込み中...</div>';
  }

  // 求人シートの情報を取得
  const sheetName = company.jobsSheet?.trim();
  const manageSheetUrl = company.manageSheetUrl?.trim();

  let csvUrl = '';

  if (sheetName) {
    // シート名が指定されている場合は同じスプレッドシート内のシートを参照
    csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetConfig.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  } else if (manageSheetUrl) {
    // URLが指定されている場合はスプレッドシートIDを抽出
    const sheetIdMatch = manageSheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (sheetIdMatch) {
      const externalSheetId = sheetIdMatch[1];
      csvUrl = `https://docs.google.com/spreadsheets/d/${externalSheetId}/gviz/tq?tqx=out:csv`;
    }
  }

  if (!csvUrl) {
    console.warn(`[LP設定] 求人シートURLが見つかりません: ${companyDomain}`);
    if (jobGrid) {
      jobGrid.innerHTML = '<div class="lp-no-results"><p>求人シートが設定されていません</p></div>';
    }
    return;
  }

  try {
    const response = await fetch(csvUrl);
    if (!response.ok) {
      console.warn(`[LP設定] 求人シートの読み込みに失敗: ${response.status}`);
      if (jobGrid) {
        jobGrid.innerHTML = '<div class="lp-no-results"><p>求人データの読み込みに失敗しました</p></div>';
      }
      return;
    }

    const csvText = await response.text();
    const jobs = parseJobsCSV(csvText, company);
    allJobsCache = jobs;

    // 求人カードグリッドをレンダリング
    renderJobCards(jobs);

    // 互換性のため非表示のselectも更新
    if (jobSelect) {
      let html = '<option value="">-- 求人を選択 --</option>';
      for (const job of jobs) {
        html += `<option value="${escapeHtml(job.id)}">${escapeHtml(job.title)}</option>`;
      }
      jobSelect.innerHTML = html;
    }

  } catch (e) {
    console.warn(`[LP設定] 求人読み込みエラー: ${companyDomain}`, e);
    if (jobGrid) {
      jobGrid.innerHTML = '<div class="lp-no-results"><p>求人データの読み込み中にエラーが発生しました</p></div>';
    }
  }
}

// 求人カードをレンダリング
function renderJobCards(jobs) {
  const grid = document.getElementById('lp-job-grid');
  if (!grid) return;

  if (jobs.length === 0) {
    grid.innerHTML = '<div class="lp-no-results"><p>この会社には求人がありません</p></div>';
    return;
  }

  grid.innerHTML = jobs.map(job => `
    <div class="lp-job-card" data-job-id="${escapeHtml(job.id)}">
      <div class="lp-job-title">${escapeHtml(job.title)}</div>
      <div class="lp-job-id">ID: ${escapeHtml(job.jobId)}</div>
      <div class="lp-job-actions">
        <button type="button" class="lp-job-action-btn primary lp-select-job-btn">LP設定を編集</button>
        <a href="lp.html?j=${encodeURIComponent(job.id)}" target="_blank" class="lp-job-action-btn secondary">プレビュー</a>
      </div>
    </div>
  `).join('');

  // カードクリックイベント（LP設定を編集ボタン）
  grid.querySelectorAll('.lp-select-job-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = btn.closest('.lp-job-card');
      const jobId = card.dataset.jobId;

      // 選択状態を更新
      grid.querySelectorAll('.lp-job-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      // 非表示のselectも更新（互換性のため）
      const jobSelect = document.getElementById('lp-job-select');
      if (jobSelect) {
        jobSelect.value = jobId;
      }

      // LP設定を読み込み
      await loadLPSettings(jobId);

      // ステップインジケーターを更新
      updateStepIndicator('edit');
    });
  });
}

// 求人CSVをパース
function parseJobsCSV(csvText, company) {
  const lines = csvText.split('\n');
  const headers = parseCSVLine(lines[0] || '');
  const jobs = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const job = {};

    headers.forEach((header, idx) => {
      const cleanHeader = header.replace(/"/g, '').trim();
      // ヘッダーが「英語名 日本語名」形式の場合、英語名をキーとして使用
      const key = cleanHeader.split(' ')[0] || cleanHeader;
      job[key] = values[idx] || '';
    });

    // 表示対象の求人のみ
    if (job.visible === 'false' || job.visible === 'FALSE') continue;

    // 求人IDを生成（会社ドメイン + 求人ID）
    const jobId = job.jobId || job['求人ID'] || job.id || job['ID'] || `job-${i}`;

    // タイトルを取得（複数のヘッダー名に対応）
    const title = job.title || job['タイトル'] || job['求人タイトル'] || job['募集タイトル'] || job['求人名'] || job['募集名'] || '(タイトルなし)';

    jobs.push({
      id: `${company.companyDomain}_${jobId}`,
      jobId: jobId,
      title: title,
      company: company.company,
      companyDomain: company.companyDomain,
      jobsSheet: company.jobsSheet,
      manageSheetUrl: company.manageSheetUrl,
      rawData: job
    });
  }

  return jobs;
}


// 旧関数（互換性のため残す）
export async function loadCompanyListForLP() {
  return loadJobListForLP();
}

// LP設定を読み込み（求人ID単位）
export async function loadLPSettings(jobId) {
  const editor = document.getElementById('lp-editor');
  const previewBtn = document.getElementById('lp-preview-btn');
  const editModeBtn = document.getElementById('lp-edit-mode-btn');

  if (!jobId) {
    if (editor) editor.style.display = 'none';
    currentJobData = null;
    return;
  }

  // 求人データを取得
  currentJobData = allJobsCache.find(j => j.id === jobId);
  if (!currentJobData) {
    if (editor) editor.style.display = 'none';
    return;
  }

  if (editor) editor.style.display = 'block';

  // LP URLは既にcompanyDomain_jobId形式のcurrentJobData.idを使用
  const lpJobId = currentJobData.id;

  if (previewBtn) previewBtn.href = `lp.html?j=${encodeURIComponent(lpJobId)}`;
  if (editModeBtn) editModeBtn.href = `lp.html?j=${encodeURIComponent(lpJobId)}&edit`;

  renderHeroImagePresets();

  // デフォルトのデザインパターンを設定
  const patternRadio = document.querySelector('input[name="design-pattern"][value="standard"]');
  if (patternRadio) patternRadio.checked = true;

  try {
    // 会社の管理シートからLP設定を読み込む
    // manageSheetUrl または jobsSheet（管理シート）を使用
    const sheetUrl = currentJobData.manageSheetUrl?.trim() || currentJobData.jobsSheet?.trim();
    console.log('[LP設定] 管理シートURL:', sheetUrl);

    if (!sheetUrl) {
      console.log('[LP設定] 管理シートURLが見つかりません');
      clearLPForm();
      return;
    }

    // スプレッドシートIDを抽出（URLまたはIDの両方に対応）
    let companySheetId = null;
    const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (sheetIdMatch) {
      companySheetId = sheetIdMatch[1];
    } else if (/^[a-zA-Z0-9_-]+$/.test(sheetUrl)) {
      // IDのみの場合
      companySheetId = sheetUrl;
    }

    if (!companySheetId) {
      console.log('[LP設定] 管理シートIDを抽出できません');
      clearLPForm();
      return;
    }

    const csvUrl = `https://docs.google.com/spreadsheets/d/${companySheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('LP設定')}`;
    console.log('[LP設定] LP設定シートURL:', csvUrl);

    const response = await fetch(csvUrl);

    if (response.ok) {
      const csvText = await response.text();
      const settings = parseLPSettingsCSV(csvText, jobId);

      if (settings) {
        setInputValue('lp-hero-title', settings.heroTitle);
        setInputValue('lp-hero-subtitle', settings.heroSubtitle);
        setInputValue('lp-hero-image', settings.heroImage);

        // ポイントを動的にレンダリング
        const points = [];
        for (let i = 1; i <= 6; i++) {
          const title = settings[`pointTitle${i}`] || '';
          const desc = settings[`pointDesc${i}`] || '';
          if (title || desc) {
            points.push({ title, desc });
          }
        }
        renderPointInputs(points.length > 0 ? points : [{ title: '', desc: '' }, { title: '', desc: '' }, { title: '', desc: '' }]);

        setInputValue('lp-cta-text', settings.ctaText || '今すぐ応募する');
        setInputValue('lp-faq', settings.faq);

        // FAQエディターをレンダリング
        const faqs = parseFAQString(settings.faq);
        renderFAQInputs(faqs);

        if (settings.designPattern) {
          const patternRadio = document.querySelector(`input[name="design-pattern"][value="${settings.designPattern}"]`);
          if (patternRadio) patternRadio.checked = true;
        }

        if (settings.sectionOrder) {
          applySectionOrder(settings.sectionOrder);
        }

        if (settings.sectionVisibility) {
          applySectionVisibility(settings.sectionVisibility);
        }

        // 広告トラッキング設定
        setInputValue('lp-tiktok-pixel', settings.tiktokPixelId);
        setInputValue('lp-google-ads-id', settings.googleAdsId);
        setInputValue('lp-google-ads-label', settings.googleAdsLabel);

        // OGP設定
        setInputValue('lp-ogp-title', settings.ogpTitle);
        setInputValue('lp-ogp-description', settings.ogpDescription);
        setInputValue('lp-ogp-image', settings.ogpImage);

        updateHeroImagePresetSelection(settings.heroImage || '');

        // セクションマネージャーを初期化してデータを読み込み
        initSectionManagerIfNeeded();
        loadSectionsFromSettings(settings);
        renderSectionsList();

        return;
      }
    }
  } catch (e) {
    console.log('LP設定シートが見つかりません');
  }

  clearLPForm();
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

// セクションマネージャーを初期化（一度だけ）
function initSectionManagerIfNeeded() {
  if (!sectionManagerInitialized) {
    initSectionManager(updateLPPreview, {
      getCompanyDomain: () => currentJobData?.companyDomain || null
    });
    sectionManagerInitialized = true;
  }
}

// ポイント入力フィールドをレンダリング
export function renderPointInputs(points = [{ title: '', desc: '' }, { title: '', desc: '' }, { title: '', desc: '' }]) {
  const container = document.getElementById('point-inputs-container');
  if (!container) return;

  container.innerHTML = points.map((point, index) => `
    <div class="point-input-group" data-point-index="${index}">
      <label>ポイント${index + 1}</label>
      <input type="text" class="point-title" placeholder="タイトル" value="${escapeHtml(point.title || '')}">
      <input type="text" class="point-desc" placeholder="説明文" value="${escapeHtml(point.desc || '')}">
      <button type="button" class="btn-remove-point" title="削除">&times;</button>
    </div>
  `).join('');

  // 削除ボタンのイベント
  container.querySelectorAll('.btn-remove-point').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const group = e.target.closest('.point-input-group');
      if (group && container.children.length > 1) {
        group.remove();
        reindexPoints();
        updateAddButtonState();
        debouncedUpdatePreview();
      }
    });
  });

  // 入力時にプレビュー更新
  container.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => debouncedUpdatePreview());
  });

  updateAddButtonState();
}

// ポイントのインデックスを振り直す
function reindexPoints() {
  const container = document.getElementById('point-inputs-container');
  if (!container) return;

  container.querySelectorAll('.point-input-group').forEach((group, index) => {
    group.dataset.pointIndex = index;
    const label = group.querySelector('label');
    if (label) label.textContent = `ポイント${index + 1}`;
  });
}

// 追加ボタンの状態を更新
function updateAddButtonState() {
  const container = document.getElementById('point-inputs-container');
  const addBtn = document.getElementById('btn-add-point');
  if (!container || !addBtn) return;

  const count = container.children.length;
  addBtn.disabled = count >= MAX_POINTS;
}

// ポイントを追加
export function addPoint() {
  const container = document.getElementById('point-inputs-container');
  if (!container) return;

  const count = container.children.length;
  if (count >= MAX_POINTS) return;

  const newIndex = count;
  const div = document.createElement('div');
  div.className = 'point-input-group';
  div.dataset.pointIndex = newIndex;
  div.innerHTML = `
    <label>ポイント${newIndex + 1}</label>
    <input type="text" class="point-title" placeholder="タイトル" value="">
    <input type="text" class="point-desc" placeholder="説明文" value="">
    <button type="button" class="btn-remove-point" title="削除">&times;</button>
  `;

  // 削除ボタンのイベント
  div.querySelector('.btn-remove-point').addEventListener('click', () => {
    if (container.children.length > 1) {
      div.remove();
      reindexPoints();
      updateAddButtonState();
      debouncedUpdatePreview();
    }
  });

  // 入力時にプレビュー更新
  div.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => debouncedUpdatePreview());
  });

  container.appendChild(div);
  updateAddButtonState();

  // 新しいフィールドにフォーカス
  div.querySelector('.point-title').focus();
}

// 現在のポイントデータを取得
export function getPointsData() {
  const container = document.getElementById('point-inputs-container');
  if (!container) return [];

  const points = [];
  container.querySelectorAll('.point-input-group').forEach(group => {
    const title = group.querySelector('.point-title')?.value || '';
    const desc = group.querySelector('.point-desc')?.value || '';
    points.push({ title, desc });
  });
  return points;
}

// ポイント追加ボタンの初期化
export function initPointsSection() {
  const addBtn = document.getElementById('btn-add-point');
  if (addBtn) {
    addBtn.addEventListener('click', addPoint);
  }

  // 初期状態で3つのポイントを表示
  renderPointInputs();
}

// ===========================================
// FAQ エディター
// ===========================================

// FAQ追加ボタンの初期化
export function initFAQSection() {
  const addBtn = document.getElementById('btn-add-faq');
  if (addBtn) {
    addBtn.addEventListener('click', addFAQItem);
  }

  // 初期状態で1つのFAQを表示
  renderFAQInputs([{ question: '', answer: '' }]);
}

// FAQリストを描画
export function renderFAQInputs(faqs = [{ question: '', answer: '' }]) {
  const container = document.getElementById('faq-list');
  if (!container) return;

  container.innerHTML = faqs.map((faq, index) => `
    <div class="faq-item" data-index="${index}">
      <div class="faq-item-header">
        <span class="faq-item-number">Q${index + 1}</span>
        <div class="faq-item-actions">
          <button type="button" class="faq-action-btn delete" data-index="${index}" title="削除">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
      <div class="faq-fields">
        <div class="faq-field">
          <label>
            <span class="faq-label-icon q">Q</span>
            質問
          </label>
          <input type="text" class="faq-question-input" value="${escapeHtml(faq.question)}" placeholder="例: 未経験でも応募できますか？">
        </div>
        <div class="faq-field">
          <label>
            <span class="faq-label-icon a">A</span>
            回答
          </label>
          <textarea class="faq-answer-input" rows="2" placeholder="例: はい、未経験の方も大歓迎です。丁寧に指導いたします。">${escapeHtml(faq.answer)}</textarea>
        </div>
      </div>
    </div>
  `).join('');

  // 削除ボタンのイベント
  container.querySelectorAll('.faq-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      removeFAQItem(index);
    });
  });

  // 入力フィールドの変更イベント
  container.querySelectorAll('.faq-question-input, .faq-answer-input').forEach(input => {
    input.addEventListener('input', () => {
      updateFAQHiddenField();
      debouncedUpdatePreview();
    });
  });

  // 初期状態で隠しフィールドを同期
  updateFAQHiddenField();
}

// FAQ項目を追加
export function addFAQItem() {
  const faqs = getFAQData();
  faqs.push({ question: '', answer: '' });
  renderFAQInputs(faqs);
  updateFAQHiddenField();

  // 新しく追加された項目の質問フィールドにフォーカス
  setTimeout(() => {
    const lastItem = document.querySelector('.faq-item:last-child .faq-question-input');
    if (lastItem) lastItem.focus();
  }, 100);
}

// FAQ項目を削除
export function removeFAQItem(index) {
  const faqs = getFAQData();
  if (faqs.length <= 1) {
    // 最後の1つは削除せず、空にする
    renderFAQInputs([{ question: '', answer: '' }]);
  } else {
    faqs.splice(index, 1);
    renderFAQInputs(faqs);
  }
  updateFAQHiddenField();
  debouncedUpdatePreview();
}

// FAQデータを取得
export function getFAQData() {
  const container = document.getElementById('faq-list');
  if (!container) return [];

  const faqs = [];
  container.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question-input')?.value?.trim() || '';
    const answer = item.querySelector('.faq-answer-input')?.value?.trim() || '';
    faqs.push({ question, answer });
  });
  return faqs;
}

// 非表示フィールドを更新（互換性のため）
export function updateFAQHiddenField() {
  const faqs = getFAQData();
  const hiddenField = document.getElementById('lp-faq');
  if (hiddenField) {
    // 従来の形式に変換: Q:質問|A:回答\nQ:質問2|A:回答2
    const faqString = faqs
      .filter(f => f.question || f.answer)
      .map(f => `Q:${f.question}|A:${f.answer}`)
      .join('\n');
    hiddenField.value = faqString;
  }
}

// FAQ文字列をパース
export function parseFAQString(faqString) {
  if (!faqString) return [{ question: '', answer: '' }];

  const faqs = [];
  // リテラルな\nを実際の改行に変換してから分割
  const normalizedString = faqString.replace(/\\n/g, '\n');
  // || または改行で分割
  const lines = normalizedString.split(/\|\||[\n\r]+/).filter(line => line.trim());

  for (const line of lines) {
    // Q:質問|A:回答 形式
    const match = line.match(/Q[:：](.+?)\|A[:：](.+)/i);
    if (match) {
      faqs.push({
        question: match[1].trim(),
        answer: match[2].trim()
      });
    }
  }

  return faqs.length > 0 ? faqs : [{ question: '', answer: '' }];
}

// CSVテキストを正しく行に分割（ダブルクォート内の改行を考慮）
function splitCSVToRows(csvText) {
  const rows = [];
  let currentRow = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];

    if (char === '"') {
      if (csvText[i + 1] === '"') {
        // エスケープされたダブルクォート
        currentRow += '""';
        i++;
      } else {
        // クォートの開始/終了
        insideQuotes = !insideQuotes;
        currentRow += char;
      }
    } else if (char === '\n' && !insideQuotes) {
      // 行の終わり（クォート外）
      if (currentRow.trim()) {
        rows.push(currentRow);
      }
      currentRow = '';
    } else if (char === '\r') {
      // キャリッジリターンは無視
      continue;
    } else {
      currentRow += char;
    }
  }

  // 最後の行を追加
  if (currentRow.trim()) {
    rows.push(currentRow);
  }

  return rows;
}

// LP設定CSVをパース（jobIdで検索）
function parseLPSettingsCSV(csvText, jobId) {
  const lines = splitCSVToRows(csvText);
  const headers = parseCSVLine(lines[0] || '');

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const rowData = {};

    headers.forEach((header, idx) => {
      const key = header.replace(/"/g, '').trim();
      rowData[key] = values[idx] || '';
    });

    // jobIdで検索（新形式）
    const rowJobId = rowData.jobId || rowData['求人ID'] || '';
    if (rowJobId === jobId) {
      const result = {
        heroTitle: rowData.heroTitle || rowData['ヒーロータイトル'] || '',
        heroSubtitle: rowData.heroSubtitle || rowData['ヒーローサブタイトル'] || '',
        heroImage: rowData.heroImage || rowData['ヒーロー画像'] || '',
        ctaText: rowData.ctaText || rowData['CTAテキスト'] || '',
        faq: rowData.faq || rowData['FAQ'] || '',
        designPattern: rowData.designPattern || rowData['デザインパターン'] || '',
        layoutStyle: rowData.layoutStyle || rowData['レイアウトスタイル'] || 'default',
        sectionOrder: rowData.sectionOrder || rowData['セクション順序'] || '',
        sectionVisibility: rowData.sectionVisibility || rowData['セクション表示'] || '',
        // 広告トラッキング設定
        tiktokPixelId: rowData.tiktokPixelId || rowData['TikTok Pixel ID'] || '',
        googleAdsId: rowData.googleAdsId || rowData['Google Ads ID'] || '',
        googleAdsLabel: rowData.googleAdsLabel || rowData['Google Ads ラベル'] || '',
        // OGP設定
        ogpTitle: rowData.ogpTitle || rowData['OGPタイトル'] || '',
        ogpDescription: rowData.ogpDescription || rowData['OGP説明文'] || '',
        ogpImage: rowData.ogpImage || rowData['OGP画像'] || '',
        // 新形式v2 LP構成データ
        lpContent: rowData.lpContent || rowData['LP構成'] || ''
      };

      // ポイント1〜6を動的に読み込み
      for (let i = 1; i <= 6; i++) {
        result[`pointTitle${i}`] = rowData[`pointTitle${i}`] || rowData[`ポイント${i}タイトル`] || '';
        result[`pointDesc${i}`] = rowData[`pointDesc${i}`] || rowData[`ポイント${i}説明`] || '';
      }

      return result;
    }
  }
  return null;
}

// LP設定フォームをクリア
export function clearLPForm() {
  const fields = [
    'lp-hero-title', 'lp-hero-subtitle', 'lp-hero-image',
    'lp-faq',
    'lp-tiktok-pixel', 'lp-google-ads-id', 'lp-google-ads-label',
    'lp-ogp-title', 'lp-ogp-description', 'lp-ogp-image'
  ];
  fields.forEach(id => setInputValue(id, ''));
  setInputValue('lp-cta-text', '今すぐ応募する');

  // ポイントを初期状態に戻す
  renderPointInputs();

  // FAQエディターを初期状態に戻す
  renderFAQInputs([{ question: '', answer: '' }]);

  const standardRadio = document.querySelector('input[name="design-pattern"][value="standard"]');
  if (standardRadio) standardRadio.checked = true;

  updateHeroImagePresetSelection('');

  // セクションマネージャーをリセット
  initSectionManagerIfNeeded();
  loadSectionsFromSettings({});
  renderSectionsList();
}

// ヒーロー画像プリセットをレンダリング
export function renderHeroImagePresets() {
  const container = document.getElementById('hero-image-presets');
  if (!container) return;

  container.innerHTML = heroImagePresets.map(preset => `
    <div class="hero-image-preset" data-url="${escapeHtml(preset.url)}" title="${escapeHtml(preset.name)}">
      <img src="${escapeHtml(preset.thumbnail)}" alt="${escapeHtml(preset.name)}" loading="lazy">
      <span class="preset-name">${escapeHtml(preset.name)}</span>
      <span class="preset-check">✓</span>
    </div>
  `).join('');

  container.querySelectorAll('.hero-image-preset').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.dataset.url;
      selectHeroImagePreset(url);
    });
  });
}

// ヒーロー画像プリセットを選択
export function selectHeroImagePreset(url) {
  const input = document.getElementById('lp-hero-image');
  if (input) {
    input.value = url;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  updateHeroImagePresetSelection(url);
}

// ヒーロー画像プリセットの選択状態を更新
export function updateHeroImagePresetSelection(selectedUrl) {
  const container = document.getElementById('hero-image-presets');
  if (!container) return;

  container.querySelectorAll('.hero-image-preset').forEach(item => {
    const itemUrl = item.dataset.url;
    const baseSelectedUrl = selectedUrl?.split('?')[0] || '';
    const baseItemUrl = itemUrl?.split('?')[0] || '';
    if (baseSelectedUrl && baseItemUrl && baseSelectedUrl === baseItemUrl) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

// LP設定を保存（求人ID単位）
export async function saveLPSettings() {
  console.log('[LP保存] saveLPSettings 開始');

  const jobId = document.getElementById('lp-job-select')?.value;
  console.log('[LP保存] jobId:', jobId);

  if (!jobId) {
    alert('求人を選択してください');
    console.log('[LP保存] jobIdがないため中断');
    return;
  }

  // 求人データを取得
  const jobData = currentJobData || allJobsCache.find(j => j.id === jobId);
  console.log('[LP保存] jobData:', jobData);

  if (!jobData) {
    alert('求人データが見つかりません');
    console.log('[LP保存] jobDataがないため中断');
    return;
  }

  // ポイントデータを取得
  const points = getPointsData();

  // レイアウトスタイルを取得（新しいUIから読み取り）
  const selectedLayoutOption = document.querySelector('.lp-admin-layout-option.selected');
  const layoutStyle = selectedLayoutOption?.dataset?.layout || 'default';

  const settings = {
    jobId: jobId,
    companyDomain: jobData.companyDomain,
    company: jobData.company,
    jobTitle: jobData.title,
    designPattern: document.querySelector('input[name="design-pattern"]:checked')?.value || 'standard',
    layoutStyle: layoutStyle,
    heroTitle: document.getElementById('lp-hero-title')?.value || '',
    heroSubtitle: document.getElementById('lp-hero-subtitle')?.value || '',
    heroImage: document.getElementById('lp-hero-image')?.value || '',
    ctaText: document.getElementById('lp-cta-text')?.value || '',
    faq: document.getElementById('lp-faq')?.value || '',
    sectionOrder: getSectionOrder().join(','),
    sectionVisibility: JSON.stringify(getSectionVisibility())
  };

  // ポイント1〜6を設定
  for (let i = 0; i < 6; i++) {
    settings[`pointTitle${i + 1}`] = points[i]?.title || '';
    settings[`pointDesc${i + 1}`] = points[i]?.desc || '';
  }

  // 広告トラッキング設定
  settings.tiktokPixelId = document.getElementById('lp-tiktok-pixel')?.value || '';
  settings.googleAdsId = document.getElementById('lp-google-ads-id')?.value || '';
  settings.googleAdsLabel = document.getElementById('lp-google-ads-label')?.value || '';

  // OGP設定
  settings.ogpTitle = document.getElementById('lp-ogp-title')?.value || '';
  settings.ogpDescription = document.getElementById('lp-ogp-description')?.value || '';
  settings.ogpImage = document.getElementById('lp-ogp-image')?.value || '';

  // 新形式v2のLP構成データ（セクションマネージャーから取得）
  const lpContent = getCurrentLPContent();
  if (lpContent) {
    settings.lpContent = JSON.stringify(lpContent);
  }

  // デバッグ: 送信するデータをログ
  console.log('[LP保存] 送信する設定:', settings);
  console.log('[LP保存] layoutStyle:', settings.layoutStyle);
  console.log('[LP保存] faq:', settings.faq);
  console.log('[LP保存] lpContent:', settings.lpContent ? 'あり' : 'なし');

  const gasApiUrl = spreadsheetConfig.gasApiUrl;
  if (gasApiUrl) {
    try {
      const saveBtn = document.getElementById('btn-save-lp-settings');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
      }

      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
        action: 'saveLPSettings',
        settings: settings
      }))));
      const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      const responseText = await response.text();
      console.log('[LP保存] GASレスポンス:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('[LP保存] パース済みレスポンス:', result);
      } catch (parseError) {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'LP設定を保存';
        }
        throw new Error(`GASからの応答が不正です: ${responseText.substring(0, 200)}`);
      }

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'LP設定を保存';
      }

      if (!result.success) {
        alert('スプレッドシートへの保存に失敗しました: ' + (result.error || '不明なエラー'));
        return;
      }

      localStorage.removeItem(`lp_settings_${jobId}`);
      alert(`LP設定をスプレッドシートに保存しました。\n\n求人: ${jobData.title}\n会社: ${jobData.company}\nデザインパターン: ${settings.designPattern}`);

    } catch (error) {
      console.error('GAS API呼び出しエラー:', error);
      alert('スプレッドシートへの保存中にエラーが発生しました。ローカルに保存します。');
      saveLPSettingsLocal(settings, jobId, jobData);
    }
  } else {
    saveLPSettingsLocal(settings, jobId, jobData);
  }
}

// ローカルストレージにLP設定を保存
function saveLPSettingsLocal(settings, jobId, jobData) {
  const lpSettingsKey = `lp_settings_${jobId}`;
  localStorage.setItem(lpSettingsKey, JSON.stringify(settings));
  alert(`LP設定をローカルに保存しました。\n\n注意: スプレッドシートに自動保存するには、設定画面でGAS API URLを設定してください。\n\n求人: ${jobData?.title || jobId}\nデザインパターン: ${settings.designPattern}`);
}

// セクションの順番を取得
export function getSectionOrder() {
  const orderList = document.getElementById('lp-section-order');
  if (!orderList) {
    return ['hero', 'points', 'jobs', 'details', 'faq', 'apply'];
  }
  return Array.from(orderList.querySelectorAll('li')).map(li => li.dataset.section);
}

// セクションの表示状態を取得
export function getSectionVisibility() {
  return {
    points: document.getElementById('section-points-visible')?.checked ?? true,
    jobs: document.getElementById('section-jobs-visible')?.checked ?? true,
    details: document.getElementById('section-details-visible')?.checked ?? true,
    faq: document.getElementById('section-faq-visible')?.checked ?? true
  };
}

// セクション順序を適用
export function applySectionOrder(orderString) {
  const orderList = document.getElementById('lp-section-order');
  if (!orderList || !orderString) return;

  const order = orderString.split(',').map(s => s.trim()).filter(s => s);
  if (order.length === 0) return;

  const items = Array.from(orderList.querySelectorAll('.section-order-item'));
  const itemMap = {};
  items.forEach(item => {
    itemMap[item.dataset.section] = item;
  });

  order.forEach(section => {
    const item = itemMap[section];
    if (item) {
      orderList.appendChild(item);
    }
  });
}

// セクション表示状態を適用
export function applySectionVisibility(visibilityString) {
  if (!visibilityString) return;

  try {
    const visibility = JSON.parse(visibilityString);
    ['points', 'jobs', 'details', 'faq'].forEach(key => {
      if (visibility[key] !== undefined) {
        const el = document.getElementById(`section-${key}-visible`);
        if (el) el.checked = visibility[key];
      }
    });
  } catch (e) {
    console.error('セクション表示状態のパースエラー:', e);
  }
}

// デバウンス付きプレビュー更新
export function debouncedUpdatePreview() {
  if (previewUpdateTimer) {
    clearTimeout(previewUpdateTimer);
  }
  previewUpdateTimer = setTimeout(() => {
    updateLPPreview();
  }, 300);
}

// プレビュー表示/非表示切り替え
export function toggleLPPreview() {
  const container = document.getElementById('lp-preview-container');
  const btn = document.getElementById('btn-toggle-preview');

  if (!container) return;

  if (container.style.display === 'none') {
    container.style.display = 'flex';
    if (btn) btn.textContent = 'プレビューを隠す';
    updateLPPreview();
  } else {
    container.style.display = 'none';
    if (btn) btn.textContent = 'プレビュー表示';
  }
}

// プレビューを閉じる
export function closeLPPreview() {
  const container = document.getElementById('lp-preview-container');
  const btn = document.getElementById('btn-toggle-preview');

  if (container) container.style.display = 'none';
  if (btn) btn.textContent = 'プレビュー表示';
}

// LPプレビューを更新
export function updateLPPreview() {
  const iframe = document.getElementById('lp-preview-frame');
  const container = document.getElementById('lp-preview-container');

  if (!iframe || !container || container.style.display === 'none') return;

  const companyDomain = selectedCompanyDomain;
  if (!companyDomain) return;

  // 会社データを取得
  const companiesCache = getCompaniesCache();
  const company = companiesCache?.find(c => c.companyDomain === companyDomain) || {
    company: companyDomain,
    companyDomain: companyDomain
  };

  // 現在のフォームデータからLP設定を構築
  const lpSettings = getCurrentLPSettings();

  // プレビューHTMLを生成
  const previewHtml = generatePreviewHtml(company, lpSettings);

  // iframeに注入
  iframe.srcdoc = previewHtml;
}

// 現在のフォーム値からLP設定オブジェクトを取得
function getCurrentLPSettings() {
  const points = getPointsData();
  // レイアウトスタイルを取得（新しいUIから読み取り）
  const selectedLayoutOption = document.querySelector('.lp-admin-layout-option.selected');
  const layoutStyle = selectedLayoutOption?.dataset?.layout || 'default';

  const settings = {
    designPattern: document.querySelector('input[name="design-pattern"]:checked')?.value || 'standard',
    layoutStyle: layoutStyle,
    heroTitle: document.getElementById('lp-hero-title')?.value || '',
    heroSubtitle: document.getElementById('lp-hero-subtitle')?.value || '',
    heroImage: document.getElementById('lp-hero-image')?.value || '',
    ctaText: document.getElementById('lp-cta-text')?.value || '今すぐ応募する',
    faq: document.getElementById('lp-faq')?.value || '',
    sectionOrder: getSectionOrder().join(','),
    sectionVisibility: JSON.stringify(getSectionVisibility())
  };

  // ポイントデータを設定に追加
  for (let i = 0; i < 6; i++) {
    settings[`pointTitle${i + 1}`] = points[i]?.title || '';
    settings[`pointDesc${i + 1}`] = points[i]?.desc || '';
  }

  return settings;
}

// プレビューHTML生成
function generatePreviewHtml(company, lpSettings) {
  const patternClass = `lp-pattern-${lpSettings.designPattern || 'standard'}`;

  // セクション表示設定を解析
  let sectionVisibility = { points: true, jobs: true, details: true, faq: true };
  try {
    if (lpSettings.sectionVisibility) {
      sectionVisibility = { ...sectionVisibility, ...JSON.parse(lpSettings.sectionVisibility) };
    }
  } catch (e) {}

  // セクション順序を解析
  const defaultOrder = ['hero', 'points', 'jobs', 'details', 'faq', 'apply'];
  let sectionOrder = defaultOrder;
  if (lpSettings.sectionOrder) {
    const customOrder = lpSettings.sectionOrder.split(',').map(s => s.trim()).filter(s => s);
    if (customOrder.length > 0) {
      const missingSections = defaultOrder.filter(s => !customOrder.includes(s));
      sectionOrder = [...customOrder, ...missingSections];
    }
  }

  // 各セクションをレンダリング
  const sectionsHtml = sectionOrder.map(section => {
    switch (section) {
      case 'hero':
        return renderPreviewHero(company, lpSettings);
      case 'points':
        return sectionVisibility.points ? renderPreviewPoints(lpSettings) : '';
      case 'jobs':
        return sectionVisibility.jobs ? renderPreviewJobs(company) : '';
      case 'details':
        return sectionVisibility.details ? renderPreviewDetails(company) : '';
      case 'faq':
        return (sectionVisibility.faq && lpSettings.faq) ? renderPreviewFAQ(lpSettings.faq) : '';
      case 'apply':
        return renderPreviewApply(company, lpSettings);
      default:
        return '';
    }
  }).join('');

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
  <style>
    ${getPreviewStyles()}
  </style>
</head>
<body class="lp-body ${patternClass}">
  <div id="lp-content">
    ${sectionsHtml}
  </div>
</body>
</html>
  `;
}

// ヒーローセクション
function renderPreviewHero(company, lpSettings) {
  const heroTitle = lpSettings.heroTitle || `${company.company || '会社名'}で働こう`;
  const heroSubtitle = lpSettings.heroSubtitle || '';
  const heroImage = lpSettings.heroImage || '';

  return `
    <section class="lp-hero">
      <div class="lp-hero-bg" style="${heroImage ? `background-image: url('${escapeHtml(heroImage)}')` : 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}"></div>
      <div class="lp-hero-overlay"></div>
      <div class="lp-hero-content">
        <p class="lp-hero-company">${escapeHtml(company.company || '')}</p>
        <h1 class="lp-hero-title">${escapeHtml(heroTitle)}</h1>
        ${heroSubtitle ? `<p class="lp-hero-subtitle">${escapeHtml(heroSubtitle)}</p>` : ''}
        <div class="lp-hero-cta">
          <a href="#lp-apply" class="lp-btn-apply-hero">今すぐ応募する</a>
        </div>
      </div>
    </section>
  `;
}

// ポイントセクション
function renderPreviewPoints(lpSettings) {
  const points = [];
  for (let i = 1; i <= 6; i++) {
    const title = lpSettings[`pointTitle${i}`];
    const desc = lpSettings[`pointDesc${i}`] || '';
    if (title) {
      points.push({ title, desc, idx: i });
    }
  }

  if (points.length === 0) return '';

  return `
    <section class="lp-points">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">この求人のポイント</h2>
        <div class="lp-points-grid">
          ${points.map((point, idx) => `
            <div class="lp-point-card">
              <div class="lp-point-number">${idx + 1}</div>
              <h3 class="lp-point-title">${escapeHtml(point.title)}</h3>
              <p class="lp-point-desc">${escapeHtml(point.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// 求人セクション（プレースホルダー）
function renderPreviewJobs(company) {
  return `
    <section class="lp-jobs">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">募集中の求人</h2>
        <div class="lp-jobs-placeholder">
          <p>求人情報は実際のページでご確認ください</p>
        </div>
      </div>
    </section>
  `;
}

// 募集要項セクション（プレースホルダー）
function renderPreviewDetails(company) {
  return `
    <section class="lp-details">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">募集要項</h2>
        <div class="lp-details-placeholder">
          <p>詳細な募集要項は実際のページでご確認ください</p>
        </div>
      </div>
    </section>
  `;
}

// FAQセクション
function renderPreviewFAQ(faqText) {
  if (!faqText) return '';

  // || または改行で分割（保存形式は改行区切り）
  const faqItems = faqText.split(/\|\||[\n\r]+/).filter(item => item.trim()).map(item => {
    // Q:質問|A:回答 形式をパース
    const match = item.match(/Q[:：](.+?)\|A[:：](.+)/i);
    if (match) {
      return {
        question: match[1].trim(),
        answer: match[2].trim()
      };
    }
    return null;
  }).filter(item => item && item.question && item.answer);

  if (faqItems.length === 0) return '';

  return `
    <section class="lp-faq">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">よくある質問</h2>
        <div class="lp-faq-list">
          ${faqItems.map(item => `
            <div class="lp-faq-item">
              <div class="lp-faq-question">
                <span class="lp-faq-q">Q</span>
                <span>${escapeHtml(item.question)}</span>
              </div>
              <div class="lp-faq-answer">
                <span class="lp-faq-a">A</span>
                <span>${escapeHtml(item.answer)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// 応募セクション
function renderPreviewApply(company, lpSettings) {
  const ctaText = lpSettings.ctaText || '今すぐ応募する';

  return `
    <section class="lp-apply" id="lp-apply">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">応募する</h2>
        <p class="lp-apply-text">ご応募お待ちしております</p>
        <div class="lp-apply-buttons">
          <button class="lp-btn-apply-main">${escapeHtml(ctaText)}</button>
        </div>
      </div>
    </section>
  `;
}

// プレビュー用スタイル
function getPreviewStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans JP', sans-serif; line-height: 1.6; color: #333; }

    .lp-hero { position: relative; min-height: 400px; display: flex; align-items: center; justify-content: center; }
    .lp-hero-bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
    .lp-hero-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); }
    .lp-hero-content { position: relative; z-index: 1; text-align: center; color: #fff; padding: 40px 20px; }
    .lp-hero-company { font-size: 14px; margin-bottom: 10px; opacity: 0.9; }
    .lp-hero-title { font-size: 28px; font-weight: 900; margin-bottom: 15px; }
    .lp-hero-subtitle { font-size: 16px; opacity: 0.9; margin-bottom: 20px; }
    .lp-hero-cta { margin-top: 20px; }
    .lp-btn-apply-hero { display: inline-block; padding: 15px 40px; background: #ff6b35; color: #fff; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; }

    .lp-section-inner { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    .lp-section-title { font-size: 24px; font-weight: 700; text-align: center; margin-bottom: 30px; }

    .lp-points { background: #f8f9fa; }
    .lp-points-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .lp-point-card { background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .lp-point-number { width: 36px; height: 36px; background: #667eea; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; margin-bottom: 15px; }
    .lp-point-title { font-size: 18px; font-weight: 700; margin-bottom: 10px; }
    .lp-point-desc { font-size: 14px; color: #666; }

    .lp-jobs, .lp-details { background: #fff; }
    .lp-jobs-placeholder, .lp-details-placeholder { text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px; color: #888; }

    .lp-faq { background: #f8f9fa; }
    .lp-faq-list { display: flex; flex-direction: column; gap: 15px; }
    .lp-faq-item { background: #fff; border-radius: 8px; padding: 20px; }
    .lp-faq-question { display: flex; gap: 12px; font-weight: 600; margin-bottom: 10px; }
    .lp-faq-answer { display: flex; gap: 12px; color: #666; }
    .lp-faq-q, .lp-faq-a { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
    .lp-faq-q { background: #667eea; color: #fff; }
    .lp-faq-a { background: #e9ecef; color: #333; }

    .lp-apply { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; text-align: center; }
    .lp-apply .lp-section-title { color: #fff; }
    .lp-apply-text { margin-bottom: 25px; opacity: 0.9; }
    .lp-btn-apply-main { padding: 18px 50px; background: #ff6b35; color: #fff; border: none; border-radius: 50px; font-size: 18px; font-weight: 700; cursor: pointer; }

    /* デザインパターン */
    .lp-pattern-modern .lp-point-number { background: #10b981; }
    .lp-pattern-modern .lp-btn-apply-hero, .lp-pattern-modern .lp-btn-apply-main { background: #10b981; }
    .lp-pattern-modern .lp-apply { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
    .lp-pattern-modern .lp-faq-q { background: #10b981; }

    .lp-pattern-classic .lp-point-number { background: #92400e; }
    .lp-pattern-classic .lp-btn-apply-hero, .lp-pattern-classic .lp-btn-apply-main { background: #b45309; }
    .lp-pattern-classic .lp-apply { background: linear-gradient(135deg, #92400e 0%, #78350f 100%); }
    .lp-pattern-classic .lp-faq-q { background: #92400e; }

    .lp-pattern-minimal .lp-point-number { background: #374151; }
    .lp-pattern-minimal .lp-btn-apply-hero, .lp-pattern-minimal .lp-btn-apply-main { background: #111827; }
    .lp-pattern-minimal .lp-apply { background: #111827; }
    .lp-pattern-minimal .lp-faq-q { background: #374151; }

    .lp-pattern-colorful .lp-point-number { background: #ec4899; }
    .lp-pattern-colorful .lp-btn-apply-hero, .lp-pattern-colorful .lp-btn-apply-main { background: linear-gradient(90deg, #ec4899, #8b5cf6); }
    .lp-pattern-colorful .lp-apply { background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); }
    .lp-pattern-colorful .lp-faq-q { background: #ec4899; }
  `;
}

// セクション並び替え初期化
export function initSectionSortable() {
  const list = document.getElementById('lp-section-order');
  if (!list) return;

  let draggedItem = null;

  // タッチデバイス対応
  let touchStartY = 0;
  let touchCurrentItem = null;

  list.querySelectorAll('.section-order-item').forEach(item => {
    item.setAttribute('draggable', 'true');

    // ドラッグ開始
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', ''); // Firefox対応

      // ドラッグゴースト画像の透明度調整
      setTimeout(() => {
        item.style.opacity = '0.4';
      }, 0);
    });

    // ドラッグ終了
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      item.style.opacity = '';
      draggedItem = null;

      // 全アイテムからdrag-overクラスを削除
      list.querySelectorAll('.section-order-item').forEach(i => {
        i.classList.remove('drag-over');
      });

      // プレビュー更新
      updateLPPreview();

      // 更新アニメーション
      item.style.animation = 'none';
      item.offsetHeight; // リフロー
      item.style.animation = 'sortableDropped 0.3s ease';
    });

    // ドラッグオーバー
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (!draggedItem || draggedItem === item) return;

      const afterElement = getDragAfterElement(list, e.clientY);

      // ドラッグオーバー表示を更新
      list.querySelectorAll('.section-order-item').forEach(i => {
        i.classList.remove('drag-over');
      });

      if (afterElement && afterElement !== draggedItem) {
        afterElement.classList.add('drag-over');
      }

      if (afterElement == null) {
        list.appendChild(draggedItem);
      } else {
        list.insertBefore(draggedItem, afterElement);
      }
    });

    // ドラッグ離脱
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    // タッチ開始（モバイル対応）
    item.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
      touchCurrentItem = item;
      item.classList.add('dragging');
    }, { passive: true });

    // タッチ移動
    item.addEventListener('touchmove', (e) => {
      if (!touchCurrentItem) return;

      const touchY = e.touches[0].clientY;
      const afterElement = getDragAfterElement(list, touchY);

      if (afterElement == null) {
        list.appendChild(touchCurrentItem);
      } else if (afterElement !== touchCurrentItem) {
        list.insertBefore(touchCurrentItem, afterElement);
      }
    }, { passive: true });

    // タッチ終了
    item.addEventListener('touchend', () => {
      if (touchCurrentItem) {
        touchCurrentItem.classList.remove('dragging');
        updateLPPreview();
      }
      touchCurrentItem = null;
    });
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.section-order-item:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// セクションマネージャー初期化をエクスポート
export { initSectionManagerIfNeeded };

export default {
  loadCompanyListForLP,
  loadJobListForLP,
  loadLPSettings,
  clearLPForm,
  renderHeroImagePresets,
  selectHeroImagePreset,
  updateHeroImagePresetSelection,
  saveLPSettings,
  getSectionOrder,
  getSectionVisibility,
  applySectionOrder,
  applySectionVisibility,
  debouncedUpdatePreview,
  toggleLPPreview,
  closeLPPreview,
  updateLPPreview,
  initSectionSortable,
  renderPointInputs,
  addPoint,
  getPointsData,
  initPointsSection,
  initSectionManagerIfNeeded
};
