/**
 * Admin Dashboard - 会社管理モジュール
 */

import { escapeHtml } from '@shared/utils.js';
import { spreadsheetConfig, getPatternLabel, heroImagePresets, useFirestore } from './config.js';
import { parseCSVLine, normalizeHeader } from './csv-utils.js';
import * as FirestoreService from '@shared/firestore-service.js';

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
    let companies = [];

    // Firestoreから読み込み
    if (useFirestore) {
      FirestoreService.initFirestore();
      const result = await FirestoreService.getCompanies();

      if (result.success) {
        companies = result.companies || [];
      } else {
        throw new Error(result.error || '会社データの取得に失敗しました');
      }
    } else {
      // CSVから読み込み（フォールバック）
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetConfig.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(spreadsheetConfig.companySheetName)}`;
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error('データの取得に失敗しました');

      const csvText = await response.text();
      companies = parseCompanyCSV(csvText);

      // ローカルストレージの更新データをマージ
      companies = companies.map(company => {
        if (company.companyDomain) {
          const storedData = localStorage.getItem(`company_data_${company.companyDomain}`);
          if (storedData) {
            try {
              const updatedData = JSON.parse(storedData);
              return { ...company, ...updatedData };
            } catch (e) {
              console.error('ローカルストレージのパースエラー:', e);
            }
          }
        }
        return company;
      });
    }

    companiesCache = companies;

    if (tbody) {
      if (companies.length === 0) {
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
    designPattern: document.getElementById('edit-design-pattern')?.value || 'standard',
    imageUrl: document.getElementById('edit-image-url')?.value.trim() || '',
    order: document.getElementById('edit-order')?.value || '',
    description: document.getElementById('edit-description')?.value.trim() || '',
    showCompany: document.getElementById('edit-show-company')?.checked ? '○' : '',
    visible: document.getElementById('edit-show-company')?.checked ? '○' : ''
  };

  if (!companyData.company || !companyData.companyDomain) {
    alert('会社名と会社ドメインは必須です');
    return;
  }

  if (!/^[a-z0-9-]+$/.test(companyData.companyDomain)) {
    alert('会社ドメインは半角英数字とハイフンのみ使用できます');
    return;
  }

  if (isNewCompany) {
    const existing = companiesCache?.find(c => c.companyDomain === companyData.companyDomain);
    if (existing) {
      alert('このドメインは既に使用されています');
      return;
    }
  }

  // Firestoreに保存
  if (useFirestore) {
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
        alert('Firestoreへの保存に失敗しました: ' + (result.error || '不明なエラー'));
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

      alert(`会社情報を保存しました。\n\n会社名: ${companyData.company}\nドメイン: ${companyData.companyDomain}`);

    } catch (error) {
      console.error('Firestore保存エラー:', error);
      alert('Firestoreへの保存中にエラーが発生しました: ' + error.message);
    }
    return;
  }

  // GAS APIに保存（フォールバック）
  const gasApiUrl = spreadsheetConfig.gasApiUrl;
  if (gasApiUrl) {
    try {
      const saveBtn = document.getElementById('company-modal-save');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
      }

      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
        action: 'saveCompany',
        company: companyData
      }))));
      const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      const result = await response.json();

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存';
      }

      if (!result.success) {
        alert('スプレッドシートへの保存に失敗しました: ' + (result.error || '不明なエラー'));
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

      alert(`会社情報をスプレッドシートに保存しました。\n\n会社名: ${companyData.company}\nドメイン: ${companyData.companyDomain}`);

    } catch (error) {
      console.error('GAS API呼び出しエラー:', error);
      alert('スプレッドシートへの保存中にエラーが発生しました。ローカルに保存します。');
      saveCompanyDataLocal(companyData);
    }
  } else {
    saveCompanyDataLocal(companyData);
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

  alert(`会社情報をローカルに保存しました。\n\n注意: スプレッドシートに自動保存するには、設定画面でGAS API URLを設定してください。\n\n会社名: ${companyData.company}\nドメイン: ${companyData.companyDomain}`);
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
      <td><span class="badge ${company.designPattern || 'standard'}">${getPatternLabel(company.designPattern || 'standard')}</span></td>
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

  // イベント委譲でボタンクリックを処理
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const domain = btn.dataset.domain;

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
    alert('会社情報が見つかりません');
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
