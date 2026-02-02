/**
 * Admin Dashboard - メインエントリーポイント
 */

import { config, USER_ROLES } from './config.js';
import {
  initFirebase, checkSession, handleLogin, handleGoogleLogin, handleLogout, getIdToken,
  getUserRole, getUserCompanyDomain, isAdmin, handleCompanyLogin,
  getAllCompanyUsersWithInfo, addCompanyUser, updateCompanyUser, deleteCompanyUser,
  resetCompanyUserPassword, generatePassword, generateUsername, hasCompanyUser
} from './auth.js';
import { loadDashboardData, filterCompanies, sortCompanies, initAnalyticsTabs, initCompanyDetailSection } from './analytics.js';
import { loadCompanyManageData, editCompany, showCompanyModal, closeCompanyModal, saveCompanyData, renderCompanyTable, openJobsArea } from './company-manager.js';
import { loadCompanyListForLP, loadLPSettings, saveLPSettings, renderHeroImagePresets, toggleLPPreview, closeLPPreview, debouncedUpdatePreview, initSectionSortable, updateLPPreview, initPointsSection, initFAQSection, initVideoButtonSection } from './lp-settings.js';
import { initRecruitSettings, setPendingCompany } from './recruit-settings.js';
import { initJobListings, setCompanyFilter } from './job-listings.js';
import { downloadIndeedXml, downloadGoogleJsonLd, downloadJobBoxXml, downloadCsv } from './job-feed-generator.js';
import * as JobsLoader from '@shared/jobs-loader.js';
import { escapeHtml } from '@shared/utils.js';

// Job-Manage Embedded
import {
  currentCompany,
  setCurrentCompany,
  clearCurrentCompany,
  pushHistory,
  popHistory,
  setEditingCompanyDomain,
  getEditingCompanyDomain,
  clearEditingCompanyDomain,
  setPendingJobId,
  getPendingJobId,
  clearPendingJobId,
  setPendingInitialTab,
  getPendingInitialTab,
  clearPendingInitialTab,
  isSectionSwitching,
  startSectionSwitch,
  endSectionSwitch
} from './admin-state.js';
import { initJobManageEmbedded } from './job-manage-embedded.js';
import { initCompanyEditEmbedded } from './company-edit-embedded.js';

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

  // 権限に応じてUIを制御
  applyRoleBasedUI();
}

/**
 * 権限に応じてUIを制御
 * - admin: 全機能表示
 * - company: 自社のみ表示、一部機能非表示
 */
function applyRoleBasedUI() {
  const role = getUserRole();
  const companyDomain = getUserCompanyDomain();

  // 管理者とそれ以外でナビゲーションを切り替え
  const navAdmin = document.getElementById('nav-admin');
  const navCompany = document.getElementById('nav-company');

  if (!isAdmin()) {
    // 会社ユーザー用ナビゲーションを表示
    if (navAdmin) navAdmin.style.display = 'none';
    if (navCompany) navCompany.style.display = 'block';

    // 会社ユーザーはデフォルトで求人一覧を表示
    switchSection('job-listings');

    // サイドバーのヘッダーに会社名を表示
    const sidebarHeader = document.querySelector('.sidebar-header p');
    if (sidebarHeader && companyDomain) {
      sidebarHeader.textContent = `${companyDomain} 管理画面`;
    }
  } else {
    // 管理者用ナビゲーションを表示
    if (navAdmin) navAdmin.style.display = 'block';
    if (navCompany) navCompany.style.display = 'none';
  }
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
  // 連打防止: 切り替え中なら無視
  if (isSectionSwitching()) {
    return;
  }

  // 切り替え開始
  startSectionSwitch();

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
    'analytics-detail': '詳細分析',
    'company-manage': '会社管理',
    'job-listings': '求人一覧',
    'job-manage': '求人管理',
    'company-edit': '会社編集',
    'lp-settings': 'LP設定',
    'recruit-settings': '採用ページ設定',
    'applicant-select': '応募者管理',
    'company-users': '会社ユーザー管理',
    settings: '設定'
  };
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    if (sectionName === 'job-manage' && currentCompany.name) {
      pageTitle.textContent = `${currentCompany.name} の求人管理`;
    } else {
      pageTitle.textContent = titles[sectionName] || sectionName;
    }
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

  // 採用ページ設定セクションに切り替えた場合は初期化
  if (sectionName === 'recruit-settings') {
    initRecruitSettings();
  }

  // 求人一覧セクションに切り替えた場合は初期化
  if (sectionName === 'job-listings') {
    initJobListings();
  }

  // 期間選択と更新ボタンはアナリティクスセクションのみ表示
  const headerActions = document.querySelector('.header-actions');
  if (headerActions) {
    const analyticsSection = ['overview', 'analytics-detail'];
    headerActions.style.display = analyticsSection.includes(sectionName) ? '' : 'none';
  }

  // LP設定セクションではフッター固定用のクラスを追加
  document.body.classList.toggle('lp-settings-active', sectionName === 'lp-settings');

  // 応募者管理セクションに切り替えた場合は会社一覧を表示
  if (sectionName === 'applicant-select') {
    renderApplicantCompanyGrid();
  }

  // 会社ユーザー管理セクションに切り替えた場合はデータを読み込む
  if (sectionName === 'company-users') {
    loadCompanyUsersData();
  }

  // Job-Manage埋め込みセクションに切り替えた場合は初期化
  if (sectionName === 'job-manage') {
    if (currentCompany.domain && currentCompany.name) {
      const jobId = getPendingJobId();
      clearPendingJobId();
      initJobManageEmbedded(currentCompany.domain, currentCompany.name, jobId);
    }
  }

  // Company-Edit埋め込みセクションに切り替えた場合は初期化
  if (sectionName === 'company-edit') {
    initCompanyEditEmbedded(getEditingCompanyDomain());
  }

  // 切り替え完了（次フレームで解除）
  requestAnimationFrame(() => {
    endSectionSwitch();
  });
}

/**
 * Job-Manage画面へナビゲート（SPA内）
 * @param {string} domain - 会社ドメイン
 * @param {string} name - 会社名
 * @param {string} returnSection - 戻り先セクション
 * @param {string} [jobId] - 編集する求人ID（オプション）
 * @param {string} [initialTab] - 初期表示タブ（jobs, analytics, reports, applicants, recruit）
 */
function navigateToJobManage(domain, name, returnSection = 'job-listings', jobId = null, initialTab = null) {
  setCurrentCompany(domain, name);
  if (jobId) {
    setPendingJobId(jobId);
  }
  if (initialTab) {
    setPendingInitialTab(initialTab);
  }
  pushHistory(returnSection);
  switchSection('job-manage');
}

/**
 * 前のセクションに戻る
 */
function navigateBack() {
  const prev = popHistory();
  clearCurrentCompany();
  clearEditingCompanyDomain();
  switchSection(prev || 'job-listings');
}

/**
 * Company-Edit画面へナビゲート（SPA内）
 * @param {string} domain - 会社ドメイン（null で新規作成）
 * @param {string} returnSection - 戻り先セクション
 */
function navigateToCompanyEdit(domain, returnSection = 'company-manage') {
  setEditingCompanyDomain(domain);
  pushHistory(returnSection);
  switchSection('company-edit');
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

  // ログインタブ切り替え
  document.querySelectorAll('.login-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabType = tab.dataset.tab;

      // タブのアクティブ状態を切り替え
      document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // フォームの表示切り替え
      const companyForm = document.getElementById('company-login-form');
      const adminForm = document.getElementById('login-form');

      if (tabType === 'company') {
        if (companyForm) companyForm.style.display = 'block';
        if (adminForm) adminForm.style.display = 'none';
      } else {
        if (companyForm) companyForm.style.display = 'none';
        if (adminForm) adminForm.style.display = 'block';
      }
    });
  });

  // 会社ユーザーログインフォーム
  const companyLoginForm = document.getElementById('company-login-form');
  if (companyLoginForm) {
    companyLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('company-username')?.value || '';
      const password = document.getElementById('company-password')?.value || '';
      const errorEl = document.getElementById('company-login-error');

      if (errorEl) errorEl.style.display = 'none';

      const result = await handleCompanyLogin(username, password);
      if (result.success) {
        // 会社ユーザーは自社の管理画面に直接遷移（SPA内）
        showDashboard();
        navigateToJobManage(result.companyDomain, result.companyName || result.companyDomain, 'overview', null, 'jobs');
      } else {
        if (errorEl) {
          errorEl.textContent = result.error;
          errorEl.style.display = 'block';
        }
      }
    });
  }

  // 管理者ログインフォーム
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

  // LP設定: 求人選択
  const lpJobSelect = document.getElementById('lp-job-select');
  if (lpJobSelect) {
    lpJobSelect.addEventListener('change', (e) => loadLPSettings(e.target.value));
  }

  // LP設定: 保存ボタン
  const btnSaveLPSettings = document.getElementById('btn-save-lp-settings');
  if (btnSaveLPSettings) {
    btnSaveLPSettings.addEventListener('click', () => {
      saveLPSettings();
    });
  }

  // LP設定: リセットボタン
  const btnResetLPSettings = document.getElementById('btn-reset-lp-settings');
  if (btnResetLPSettings) {
    btnResetLPSettings.addEventListener('click', () => {
      const jobId = document.getElementById('lp-job-select')?.value;
      if (jobId) loadLPSettings(jobId);
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

  // LP設定: FAQ追加/削除
  initFAQSection();

  // LP設定: 動画ボタン設定
  initVideoButtonSection();

  // LP設定: セクション表示/非表示切り替え
  document.querySelectorAll('#lp-section-order input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => updateLPPreview());
  });

  // LP設定: 折りたたみパネルの初期化
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const parent = header.closest('.collapsible');
      if (parent) {
        parent.classList.toggle('collapsed');
      }
    });
  });

  // 初期状態で折りたたみパネルを閉じておく（8, 9のみ）
  document.querySelectorAll('#ad-tracking-section, #ogp-section').forEach(section => {
    section.classList.add('collapsed');
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

  // ========================================
  // 会社ユーザー管理イベント
  // ========================================

  // 新規ユーザー追加ボタン
  const btnAddCompanyUser = document.getElementById('btn-add-company-user');
  if (btnAddCompanyUser) {
    btnAddCompanyUser.addEventListener('click', () => {
      showCompanyUserModal(null, '', '');
    });
  }

  // 一括発行ボタン
  const btnBulkGenerate = document.getElementById('btn-bulk-generate');
  if (btnBulkGenerate) {
    btnBulkGenerate.addEventListener('click', () => bulkGenerateUsers());
  }

  // モーダル閉じるボタン
  const cuModalClose = document.getElementById('company-user-modal-close');
  if (cuModalClose) {
    cuModalClose.addEventListener('click', closeCompanyUserModal);
  }

  const cuModalCancel = document.getElementById('company-user-modal-cancel');
  if (cuModalCancel) {
    cuModalCancel.addEventListener('click', closeCompanyUserModal);
  }

  // モーダル保存ボタン
  const cuForm = document.getElementById('company-user-form');
  if (cuForm) {
    cuForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCompanyUser();
    });
  }

  // ユーザー削除ボタン
  const cuDelete = document.getElementById('company-user-delete');
  if (cuDelete) {
    cuDelete.addEventListener('click', deleteCompanyUserHandler);
  }

  // パスワード自動生成ボタン
  const cuGeneratePassword = document.getElementById('cu-generate-password');
  if (cuGeneratePassword) {
    cuGeneratePassword.addEventListener('click', () => {
      const passwordInput = document.getElementById('cu-password');
      if (passwordInput) {
        passwordInput.value = generatePassword();
      }
    });
  }

  // クリップボードコピーボタン
  const cuCopyCredentials = document.getElementById('cu-copy-credentials');
  if (cuCopyCredentials) {
    cuCopyCredentials.addEventListener('click', copyCredentialsToClipboard);
  }

  // モーダル外クリックで閉じる
  const cuModal = document.getElementById('company-user-modal');
  if (cuModal) {
    cuModal.addEventListener('click', (e) => {
      if (e.target === cuModal) {
        closeCompanyUserModal();
      }
    });
  }

  // カスタムイベント: セクション遷移（フィルター付き）
  document.addEventListener('navigateToSection', (e) => {
    const { section, companyDomain, company } = e.detail;

    if (section === 'job-listings') {
      // 求人一覧に遷移してフィルター適用
      // setCompanyFilterで事前にフィルター値を設定してから遷移
      if (companyDomain) {
        setCompanyFilter(companyDomain);
      }
      switchSection('job-listings');
    } else if (section === 'recruit-settings') {
      // 採用ページ設定に遷移して会社選択済み
      // 遷移前に保留フィルターを設定
      if (companyDomain) {
        setPendingCompany(companyDomain);
      }
      switchSection('recruit-settings');
    }
  });

  // Job-Manage埋め込み: 戻るボタン
  const jmBackBtn = document.getElementById('jm-back-btn');
  if (jmBackBtn) {
    jmBackBtn.addEventListener('click', navigateBack);
  }

}

// 応募者管理用の会社グリッドを表示
async function renderApplicantCompanyGrid() {
  const grid = document.getElementById('applicant-company-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading-cell">会社一覧を読み込み中...</div>';

  // 会社ユーザーの場合は直接自社の応募者管理画面に遷移（SPA内）
  if (!isAdmin()) {
    const companyDomain = getUserCompanyDomain();
    if (companyDomain) {
      // SPA内で遷移
      navigateToJobManage(companyDomain, companyDomain, 'applicant-select', null, 'applicants');
      return;
    }
  }

  try {
    const companies = await JobsLoader.fetchCompanies();
    if (!companies || companies.length === 0) {
      grid.innerHTML = '<div class="loading-cell">会社データがありません</div>';
      return;
    }

    let displayCompanies = companies.filter(c => JobsLoader.isCompanyVisible(c));

    // 管理者以外は自社のみ表示
    if (!isAdmin()) {
      const userCompanyDomain = getUserCompanyDomain();
      displayCompanies = displayCompanies.filter(c => c.companyDomain === userCompanyDomain);
    }

    if (displayCompanies.length === 0) {
      grid.innerHTML = '<div class="loading-cell">表示可能な会社がありません</div>';
      return;
    }

    grid.innerHTML = displayCompanies.map(company => `
      <div class="company-select-card" data-domain="${escapeHtml(company.companyDomain)}" data-name="${escapeHtml(company.company)}">
        <div class="company-select-icon">🏢</div>
        <div class="company-select-info">
          <h4>${escapeHtml(company.company)}</h4>
          <p>${escapeHtml(company.companyDomain)}</p>
        </div>
        <div class="company-select-arrow">→</div>
      </div>
    `).join('');

    // 会社カードのクリックイベント設定
    grid.querySelectorAll('.company-select-card').forEach(card => {
      card.addEventListener('click', () => {
        const domain = card.dataset.domain;
        const name = card.dataset.name;
        navigateToJobManage(domain, name, 'applicant-select', null, 'applicants');
      });
    });

  } catch (error) {
    console.error('会社一覧取得エラー:', error);
    grid.innerHTML = '<div class="loading-cell">会社一覧の取得に失敗しました</div>';
  }
}

// ========================================
// 会社ユーザー管理機能
// ========================================

// 会社一覧キャッシュ
let companiesCache = [];
let companyUsersCache = [];
let currentEditingUserId = null;

// 会社ユーザー一覧を読み込み
async function loadCompanyUsersData() {
  const tbody = document.getElementById('company-users-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データを読み込み中...</td></tr>';

  try {
    // 会社一覧を取得
    companiesCache = await JobsLoader.fetchCompanies();

    // 会社ユーザー一覧を取得
    companyUsersCache = await getAllCompanyUsersWithInfo();

    // 会社ごとにユーザー情報をマッピング
    const companyUserMap = {};
    companyUsersCache.forEach(user => {
      if (!companyUserMap[user.companyDomain]) {
        companyUserMap[user.companyDomain] = [];
      }
      companyUserMap[user.companyDomain].push(user);
    });

    // 表示する会社一覧を作成
    const visibleCompanies = companiesCache.filter(c => JobsLoader.isCompanyVisible(c));

    if (visibleCompanies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">会社データがありません</td></tr>';
      return;
    }

    // テーブル生成
    let html = '';
    visibleCompanies.forEach(company => {
      const users = companyUserMap[company.companyDomain] || [];

      if (users.length === 0) {
        // ユーザー未発行
        html += `
          <tr data-company-domain="${escapeHtml(company.companyDomain)}">
            <td>${escapeHtml(company.company)}</td>
            <td><span class="badge warning">未発行</span></td>
            <td><span class="badge">-</span></td>
            <td>-</td>
            <td>-</td>
            <td>
              <button class="btn-small btn-primary btn-issue-user" data-domain="${escapeHtml(company.companyDomain)}" data-company="${escapeHtml(company.company)}">
                ID発行
              </button>
            </td>
          </tr>
        `;
      } else {
        // ユーザーがいる場合
        users.forEach((user, idx) => {
          const isActive = user.isActive !== false;
          const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString('ja-JP') : '-';
          const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString('ja-JP') : '未ログイン';

          html += `
            <tr data-user-id="${escapeHtml(user.id)}">
              ${idx === 0 ? `<td rowspan="${users.length}">${escapeHtml(company.company)}</td>` : ''}
              <td><code>${escapeHtml(user.username)}</code></td>
              <td>${isActive ? '<span class="badge success">有効</span>' : '<span class="badge">無効</span>'}</td>
              <td>${createdAt}</td>
              <td>${lastLogin}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn-small btn-secondary btn-reset-password" data-user-id="${escapeHtml(user.id)}" data-username="${escapeHtml(user.username)}">
                    PW再発行
                  </button>
                  <button class="btn-small btn-edit-user" data-user-id="${escapeHtml(user.id)}">編集</button>
                </div>
              </td>
            </tr>
          `;
        });
      }
    });

    tbody.innerHTML = html;

    // イベントバインド
    bindCompanyUserEvents();

  } catch (error) {
    console.error('会社ユーザー一覧取得エラー:', error);
    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データの取得に失敗しました</td></tr>';
  }
}

// 会社ユーザー関連のイベントをバインド
function bindCompanyUserEvents() {
  // ID発行ボタン
  document.querySelectorAll('.btn-issue-user').forEach(btn => {
    btn.addEventListener('click', () => {
      const domain = btn.dataset.domain;
      const company = btn.dataset.company;
      showCompanyUserModal(null, domain, company);
    });
  });

  // 編集ボタン
  document.querySelectorAll('.btn-edit-user').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.userId;
      const user = companyUsersCache.find(u => u.id === userId);
      if (user) {
        const company = companiesCache.find(c => c.companyDomain === user.companyDomain);
        showCompanyUserModal(user, user.companyDomain, company?.company || user.companyDomain);
      }
    });
  });

  // パスワード再発行ボタン
  document.querySelectorAll('.btn-reset-password').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.userId;
      const username = btn.dataset.username;
      await resetPassword(userId, username);
    });
  });
}

// 会社ユーザーモーダルを表示
function showCompanyUserModal(user, companyDomain, companyName) {
  const modal = document.getElementById('company-user-modal');
  const title = document.getElementById('company-user-modal-title');
  const companySelect = document.getElementById('cu-company-select');
  const usernameInput = document.getElementById('cu-username');
  const passwordInput = document.getElementById('cu-password');
  const isActiveCheckbox = document.getElementById('cu-is-active');
  const deleteBtn = document.getElementById('company-user-delete');
  const credentialsDisplay = document.getElementById('cu-credentials-display');

  if (!modal) return;

  // 会社選択肢を設定
  const visibleCompanies = companiesCache.filter(c => JobsLoader.isCompanyVisible(c));
  companySelect.innerHTML = visibleCompanies.map(c => `
    <option value="${escapeHtml(c.companyDomain)}" ${c.companyDomain === companyDomain ? 'selected' : ''}>
      ${escapeHtml(c.company)}
    </option>
  `).join('');

  if (user) {
    // 編集モード
    title.textContent = '会社ユーザーの編集';
    usernameInput.value = user.username || '';
    passwordInput.value = ''; // パスワードは表示しない
    passwordInput.placeholder = '変更する場合のみ入力';
    passwordInput.required = false;
    isActiveCheckbox.checked = user.isActive !== false;
    deleteBtn.style.display = '';
    currentEditingUserId = user.id;
  } else {
    // 新規作成モード
    title.textContent = '会社ユーザーの追加';
    usernameInput.value = generateUsername(companyDomain);
    passwordInput.value = generatePassword();
    passwordInput.placeholder = 'パスワード';
    passwordInput.required = true;
    isActiveCheckbox.checked = true;
    deleteBtn.style.display = 'none';
    currentEditingUserId = null;
  }

  // 発行情報表示を隠す
  credentialsDisplay.style.display = 'none';

  modal.style.display = 'flex';
}

// 会社ユーザーモーダルを閉じる
function closeCompanyUserModal() {
  const modal = document.getElementById('company-user-modal');
  if (modal) modal.style.display = 'none';
  currentEditingUserId = null;
}

// 会社ユーザーを保存
async function saveCompanyUser() {
  const companyDomain = document.getElementById('cu-company-select')?.value;
  const username = document.getElementById('cu-username')?.value?.trim();
  const password = document.getElementById('cu-password')?.value;
  const isActive = document.getElementById('cu-is-active')?.checked;

  if (!companyDomain || !username) {
    alert('必須項目を入力してください');
    return;
  }

  const saveBtn = document.getElementById('company-user-modal-save');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';
  }

  try {
    if (currentEditingUserId) {
      // 更新
      const updateData = { username, isActive };
      if (password) {
        updateData.password = password;
      }

      const result = await updateCompanyUser(currentEditingUserId, updateData);
      if (!result.success) {
        throw new Error(result.error);
      }

      alert('ユーザー情報を更新しました');
      closeCompanyUserModal();

    } else {
      // 新規作成
      if (!password) {
        alert('パスワードを入力してください');
        return;
      }

      const result = await addCompanyUser(username, password, companyDomain);
      if (!result.success) {
        throw new Error(result.error);
      }

      // 発行情報を表示
      document.getElementById('cu-issued-username').textContent = username;
      document.getElementById('cu-issued-password').textContent = password;
      document.getElementById('cu-credentials-display').style.display = 'block';

      // 保存ボタンを完了に変更
      if (saveBtn) {
        saveBtn.textContent = '完了';
        saveBtn.onclick = () => {
          closeCompanyUserModal();
          loadCompanyUsersData();
        };
      }

      alert('ユーザーを作成しました。ログイン情報を控えてください。');
    }

    await loadCompanyUsersData();

  } catch (error) {
    console.error('ユーザー保存エラー:', error);
    alert('保存に失敗しました: ' + error.message);
  } finally {
    if (saveBtn && !currentEditingUserId) {
      // 新規作成時は保存ボタンを「完了」のままにする
    } else if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存';
    }
  }
}

// 会社ユーザーを削除
async function deleteCompanyUserHandler() {
  if (!currentEditingUserId) return;

  if (!confirm('このユーザーを削除してもよろしいですか？')) {
    return;
  }

  try {
    const result = await deleteCompanyUser(currentEditingUserId);
    if (!result.success) {
      throw new Error(result.error);
    }

    alert('ユーザーを削除しました');
    closeCompanyUserModal();
    await loadCompanyUsersData();

  } catch (error) {
    console.error('ユーザー削除エラー:', error);
    alert('削除に失敗しました: ' + error.message);
  }
}

// パスワードを再発行
async function resetPassword(userId, username) {
  if (!confirm(`${username} のパスワードを再発行しますか？`)) {
    return;
  }

  const newPassword = generatePassword();

  try {
    const result = await resetCompanyUserPassword(userId, newPassword);
    if (!result.success) {
      throw new Error(result.error);
    }

    // パスワードを表示
    const message = `新しいパスワードを発行しました。\n\nユーザーID: ${username}\nパスワード: ${newPassword}\n\n※このパスワードは再表示できません。必ず控えてください。`;

    // クリップボードにコピー
    try {
      await navigator.clipboard.writeText(`ユーザーID: ${username}\nパスワード: ${newPassword}`);
      alert(message + '\n\n（クリップボードにコピーしました）');
    } catch {
      alert(message);
    }

  } catch (error) {
    console.error('パスワード再発行エラー:', error);
    alert('パスワードの再発行に失敗しました: ' + error.message);
  }
}

// 未発行の会社に一括発行
async function bulkGenerateUsers() {
  if (!confirm('未発行の全会社にユーザーIDを発行しますか？')) {
    return;
  }

  const visibleCompanies = companiesCache.filter(c => JobsLoader.isCompanyVisible(c));
  const results = [];

  for (const company of visibleCompanies) {
    // 既にユーザーがいるか確認
    const hasUser = await hasCompanyUser(company.companyDomain);
    if (hasUser) continue;

    // ユーザーを作成
    const username = generateUsername(company.companyDomain);
    const password = generatePassword();

    const result = await addCompanyUser(username, password, company.companyDomain, company.company);
    if (result.success) {
      results.push({
        company: company.company,
        domain: company.companyDomain,
        username,
        password
      });
    }
  }

  if (results.length === 0) {
    alert('発行対象の会社がありませんでした。');
    return;
  }

  // 結果を表示
  let message = `${results.length}社にユーザーIDを発行しました。\n\n`;
  results.forEach(r => {
    message += `【${r.company}】\nID: ${r.username}\nPW: ${r.password}\n\n`;
  });

  // テキストファイルとしてダウンロード
  const blob = new Blob([message], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `company-users-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  alert(`${results.length}社にユーザーIDを発行しました。\nログイン情報はダウンロードされたテキストファイルを確認してください。`);

  await loadCompanyUsersData();
}

// クリップボードにコピー
function copyCredentialsToClipboard() {
  const username = document.getElementById('cu-issued-username')?.textContent;
  const password = document.getElementById('cu-issued-password')?.textContent;

  if (username && password) {
    const text = `ユーザーID: ${username}\nパスワード: ${password}`;
    navigator.clipboard.writeText(text).then(() => {
      alert('クリップボードにコピーしました');
    }).catch(() => {
      alert('コピーに失敗しました');
    });
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
    getIdToken,
    // Job-Manage埋め込みナビゲーション
    navigateToJobManage,
    navigateBack,
    // Company-Edit埋め込みナビゲーション
    navigateToCompanyEdit
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
