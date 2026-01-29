/**
 * 求人管理機能モジュール - メインエントリポイント
 */
import { initApplicantsSection } from '@features/applicants/index.js';

// 認証
import {
  checkSession,
  isAdmin,
  hasAccessToCompany,
  initFirebase
} from './auth.js';

// 状態管理
import {
  companyDomain,
  companyName,
  sheetUrl,
  setCompanyInfo,
  jobFilters,
  resetJobFilters,
  applicantsInitialized,
  setApplicantsInitialized
} from './state.js';

// 求人管理
import {
  renderJobsTable,
  loadJobsData,
  showJobModal,
  editJob,
  closeJobModal,
  saveJobData,
  deleteJob
} from './jobs.js';

// フィード生成
import {
  downloadIndeed,
  downloadGoogle,
  downloadJobbox,
  downloadCsvFeed
} from './feeds.js';

// アクセス解析
import { loadAnalyticsData } from './analytics.js';

// レポート
import {
  generateReport,
  downloadReportCsv,
  downloadReportExcel
} from './reports.js';

// LP設定
import { loadCompanyLPSettings } from './lp-settings.js';

// アカウント設定
import { applyCompanyUserRestrictions } from './settings.js';

/**
 * セクション切り替え
 */
function switchSection(sectionId) {
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.remove('active');
  });

  document.querySelectorAll('.sidebar-nav li').forEach(li => {
    li.classList.remove('active');
  });

  const targetSection = document.getElementById(`section-${sectionId}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    if (a.dataset.section === sectionId) {
      a.closest('li').classList.add('active');
    }
  });

  const pageTitle = document.getElementById('page-title');
  const headerActions = document.querySelector('.header-actions');

  if (sectionId === 'jobs') {
    if (pageTitle) pageTitle.textContent = `${companyName} の求人一覧`;
    if (headerActions) headerActions.style.display = 'flex';
  } else if (sectionId === 'analytics') {
    if (pageTitle) pageTitle.textContent = 'アクセス解析';
    if (headerActions) headerActions.style.display = 'none';
  } else if (sectionId === 'reports') {
    if (pageTitle) pageTitle.textContent = '応募レポート';
    if (headerActions) headerActions.style.display = 'none';
  } else if (sectionId === 'applicants') {
    if (pageTitle) pageTitle.textContent = '応募者管理';
    if (headerActions) headerActions.style.display = 'none';
    if (!applicantsInitialized) {
      setApplicantsInitialized(true);
      initApplicantsSection(companyDomain, companyName);
    }
  } else if (sectionId === 'lp-settings') {
    if (pageTitle) pageTitle.textContent = 'LP設定';
    if (headerActions) headerActions.style.display = 'none';
    loadCompanyLPSettings();
  } else if (sectionId === 'settings') {
    if (pageTitle) pageTitle.textContent = 'アカウント設定';
    if (headerActions) headerActions.style.display = 'none';
  }
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
  document.getElementById('btn-add-job')?.addEventListener('click', showJobModal);
  document.getElementById('btn-refresh')?.addEventListener('click', loadJobsData);
  document.getElementById('job-modal-close')?.addEventListener('click', closeJobModal);
  document.getElementById('job-modal-cancel')?.addEventListener('click', closeJobModal);
  document.getElementById('job-modal-delete')?.addEventListener('click', deleteJob);

  document.getElementById('job-edit-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveJobData();
  });

  document.getElementById('job-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeJobModal();
    }
  });

  // フィードダウンロードボタン
  document.getElementById('btn-download-indeed')?.addEventListener('click', downloadIndeed);
  document.getElementById('btn-download-google')?.addEventListener('click', downloadGoogle);
  document.getElementById('btn-download-jobbox')?.addEventListener('click', downloadJobbox);
  document.getElementById('btn-download-csv')?.addEventListener('click', downloadCsvFeed);

  // 検索・絞り込みフィルター
  const searchInput = document.getElementById('job-search');
  const statusFilter = document.getElementById('job-filter-status');
  const areaFilter = document.getElementById('job-filter-area');
  const clearFiltersBtn = document.getElementById('btn-clear-filters');

  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        jobFilters.search = searchInput.value.trim();
        renderJobsTable();
      }, 300);
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      jobFilters.status = statusFilter.value;
      renderJobsTable();
    });
  }

  if (areaFilter) {
    areaFilter.addEventListener('change', () => {
      jobFilters.area = areaFilter.value;
      renderJobsTable();
    });
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      resetJobFilters();
      if (searchInput) searchInput.value = '';
      if (statusFilter) statusFilter.value = '';
      if (areaFilter) areaFilter.value = '';
      renderJobsTable();
    });
  }

  // サイドバーナビゲーション
  document.querySelectorAll('.sidebar-nav a[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
      const section = link.dataset.section;
      if (section && section !== 'back') {
        e.preventDefault();
        switchSection(section);
      }
    });
  });

  // レポート機能
  document.getElementById('report-period')?.addEventListener('change', (e) => {
    const customDates = document.getElementById('report-custom-dates');
    if (customDates) {
      customDates.style.display = e.target.value === 'custom' ? 'flex' : 'none';
    }
  });

  document.getElementById('btn-generate-report')?.addEventListener('click', generateReport);
  document.getElementById('btn-report-csv')?.addEventListener('click', downloadReportCsv);
  document.getElementById('btn-report-excel')?.addEventListener('click', downloadReportExcel);

  // アクセス解析機能
  document.getElementById('btn-load-analytics')?.addEventListener('click', loadAnalyticsData);
}

/**
 * 初期化
 */
export async function initJobManager() {
  initFirebase();

  if (!checkSession()) {
    window.location.href = 'admin.html';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const domain = params.get('domain');
  const name = params.get('company') || domain;
  const url = params.get('sheetUrl');

  setCompanyInfo(domain, name, url);

  const initialSection = params.get('section');
  if (initialSection && ['analytics', 'reports', 'applicants'].includes(initialSection)) {
    switchSection(initialSection);
  }

  if (!companyDomain) {
    alert('会社ドメインが指定されていません');
    window.location.href = 'admin.html';
    return;
  }

  if (!hasAccessToCompany(companyDomain)) {
    alert('この会社へのアクセス権限がありません');
    window.location.href = 'admin.html';
    return;
  }

  if (!isAdmin()) {
    applyCompanyUserRestrictions();
  }

  const pageTitle = document.getElementById('page-title');
  if (pageTitle && !initialSection) pageTitle.textContent = `${companyName} の求人一覧`;

  const companyNameEl = document.getElementById('company-name');
  if (companyNameEl) companyNameEl.textContent = companyName;

  const sheetBtn = document.getElementById('btn-open-sheet');
  if (sheetUrl && sheetBtn) {
    sheetBtn.href = sheetUrl;
    sheetBtn.style.display = '';
  } else if (sheetBtn) {
    sheetBtn.style.display = 'none';
  }

  setupEventListeners();
  await loadJobsData();
}

// グローバルにエクスポート（後方互換）
if (typeof window !== 'undefined') {
  window.JobManager = {
    init: initJobManager,
    loadJobsData,
    showJobModal,
    editJob,
    closeJobModal,
    saveJobData,
    deleteJob
  };
}

export default {
  initJobManager
};
