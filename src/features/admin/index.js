/**
 * Admin Dashboard - メインエントリーポイント
 */

import { config } from './config.js';
import { initFirebase, checkSession, handleLogin, handleGoogleLogin, handleLogout, getIdToken } from './auth.js';
import { loadDashboardData, filterCompanies, sortCompanies, initAnalyticsTabs, initCompanyDetailSection } from './analytics.js';
import { loadCompanyManageData, editCompany, showCompanyModal, closeCompanyModal, saveCompanyData, renderCompanyTable, openJobsArea } from './company-manager.js';
import { loadCompanyListForLP, loadLPSettings, saveLPSettings, renderHeroImagePresets, toggleLPPreview, closeLPPreview, debouncedUpdatePreview, initSectionSortable, updateLPPreview, initPointsSection } from './lp-settings.js';
import { downloadIndeedXml, downloadGoogleJsonLd, downloadJobBoxXml, downloadCsv } from './job-feed-generator.js';
import * as JobsLoader from '@shared/jobs-loader.js';
import { escapeHtml } from '@shared/utils.js';

// ログイン画面表示
function showLogin() {
  const loginScreen = document.getElementById('login-screen');
  const dashboard = document.getElementById('admin-dashboard');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (dashboard) dashboard.style.display = 'none';
}

// ダッシュボード表示
function showDashboard() {
  const loginScreen = document.getElementById('login-screen');
  const dashboard = document.getElementById('admin-dashboard');
  if (loginScreen) loginScreen.style.display = 'none';
  if (dashboard) dashboard.style.display = 'flex';
}

// モバイルメニュー開閉
function openMobileMenu() {
  const sidebar = document.getElementById('admin-sidebar');
  const overlay = document.getElementById('mobile-overlay');
  const menuBtn = document.getElementById('mobile-menu-btn');

  if (sidebar) sidebar.classList.add('open');
  if (overlay) overlay.classList.add('active');
  if (menuBtn) menuBtn.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  const sidebar = document.getElementById('admin-sidebar');
  const overlay = document.getElementById('mobile-overlay');
  const menuBtn = document.getElementById('mobile-menu-btn');

  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
  if (menuBtn) menuBtn.classList.remove('active');
  document.body.style.overflow = '';
}

// セクション切り替え
function switchSection(sectionName) {
  // モバイルメニューを閉じる
  closeMobileMenu();

  // ナビゲーションのactive状態を更新
  document.querySelectorAll('.sidebar-nav li').forEach(li => {
    li.classList.remove('active');
  });
  const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
  if (activeLink) {
    activeLink.parentElement.classList.add('active');
  }

  // セクションの表示切り替え
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.remove('active');
  });
  const targetSection = document.getElementById(`section-${sectionName}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // タイトル更新
  const titles = {
    overview: '概要',
    companies: '企業別データ',
    'company-manage': '会社管理',
    'lp-settings': 'LP設定',
    applications: '応募データ',
    'applicant-select': '応募者管理',
    settings: '設定'
  };
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    pageTitle.textContent = titles[sectionName] || sectionName;
  }

  // 会社管理セクションに切り替えた場合はデータを読み込む
  if (sectionName === 'company-manage') {
    loadCompanyManageData();
  }

  // LP設定セクションに切り替えた場合は会社リストを読み込む
  if (sectionName === 'lp-settings') {
    loadCompanyListForLP();
    renderHeroImagePresets();
  }

  // 応募者管理セクションに切り替えた場合は会社一覧を表示
  if (sectionName === 'applicant-select') {
    renderApplicantCompanyGrid();
  }
}

// イベントバインド
function bindEvents() {
  // モバイルメニュー
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('admin-sidebar');
      if (sidebar && sidebar.classList.contains('open')) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });
  }

  // サイドバー閉じるボタン
  const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', closeMobileMenu);
  }

  // オーバーレイクリックでメニューを閉じる
  const mobileOverlay = document.getElementById('mobile-overlay');
  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMobileMenu);
  }

  // ログインフォーム
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('username')?.value || '';
      const password = document.getElementById('password')?.value || '';
      const errorEl = document.getElementById('login-error');

      const result = handleLogin(username, password);
      if (result.success) {
        if (errorEl) errorEl.style.display = 'none';
        showDashboard();
        loadDashboardData();
      } else {
        if (errorEl) {
          errorEl.textContent = result.error;
          errorEl.style.display = 'block';
        }
      }
    });
  }

  // ログアウト
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      handleLogout();
      showLogin();
    });
  }

  // サイドバーナビゲーション
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = e.currentTarget.dataset.section;
      switchSection(section);
    });
  });

  // 日付範囲変更
  const dateRange = document.getElementById('date-range');
  if (dateRange) {
    dateRange.addEventListener('change', () => loadDashboardData());
  }

  // 更新ボタン
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadDashboardData());
  }

  // 企業検索
  const companySearch = document.getElementById('company-search');
  if (companySearch) {
    companySearch.addEventListener('input', (e) => filterCompanies(e.target.value));
  }

  // ソート変更
  const sortBy = document.getElementById('sort-by');
  if (sortBy) {
    sortBy.addEventListener('change', () => sortCompanies());
  }

  // Googleログイン
  const googleLoginBtn = document.getElementById('google-login-btn');
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
      const errorEl = document.getElementById('login-error');
      const result = await handleGoogleLogin();
      if (result.success) {
        if (errorEl) errorEl.style.display = 'none';
        showDashboard();
        loadDashboardData();
      } else {
        if (errorEl) {
          errorEl.textContent = result.error;
          errorEl.style.display = 'block';
        }
      }
    });
  }

  // 会社管理: 新規登録ボタン
  const btnAddCompany = document.getElementById('btn-add-company');
  if (btnAddCompany) {
    btnAddCompany.addEventListener('click', () => showCompanyModal());
  }

  // LP設定: 会社選択
  const lpCompanySelect = document.getElementById('lp-company-select');
  if (lpCompanySelect) {
    lpCompanySelect.addEventListener('change', (e) => loadLPSettings(e.target.value));
  }

  // LP設定: 保存ボタン
  const btnSaveLPSettings = document.getElementById('btn-save-lp-settings');
  if (btnSaveLPSettings) {
    btnSaveLPSettings.addEventListener('click', () => saveLPSettings());
  }

  // LP設定: リセットボタン
  const btnResetLPSettings = document.getElementById('btn-reset-lp-settings');
  if (btnResetLPSettings) {
    btnResetLPSettings.addEventListener('click', () => {
      const companyDomain = document.getElementById('lp-company-select')?.value;
      if (companyDomain) loadLPSettings(companyDomain);
    });
  }

  // LP設定: プレビューボタン
  const btnTogglePreview = document.getElementById('btn-toggle-preview');
  if (btnTogglePreview) {
    btnTogglePreview.addEventListener('click', () => toggleLPPreview());
  }

  // LP設定: プレビューを閉じる
  const btnClosePreview = document.getElementById('btn-close-preview');
  if (btnClosePreview) {
    btnClosePreview.addEventListener('click', () => closeLPPreview());
  }

  // LP設定: デバイス切り替え
  document.querySelectorAll('.preview-device-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const device = e.target.dataset.device;
      const wrapper = document.querySelector('.lp-preview-frame-wrapper');
      document.querySelectorAll('.preview-device-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.device === device);
      });
      if (wrapper) wrapper.setAttribute('data-device', device);
    });
  });

  // LP設定: フォーム入力時にプレビュー更新
  const lpFormInputs = document.querySelectorAll('#lp-editor input, #lp-editor textarea');
  lpFormInputs.forEach(input => {
    input.addEventListener('input', () => debouncedUpdatePreview());
  });

  // LP設定: デザインパターン変更時にプレビュー更新
  document.querySelectorAll('input[name="design-pattern"]').forEach(radio => {
    radio.addEventListener('change', () => updateLPPreview());
  });

  // LP設定: セクション並び替え
  initSectionSortable();

  // LP設定: ポイント追加/削除
  initPointsSection();

  // LP設定: セクション表示/非表示切り替え
  document.querySelectorAll('#lp-section-order input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => updateLPPreview());
  });

  // 設定: パスワード変更
  const savePasswordBtn = document.getElementById('save-password');
  if (savePasswordBtn) {
    savePasswordBtn.addEventListener('click', () => {
      const newPassword = document.getElementById('new-password')?.value;
      if (newPassword && newPassword.length >= 4) {
        localStorage.setItem('admin_password', newPassword);
        alert('パスワードを変更しました');
      } else {
        alert('パスワードは4文字以上で入力してください');
      }
    });
  }

  // 求人フィードダウンロード
  const feedStatus = document.getElementById('feed-status');
  const showFeedLoading = () => {
    if (feedStatus) feedStatus.style.display = 'flex';
  };
  const hideFeedLoading = () => {
    if (feedStatus) feedStatus.style.display = 'none';
  };

  const btnDownloadIndeed = document.getElementById('btn-download-indeed');
  if (btnDownloadIndeed) {
    btnDownloadIndeed.addEventListener('click', async () => {
      try {
        showFeedLoading();
        await downloadIndeedXml();
        alert('Indeed XMLフィードをダウンロードしました');
      } catch (error) {
        alert('フィード生成に失敗しました: ' + error.message);
      } finally {
        hideFeedLoading();
      }
    });
  }

  const btnDownloadGoogle = document.getElementById('btn-download-google');
  if (btnDownloadGoogle) {
    btnDownloadGoogle.addEventListener('click', async () => {
      try {
        showFeedLoading();
        await downloadGoogleJsonLd();
        alert('Google JSON-LDをダウンロードしました');
      } catch (error) {
        alert('フィード生成に失敗しました: ' + error.message);
      } finally {
        hideFeedLoading();
      }
    });
  }

  const btnDownloadJobbox = document.getElementById('btn-download-jobbox');
  if (btnDownloadJobbox) {
    btnDownloadJobbox.addEventListener('click', async () => {
      try {
        showFeedLoading();
        await downloadJobBoxXml();
        alert('求人ボックスXMLをダウンロードしました');
      } catch (error) {
        alert('フィード生成に失敗しました: ' + error.message);
      } finally {
        hideFeedLoading();
      }
    });
  }

  const btnDownloadCsv = document.getElementById('btn-download-csv');
  if (btnDownloadCsv) {
    btnDownloadCsv.addEventListener('click', async () => {
      try {
        showFeedLoading();
        await downloadCsv();
        alert('CSVをダウンロードしました');
      } catch (error) {
        alert('フィード生成に失敗しました: ' + error.message);
      } finally {
        hideFeedLoading();
      }
    });
  }

}

// 応募者管理用の会社グリッドを表示
async function renderApplicantCompanyGrid() {
  const grid = document.getElementById('applicant-company-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading-cell">会社一覧を読み込み中...</div>';

  try {
    const companies = await JobsLoader.fetchCompanies();
    if (!companies || companies.length === 0) {
      grid.innerHTML = '<div class="loading-cell">会社データがありません</div>';
      return;
    }

    const visibleCompanies = companies.filter(c => JobsLoader.isCompanyVisible(c));

    if (visibleCompanies.length === 0) {
      grid.innerHTML = '<div class="loading-cell">表示可能な会社がありません</div>';
      return;
    }

    grid.innerHTML = visibleCompanies.map(company => `
      <a href="applicants.html?domain=${encodeURIComponent(company.companyDomain)}" class="company-select-card">
        <div class="company-select-icon">🏢</div>
        <div class="company-select-info">
          <h4>${escapeHtml(company.company)}</h4>
          <p>${escapeHtml(company.companyDomain)}</p>
        </div>
        <div class="company-select-arrow">→</div>
      </a>
    `).join('');

  } catch (error) {
    console.error('会社一覧取得エラー:', error);
    grid.innerHTML = '<div class="loading-cell">会社一覧の取得に失敗しました</div>';
  }
}

// 初期化
export function initAdminDashboard() {
  // ローカルストレージからパスワードを復元
  const savedPassword = localStorage.getItem('admin_password');
  if (savedPassword) {
    config.credentials.password = savedPassword;
  }

  // Firebase初期化
  initFirebase();

  // セッション確認
  if (checkSession()) {
    showDashboard();
    // Firebase認証が完了したらデータを読み込む
    document.addEventListener('authReady', () => {
      loadDashboardData();
    }, { once: true });
    // フォールバック: 認証に時間がかかる場合は3秒後に読み込み
    setTimeout(() => {
      if (!getIdToken()) {
        console.log('[Admin] Auth timeout, loading with mock data');
        loadDashboardData();
      }
    }, 3000);
  } else {
    showLogin();
  }

  // イベントバインド
  bindEvents();

  // 分析タブの初期化
  initAnalyticsTabs();

  // 企業詳細セクションの初期化
  initCompanyDetailSection();
}

// グローバルにエクスポート（後方互換）
if (typeof window !== 'undefined') {
  window.AdminDashboard = {
    config,
    spreadsheetConfig: {
      sheetId: '1NVIDV3OiXbNrVI7EFdRrU2Ggn8dx7Q0rSnvJ6uaWvX0',
      companySheetName: '会社一覧',
      lpSettingsSheetName: 'LP設定',
      gasApiUrl: 'https://script.google.com/macros/s/AKfycbxj6CqSfY7jq04uDXURhewD_BAKx3csLKBpl1hdRBdNg-R-E6IuoaZGje22Gr9WYWY2/exec'
    },
    init: initAdminDashboard,
    switchSection,
    getIdToken
  };

  window.AdminAnalytics = {
    loadDashboardData,
    filterCompanies,
    sortCompanies
  };

  window.AdminCompany = {
    loadCompanyManageData,
    editCompany,
    showCompanyModal,
    closeCompanyModal,
    saveCompanyData,
    renderCompanyTable,
    openJobsArea,
    loadCompanyListForLP,
    loadLPSettings,
    saveLPSettings,
    renderHeroImagePresets,
    toggleLPPreview,
    closeLPPreview,
    debouncedUpdatePreview,
    initSectionSortable,
    updateLPPreview,
    getPatternLabel: (pattern) => {
      const labels = { standard: 'スタンダード', modern: 'モダン', classic: 'クラシック', minimal: 'ミニマル', colorful: 'カラフル' };
      return labels[pattern] || 'スタンダード';
    }
  };
}

export default {
  initAdminDashboard,
  switchSection
};
