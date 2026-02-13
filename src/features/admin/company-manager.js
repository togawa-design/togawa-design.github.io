/**
 * Admin Dashboard - 会社管理モジュール
 */

import { escapeHtml, showToast } from '@shared/utils.js';
import { getPatternLabel, heroImagePresets } from './config.js';
import * as FirestoreService from '@shared/firestore-service.js';
// auth.jsからのimportは不要（会社ビューモードはサイドバーで管理）

// キャッシュ
let companiesCache = [];
let currentEditingCompany = null;
let isNewCompany = false;

export function getCompaniesCache() {
  return companiesCache;
}

// 会社一覧データを読み込み
export async function loadCompanyManageData() {
  const tbody = document.getElementById('company-manage-tbody');

  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データを読み込み中...</td></tr>';
  }

  try {
    // Firestoreから読み込み
    FirestoreService.initFirestore();
    const result = await FirestoreService.getCompanies();

    if (!result.success) {
      throw new Error(result.error || '会社データの取得に失敗しました');
    }

    companiesCache = result.companies || [];

    if (tbody) {
      if (companiesCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">会社データがありません</td></tr>';
        return;
      }
      renderCompanyTable();
    }

  } catch (error) {
    console.error('会社データの読み込みエラー:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データの読み込みに失敗しました</td></tr>';
    }
  }
}

// 会社CSVをパース
function parseCompanyCSV(csvText) {
  const lines = csvText.split('\n');
  const headers = parseCSVLine(lines[0] || '');
  const companies = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const company = {};

    headers.forEach((header, index) => {
      const key = normalizeHeader(header);
      company[key] = values[index] || '';
    });

    companies.push(company);
  }

  return companies;
}

// 会社編集ページへ遷移（SPA内遷移）
export function editCompany(domain) {
  // キャッシュから会社データを取得してsessionStorageに保存（高速読み込み用）
  const company = companiesCache?.find(c => c.companyDomain === domain);
  if (company) {
    sessionStorage.setItem('editing_company_data', JSON.stringify(company));
  }

  // SPA内遷移を使用
  if (window.AdminDashboard?.navigateToCompanyEdit) {
    window.AdminDashboard.navigateToCompanyEdit(domain, 'company-manage');
  } else {
    // フォールバック: ページ遷移
    window.location.href = `company-edit.html?domain=${encodeURIComponent(domain)}`;
  }
}

// 新規会社登録ページへ遷移（SPA内遷移）
export function showCompanyModal() {
  // SPA内遷移を使用
  if (window.AdminDashboard?.navigateToCompanyEdit) {
    window.AdminDashboard.navigateToCompanyEdit(null, 'company-manage');
  } else {
    // フォールバック: ページ遷移
    window.location.href = 'company-edit.html';
  }
}

// 会社編集モーダルを閉じる
export function closeCompanyModal() {
  const modal = document.getElementById('company-modal');
  if (modal) modal.style.display = 'none';
  currentEditingCompany = null;
  isNewCompany = false;
}

// 会社データを保存
export async function saveCompanyData() {
  const companyDomainEl = document.getElementById('edit-company-domain');
  const companyDomain = companyDomainEl?.value.trim().toLowerCase() || '';

  const companyData = {
    company: document.getElementById('edit-company-name')?.value.trim() || '',
    company_domain: companyDomain,
    companyDomain: companyDomain,
    designPattern: document.getElementById('edit-design-pattern')?.value || 'modern',
    imageUrl: document.getElementById('edit-image-url')?.value.trim() || '',
    order: document.getElementById('edit-order')?.value || '',
    description: document.getElementById('edit-description')?.value.trim() || '',
    showCompany: document.getElementById('edit-show-company')?.checked ? '○' : '',
    visible: document.getElementById('edit-show-company')?.checked ? '○' : ''
  };

  if (!companyData.company || !companyData.companyDomain) {
    showToast('会社名と会社ドメインは必須です', 'error');
    return;
  }

  if (!/^[a-z0-9-]+$/.test(companyData.companyDomain)) {
    showToast('会社ドメインは半角英数字とハイフンのみ使用できます', 'error');
    return;
  }

  if (isNewCompany) {
    const existing = companiesCache?.find(c => c.companyDomain === companyData.companyDomain);
    if (existing) {
      showToast('このドメインは既に使用されています', 'error');
      return;
    }
  }

  // Firestoreに保存
  try {
    const saveBtn = document.getElementById('company-modal-save');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';
    }

    FirestoreService.initFirestore();

    // Firestore用にデータを整形
    const firestoreData = {
      company: companyData.company,
      companyAddress: companyData.companyAddress || '',
      description: companyData.description,
      imageUrl: companyData.imageUrl,
      designPattern: companyData.designPattern,
      order: parseInt(companyData.order) || 0,
      showCompany: companyData.showCompany === '○' || companyData.showCompany === '◯'
    };

    const result = await FirestoreService.saveCompany(companyDomain, firestoreData);

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存';
    }

    if (!result.success) {
      showToast('Firestoreへの保存に失敗しました: ' + (result.error || '不明なエラー'), 'error');
      return;
    }

    localStorage.removeItem(`company_data_${companyData.companyDomain}`);

    if (isNewCompany) {
      companiesCache.push(companyData);
    } else {
      const idx = companiesCache.findIndex(c => c.companyDomain === companyData.companyDomain);
      if (idx !== -1) {
        companiesCache[idx] = companyData;
      }
    }

    closeCompanyModal();
    renderCompanyTable();

    showToast('会社情報を保存しました', 'success');

  } catch (error) {
    console.error('Firestore保存エラー:', error);
    showToast('Firestoreへの保存中にエラーが発生しました: ' + error.message, 'error');
  }
}

// ローカルストレージに会社データを保存
function saveCompanyDataLocal(companyData) {
  const companyStorageKey = `company_data_${companyData.companyDomain}`;
  localStorage.setItem(companyStorageKey, JSON.stringify(companyData));

  if (isNewCompany) {
    companiesCache.push(companyData);
  } else {
    const idx = companiesCache.findIndex(c => c.companyDomain === companyData.companyDomain);
    if (idx !== -1) {
      companiesCache[idx] = companyData;
    }
  }

  closeCompanyModal();
  renderCompanyTable();

  showToast('会社情報をローカルに保存しました', 'warning');
}

// 会社テーブルを再描画
export function renderCompanyTable() {
  const tbody = document.getElementById('company-manage-tbody');
  if (!tbody) return;

  const companies = companiesCache || [];

  if (companies.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">会社データがありません</td></tr>';
    return;
  }

  tbody.innerHTML = companies.map(company => `
    <tr data-domain="${escapeHtml(company.companyDomain || '')}">
      <td>${escapeHtml(company.company || '')}</td>
      <td><code>${escapeHtml(company.companyDomain || '')}</code></td>
      <td><span class="badge ${company.designPattern || 'modern'}">${getPatternLabel(company.designPattern || 'modern')}</span></td>
      <td>${company.showCompany === true || company.showCompany === '○' || company.showCompany === '◯' ? '<span class="badge success">表示</span>' : '<span class="badge">非表示</span>'}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-small btn-edit" data-action="edit" data-domain="${escapeHtml(company.companyDomain || '')}">編集</button>
          <button class="btn-small btn-primary" data-action="jobs" data-domain="${escapeHtml(company.companyDomain || '')}">求人管理</button>
          <button class="btn-small btn-secondary" data-action="recruit" data-domain="${escapeHtml(company.companyDomain || '')}">採用ページ確認</button>
        </div>
      </td>
    </tr>
  `).join('');

  // イベント委譲でボタンクリックを処理（要素ごとに重複防止）
  if (!tbody.dataset.eventBound) {
    tbody.dataset.eventBound = 'true';
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const domain = btn.dataset.domain;

      console.log('[CompanyManager] Action clicked:', action, domain);

      if (action === 'edit') {
        editCompany(domain);
      } else if (action === 'jobs') {
        // 埋め込みJob-Manage画面に遷移
        openJobsArea(domain);
      } else if (action === 'recruit') {
        // 採用ページ設定に遷移して会社選択済み
        navigateToRecruitSettings(domain);
      }
    });
  }
}

// 採用ページ設定に遷移して会社選択
function navigateToRecruitSettings(companyDomain) {
  const company = companiesCache?.find(c => c.companyDomain === companyDomain);
  // カスタムイベントで遷移を通知
  const event = new CustomEvent('navigateToSection', {
    detail: { section: 'recruit-settings', companyDomain, company }
  });
  document.dispatchEvent(event);
}

// 求人管理画面を開く
export function openJobsArea(companyDomain) {
  const company = companiesCache?.find(c => c.companyDomain === companyDomain);
  if (!company) {
    showToast('会社情報が見つかりません', 'error');
    return;
  }

  // 埋め込みナビゲーションを使用（SPA内遷移）
  if (window.AdminDashboard?.navigateToJobManage) {
    window.AdminDashboard.navigateToJobManage(
      companyDomain,
      company.company || companyDomain,
      'company-manage'
    );
  } else {
    // フォールバック: ページ遷移
    const params = new URLSearchParams();
    params.set('domain', companyDomain);
    params.set('company', company.company || companyDomain);
    if (company.manageSheetUrl) {
      params.set('sheetUrl', company.manageSheetUrl);
    }
    window.location.href = `job-manage.html?${params.toString()}`;
  }
}

export default {
  loadCompanyManageData,
  getCompaniesCache,
  editCompany,
  showCompanyModal,
  closeCompanyModal,
  saveCompanyData,
  renderCompanyTable,
  openJobsArea
};
