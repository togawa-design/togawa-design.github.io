/**
 * Admin Dashboard - LP設定モジュール
 */

import { escapeHtml } from '@shared/utils.js';
import { spreadsheetConfig, heroImagePresets } from './config.js';
import { parseCSVLine } from './csv-utils.js';
import { getCompaniesCache, loadCompanyManageData } from './company-manager.js';

let previewUpdateTimer = null;
const MAX_POINTS = 6;

// LP設定用の会社リストを読み込み
export async function loadCompanyListForLP() {
  const select = document.getElementById('lp-company-select');
  if (!select) return;

  let companiesCache = getCompaniesCache();
  if (!companiesCache || companiesCache.length === 0) {
    await loadCompanyManageData();
    companiesCache = getCompaniesCache();
  }

  const visibleCompanies = companiesCache.filter(c =>
    c.companyDomain && (c.showCompany === '○' || c.showCompany === '◯')
  );

  select.innerHTML = '<option value="">-- 会社を選択 --</option>' +
    visibleCompanies.map(c =>
      `<option value="${escapeHtml(c.companyDomain)}">${escapeHtml(c.company)}</option>`
    ).join('');
}

// LP設定を読み込み
export async function loadLPSettings(companyDomain) {
  const editor = document.getElementById('lp-editor');
  const previewBtn = document.getElementById('lp-preview-btn');
  const editModeBtn = document.getElementById('lp-edit-mode-btn');

  if (!companyDomain) {
    if (editor) editor.style.display = 'none';
    return;
  }

  if (editor) editor.style.display = 'block';
  if (previewBtn) previewBtn.href = `lp.html?c=${encodeURIComponent(companyDomain)}`;
  if (editModeBtn) editModeBtn.href = `lp.html?c=${encodeURIComponent(companyDomain)}&edit`;

  renderHeroImagePresets();

  const companiesCache = getCompaniesCache();
  const company = companiesCache?.find(c => c.companyDomain === companyDomain);
  if (company) {
    const patternRadio = document.querySelector(`input[name="design-pattern"][value="${company.designPattern || 'standard'}"]`);
    if (patternRadio) patternRadio.checked = true;
  }

  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetConfig.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(spreadsheetConfig.lpSettingsSheetName)}`;
    const response = await fetch(csvUrl);

    if (response.ok) {
      const csvText = await response.text();
      const settings = parseLPSettingsCSV(csvText, companyDomain);

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

// LP設定CSVをパース
function parseLPSettingsCSV(csvText, companyDomain) {
  const lines = csvText.split('\n');
  const headers = parseCSVLine(lines[0] || '');

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const rowData = {};

    headers.forEach((header, idx) => {
      const key = header.replace(/"/g, '').trim();
      rowData[key] = values[idx] || '';
    });

    if (rowData.companyDomain === companyDomain || rowData['会社ドメイン'] === companyDomain) {
      const result = {
        heroTitle: rowData.heroTitle || rowData['ヒーロータイトル'] || '',
        heroSubtitle: rowData.heroSubtitle || rowData['ヒーローサブタイトル'] || '',
        heroImage: rowData.heroImage || rowData['ヒーロー画像'] || '',
        ctaText: rowData.ctaText || rowData['CTAテキスト'] || '',
        faq: rowData.faq || rowData['FAQ'] || '',
        designPattern: rowData.designPattern || rowData['デザインパターン'] || '',
        sectionOrder: rowData.sectionOrder || rowData['セクション順序'] || '',
        sectionVisibility: rowData.sectionVisibility || rowData['セクション表示'] || '',
        // 広告トラッキング設定
        tiktokPixelId: rowData.tiktokPixelId || rowData['TikTok Pixel ID'] || '',
        googleAdsId: rowData.googleAdsId || rowData['Google Ads ID'] || '',
        googleAdsLabel: rowData.googleAdsLabel || rowData['Google Ads ラベル'] || '',
        // OGP設定
        ogpTitle: rowData.ogpTitle || rowData['OGPタイトル'] || '',
        ogpDescription: rowData.ogpDescription || rowData['OGP説明文'] || '',
        ogpImage: rowData.ogpImage || rowData['OGP画像'] || ''
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

  const standardRadio = document.querySelector('input[name="design-pattern"][value="standard"]');
  if (standardRadio) standardRadio.checked = true;

  updateHeroImagePresetSelection('');
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

// LP設定を保存
export async function saveLPSettings() {
  const companyDomain = document.getElementById('lp-company-select')?.value;
  if (!companyDomain) {
    alert('会社を選択してください');
    return;
  }

  // ポイントデータを取得
  const points = getPointsData();

  const settings = {
    companyDomain: companyDomain,
    designPattern: document.querySelector('input[name="design-pattern"]:checked')?.value || 'standard',
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

      let result;
      try {
        result = JSON.parse(responseText);
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

      localStorage.removeItem(`lp_settings_${companyDomain}`);
      alert(`LP設定をスプレッドシートに保存しました。\n\n会社: ${companyDomain}\nデザインパターン: ${settings.designPattern}`);

    } catch (error) {
      console.error('GAS API呼び出しエラー:', error);
      alert('スプレッドシートへの保存中にエラーが発生しました。ローカルに保存します。');
      saveLPSettingsLocal(settings, companyDomain);
    }
  } else {
    saveLPSettingsLocal(settings, companyDomain);
  }
}

// ローカルストレージにLP設定を保存
function saveLPSettingsLocal(settings, companyDomain) {
  const lpSettingsKey = `lp_settings_${companyDomain}`;
  localStorage.setItem(lpSettingsKey, JSON.stringify(settings));
  alert(`LP設定をローカルに保存しました。\n\n注意: スプレッドシートに自動保存するには、設定画面でGAS API URLを設定してください。\n\n会社: ${companyDomain}\nデザインパターン: ${settings.designPattern}`);
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
  // プレビュー機能は複雑なため、既存のadmin-company.jsのロジックを参照
  console.log('LP Preview update triggered');
}

// セクション並び替え初期化
export function initSectionSortable() {
  const list = document.getElementById('lp-section-order');
  if (!list) return;

  let draggedItem = null;

  list.querySelectorAll('.section-order-item').forEach(item => {
    item.setAttribute('draggable', 'true');

    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedItem = null;
      updateLPPreview();
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const afterElement = getDragAfterElement(list, e.clientY);
      if (afterElement == null) {
        list.appendChild(draggedItem);
      } else {
        list.insertBefore(draggedItem, afterElement);
      }
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

export default {
  loadCompanyListForLP,
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
  initPointsSection
};
