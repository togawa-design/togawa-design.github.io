/**
 * Admin Dashboard - メインエントリーポイント
 */

import { config, USER_ROLES } from './config.js';
import {
  initFirebase, checkSession, handleLogin, handleGoogleLogin, handleLogout, getIdToken,
  getUserRole, getUserCompanyDomain, isAdmin, handleCompanyLogin, confirmCompanySelection,
  getAllCompanyUsersWithInfo, addCompanyUser, updateCompanyUser, deleteCompanyUser,
  resetCompanyUserPassword, generatePassword, generateUsername, hasCompanyUser,
  // 会社ビューモード
  enterCompanyViewMode, exitCompanyViewMode, isInCompanyViewMode, getCompanyViewInfo, getAllCompanies
} from './auth.js';
import { loadDashboardData, filterCompanies, sortCompanies, initAnalyticsTabs, initCompanyDetailSection } from './analytics.js';
import { initPageAnalyticsTab, loadPageAnalyticsData } from './page-analytics.js';
import { initDatePicker, getDateRange } from './date-picker.js';
import { loadCompanyManageData, editCompany, showCompanyModal, closeCompanyModal, saveCompanyData, renderCompanyTable, openJobsArea } from './company-manager.js';
import { loadCompanyListForLP, loadLPSettings, saveLPSettings, renderHeroImagePresets, toggleLPPreview, closeLPPreview, debouncedUpdatePreview, initSectionSortable, updateLPPreview, initPointsSection, initFAQSection, initVideoButtonSection, resetLPLivePreviewState } from './lp-settings.js';
import { initRecruitSettings, setPendingCompany } from './recruit-settings.js';
import { initJobListings, setCompanyFilter } from './job-listings.js';
import { downloadIndeedXml, downloadGoogleJsonLd, downloadJobBoxXml, downloadCsv } from './job-feed-generator.js';
import * as JobsLoader from '@shared/jobs-loader.js';
import { escapeHtml, showToast } from '@shared/utils.js';
import { showConfirmDialog } from '@shared/modal.js';
import { initKeyboardShortcuts } from '@shared/keyboard-shortcuts.js';
import { initActivityTracker, updateUserInfo, trackLogin, trackSectionView, updateLastActive } from '@shared/activity-tracker.js';

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
  setPendingApplicationId,
  getPendingApplicationId,
  clearPendingApplicationId,
  isSectionSwitching,
  startSectionSwitch,
  endSectionSwitch
} from './admin-state.js';
import { initJobManageEmbedded } from './job-manage-embedded.js';
import { initCompanyEditEmbedded } from './company-edit-embedded.js';
import { loadSectionHTML } from './section-loader.js';

// データ移行モジュール
import * as DataMigration from './data-migration.js';

// お知らせ管理
import { initAnnouncementsSection } from './announcements.js';

// 利用状況
import { initAdminUsageSection } from './admin-usage.js';

// 広告費用管理
import { initAdCostsSection } from './ad-costs.js';

// 広告URL発行
import { initAdUrlSection } from './ad-url.js';

// 通知ベルコンポーネント
import { NotificationBell } from '@components/organisms/NotificationBell.js';

// 通知ベルインスタンス
let notificationBellInstance = null;

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

  // アクティビティトラッカーを初期化
  initializeActivityTracker();

  // 通知ベルを初期化
  initNotificationBell();

  // 会社ビューモード（Admin専用）
  initCompanyViewMode();
}

/**
 * アクティビティトラッカーを初期化
 */
function initializeActivityTracker() {
  if (typeof firebase === 'undefined' || !firebase.firestore) return;

  const db = firebase.firestore();
  const companyDomain = getUserCompanyDomain();
  const userId = sessionStorage.getItem('company_user_id') || '';
  const companiesJson = sessionStorage.getItem('available_companies');
  let companyName = companyDomain;

  if (companiesJson) {
    try {
      const companies = JSON.parse(companiesJson);
      const current = companies.find(c => c.companyDomain === companyDomain);
      if (current) {
        companyName = current.companyName || companyDomain;
      }
    } catch (e) { /* ignore */ }
  }

  initActivityTracker(db, {
    userId,
    userName: userId,
    companyDomain,
    companyName
  });

  // Firebase認証切れイベントをリッスン
  window.addEventListener('firebaseAuthExpired', () => {
    showToast('セッションが切れました。再度ログインしてください。', 'warning');
    handleLogout();
  }, { once: true });

  // 定期的に lastActiveAt を更新（5分ごと）
  setInterval(() => {
    const docId = sessionStorage.getItem('company_user_doc_id');
    if (docId) {
      updateLastActive(docId);
    }
  }, 5 * 60 * 1000);
}

/**
 * 通知ベルコンポーネントを初期化
 */
async function initNotificationBell() {
  // 既存のインスタンスがあれば破棄
  if (notificationBellInstance) {
    notificationBellInstance.destroy();
    notificationBellInstance = null;
  }

  const containerId = 'notification-bell-container';
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('[Admin] Notification bell container not found');
    return;
  }

  try {
    // ユーザーの権限に応じて設定を変更
    const adminUser = isAdmin();
    const companyDomain = getUserCompanyDomain();

    // 会社ビューモード中かどうかをチェック
    const inCompanyViewMode = isInCompanyViewMode();
    const viewInfo = inCompanyViewMode ? getCompanyViewInfo() : null;

    // 会社ビューモード中は会社ユーザーとして表示
    // Admin（通常モード）: お知らせ(all) + 応募者通知(全会社)
    // Admin（会社ビューモード）: お知らせ(company_users) + 応募者通知(その会社のみ)
    // Company: お知らせ(company_users) + 応募者通知(自社のみ)
    const effectiveTargetAudience = (adminUser && !inCompanyViewMode) ? 'all' : 'company_users';
    const effectiveCompanyDomain = inCompanyViewMode ? viewInfo?.companyDomain : (adminUser ? null : companyDomain);

    notificationBellInstance = new NotificationBell({
      containerId,
      targetAudience: effectiveTargetAudience,
      companyDomain: effectiveCompanyDomain,
      showApplications: true  // 管理画面では応募通知を表示
    });

    await notificationBellInstance.init();
    console.log('[Admin] Notification bell initialized', { effectiveTargetAudience, effectiveCompanyDomain, inCompanyViewMode });
  } catch (error) {
    console.error('[Admin] Failed to initialize notification bell:', error);
  }
}

/**
 * 会社ビューモードを初期化（Admin専用）
 */
async function initCompanyViewMode() {
  // Admin以外は非表示
  if (!isAdmin()) {
    return;
  }

  const section = document.getElementById('company-view-section');
  const selector = document.getElementById('company-view-selector');
  const select = document.getElementById('company-view-select');
  const viewBar = document.getElementById('company-view-bar');
  const viewName = document.getElementById('company-view-name');
  const exitBtn = document.getElementById('exit-company-view-btn');

  if (!section || !selector || !select) {
    return;
  }

  // 会社一覧を取得してセレクトボックスに追加
  try {
    const companies = await getAllCompanies();

    // 既存のオプション以外をクリア
    select.innerHTML = '<option value="">管理者モード</option>';

    companies.forEach(company => {
      const option = document.createElement('option');
      option.value = company.domain;
      option.textContent = company.name || company.domain;
      option.dataset.companyName = company.name || company.domain;
      select.appendChild(option);
    });

    // セクション全体を表示
    section.style.display = 'block';

    // 既に会社ビューモード中なら復元
    if (isInCompanyViewMode()) {
      const viewInfo = getCompanyViewInfo();
      if (viewInfo) {
        select.value = viewInfo.companyDomain;
        showCompanyViewBar(viewInfo.companyName);
      }
    }

    // 選択変更イベント
    select.addEventListener('change', (e) => {
      const companyDomain = e.target.value;
      if (companyDomain) {
        const companyName = e.target.selectedOptions[0].dataset.companyName || companyDomain;
        enterCompanyViewMode(companyDomain, companyName);
        showCompanyViewBar(companyName);
      } else {
        exitCompanyViewMode();
        hideCompanyViewBar();
      }
    });

    // 終了ボタン
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        exitCompanyViewMode();
        hideCompanyViewBar();
        select.value = '';
      });
    }

    console.log('[Admin] Company view mode initialized with', companies.length, 'companies');
  } catch (error) {
    console.error('[Admin] Failed to initialize company view mode:', error);
  }

  function showCompanyViewBar(companyName) {
    if (viewBar && viewName && selector) {
      viewName.textContent = companyName;
      viewBar.style.display = 'flex';
      selector.style.display = 'none';
    }
  }

  function hideCompanyViewBar() {
    if (viewBar && selector) {
      viewBar.style.display = 'none';
      selector.style.display = 'flex';
    }
  }
}

// 会社ビューモード変更イベントをリッスン
document.addEventListener('companyViewModeChanged', (e) => {
  const { active, companyDomain, companyName } = e.detail;
  console.log('[Admin] companyViewModeChanged event received:', { active, companyDomain, companyName });

  // ビューバーUI要素
  const selector = document.getElementById('company-view-selector');
  const viewBar = document.getElementById('company-view-bar');
  const viewNameEl = document.getElementById('company-view-name');
  const select = document.getElementById('company-view-select');

  console.log('[Admin] UI elements:', { selector: !!selector, viewBar: !!viewBar, viewNameEl: !!viewNameEl, select: !!select });

  if (active) {
    // 会社ビューモードに入った時
    // 現在のセクションを先に取得（applyRoleBasedUIで上書きされるため）
    let currentSection = document.querySelector('.sidebar-nav:not([style*="none"]) li.active a[data-section]')?.dataset.section
      || window.location.hash.slice(1)
      || 'job-manage-company';
    console.log('[Admin] Current section before switch:', currentSection);

    // Admin専用セクションを会社ユーザー用にマッピング
    const sectionMapping = {
      'company-manage': 'job-manage-company',
      'job-listings': 'job-manage-company',
      'company-users': 'settings',
      'announcements': 'overview'
    };
    if (sectionMapping[currentSection]) {
      console.log('[Admin] Section mapped:', currentSection, '->', sectionMapping[currentSection]);
      currentSection = sectionMapping[currentSection];
    }

    // ビューバーを表示
    if (viewBar && viewNameEl && selector) {
      viewNameEl.textContent = companyName || companyDomain;
      viewBar.style.display = 'flex';
      selector.style.display = 'none';
      console.log('[Admin] View bar shown for:', companyName || companyDomain);
    }
    // ドロップダウンの値を更新
    if (select) {
      select.value = companyDomain;
    }
    // 会社ユーザー向けナビゲーションに切り替え
    const navAdmin = document.getElementById('nav-admin');
    const navCompany = document.getElementById('nav-company');
    if (navAdmin) navAdmin.style.display = 'none';
    if (navCompany) navCompany.style.display = 'block';

    // セクションをリロード（会社ビューモードのデータで再読み込み）
    console.log('[Admin] Switching to section:', currentSection);
    switchSection(currentSection);

    // 通知ベルを会社ユーザー向けに再初期化
    initNotificationBell();
  } else {
    // 会社ビューモードを終了した時
    // ビューバーを非表示
    if (viewBar && selector) {
      viewBar.style.display = 'none';
      selector.style.display = 'flex';
    }
    // ドロップダウンをリセット
    if (select) {
      select.value = '';
    }
    // 管理者用ナビゲーションに切り替え
    const navAdmin = document.getElementById('nav-admin');
    const navCompany = document.getElementById('nav-company');
    if (navAdmin) navAdmin.style.display = 'block';
    if (navCompany) navCompany.style.display = 'none';
    // 概要セクションに切り替え
    switchSection('overview');

    // 通知ベルを管理者向けに再初期化
    initNotificationBell();
  }
});

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

  // URLハッシュから初期セクションを取得
  const hash = window.location.hash.slice(1); // '#overview' -> 'overview'
  let initialSection = null;

  if (!isAdmin()) {
    // 会社ユーザー用ナビゲーションを表示
    if (navAdmin) navAdmin.style.display = 'none';
    if (navCompany) navCompany.style.display = 'block';

    // 会社ユーザーはデフォルトで求人一覧を表示
    initialSection = hash || 'job-listings';

    // サイドバーのヘッダーに会社名を表示
    const sidebarHeader = document.querySelector('.sidebar-header p');
    if (sidebarHeader && companyDomain) {
      sidebarHeader.textContent = `${companyDomain} 管理画面`;
    }

    // 設定画面の制御（パスワード変更のみ表示）
    applySettingsRestrictions();
  } else {
    // 管理者用ナビゲーションを表示
    if (navAdmin) navAdmin.style.display = 'block';
    if (navCompany) navCompany.style.display = 'none';

    // 管理者はデフォルトで概要を表示
    initialSection = hash || 'overview';
  }

  // 初期履歴を設定（replaceStateで現在の履歴エントリを置き換え）
  history.replaceState({ section: initialSection, company: null }, '', `#${initialSection}`);
  switchSection(initialSection, { pushState: false });
}

/**
 * 設定画面の制限を適用（会社ユーザー用）
 * 管理者専用セクションを非表示、会社ユーザー向けセクションを表示
 */
function applySettingsRestrictions() {
  const settingsSection = document.getElementById('section-settings');
  if (!settingsSection) return;

  // 管理者専用セクションを非表示
  const adminOnlySections = settingsSection.querySelectorAll('.admin-only-section');
  adminOnlySections.forEach(section => {
    section.style.display = 'none';
  });

  // 会社ユーザー専用セクションを表示
  const companyOnlySections = settingsSection.querySelectorAll('.company-only-section');
  companyOnlySections.forEach(section => {
    section.style.display = 'block';
  });

  // 以下のセクションは会社ユーザーには非表示
  const hiddenTitles = ['スプレッドシート連携', 'API設定', 'レガシー管理者パスワード'];
  const cards = settingsSection.querySelectorAll('.settings-card');
  cards.forEach(card => {
    const title = card.querySelector('h3')?.textContent;
    if (hiddenTitles.includes(title)) {
      card.style.display = 'none';
    }
  });
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

// セクション切り替え（動的読み込み対応）
// options.pushState: ブラウザ履歴に追加するか（デフォルト: true）
// options.company: 会社情報（job-manage用）
async function switchSection(sectionName, options = {}) {
  const { pushState: shouldPushState = true, company = null } = options;

  // 連打防止: 切り替え中なら無視
  if (isSectionSwitching()) {
    return;
  }

  // 会社ユーザーが「求人管理」をクリックした場合、自社のjob-manage画面に遷移
  if (sectionName === 'job-manage-company') {
    const companyDomain = getUserCompanyDomain();
    if (companyDomain) {
      navigateToJobManage(companyDomain, companyDomain, 'overview', null, 'jobs');
      return;
    }
  }

  // 切り替え開始
  startSectionSwitch();

  // ブラウザ履歴に追加（popstateからの呼び出し時は追加しない）
  if (shouldPushState) {
    const state = {
      section: sectionName,
      company: company || (sectionName === 'job-manage' ? { domain: currentCompany.domain, name: currentCompany.name } : null)
    };
    history.pushState(state, '', `#${sectionName}`);
  }

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

  // セクションがDOMに存在しない場合は動的に読み込む
  let targetSection = document.getElementById(`section-${sectionName}`);
  if (!targetSection) {
    const container = document.getElementById('section-container');
    if (container) {
      try {
        const html = await loadSectionHTML(sectionName);
        const temp = document.createElement('div');
        temp.innerHTML = html;
        targetSection = temp.firstElementChild;
        if (targetSection) {
          container.appendChild(targetSection);
        }
      } catch (error) {
        console.error(`[Admin] Failed to load section: ${sectionName}`, error);
        endSectionSwitch();
        return;
      }
    }
  }

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
    'announcements': 'お知らせ管理',
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

    // 動的読み込み対応: 新規会社登録ボタンのイベントハンドラー設定
    const btnAddCompany = document.getElementById('btn-add-company');
    if (btnAddCompany && !btnAddCompany.hasAttribute('data-listener-attached')) {
      btnAddCompany.addEventListener('click', () => showCompanyModal());
      btnAddCompany.setAttribute('data-listener-attached', 'true');
    }
  }

  // LP設定セクションに切り替えた場合は会社リストを読み込む
  if (sectionName === 'lp-settings') {
    // 動的読み込み時にプレビュー初期化フラグをリセット
    resetLPLivePreviewState();

    loadCompanyListForLP();
    renderHeroImagePresets();

    // 動的読み込み対応: 保存ボタンのイベントハンドラー設定
    const lpSaveBtn = document.getElementById('btn-save-lp-settings');
    if (lpSaveBtn && !lpSaveBtn.hasAttribute('data-listener-attached')) {
      lpSaveBtn.addEventListener('click', () => saveLPSettings());
      lpSaveBtn.setAttribute('data-listener-attached', 'true');
    }

    // 動的読み込み対応: リセットボタンのイベントハンドラー設定
    const lpResetBtn = document.getElementById('btn-reset-lp-settings');
    if (lpResetBtn && !lpResetBtn.hasAttribute('data-listener-attached')) {
      lpResetBtn.addEventListener('click', () => {
        const jobId = document.getElementById('lp-job-select')?.value;
        if (jobId) loadLPSettings(jobId);
      });
      lpResetBtn.setAttribute('data-listener-attached', 'true');
    }

    // 動的読み込み対応: 折りたたみパネルの初期化
    document.querySelectorAll('#section-lp-settings .collapsible-header').forEach(header => {
      if (!header.hasAttribute('data-listener-attached')) {
        header.addEventListener('click', () => {
          const parent = header.closest('.collapsible');
          if (parent) {
            parent.classList.toggle('collapsed');
          }
        });
        header.setAttribute('data-listener-attached', 'true');
      }
    });

    // 広告トラッキングとOGPセクションは初期状態で閉じておく
    document.querySelectorAll('#ad-tracking-section, #ogp-section').forEach(section => {
      if (!section.classList.contains('collapsed')) {
        section.classList.add('collapsed');
      }
    });
  }

  // 採用ページ設定セクションに切り替えた場合は初期化
  if (sectionName === 'recruit-settings') {
    initRecruitSettings();
  }

  // 求人一覧セクションに切り替えた場合は初期化
  if (sectionName === 'job-listings') {
    initJobListings();
  }

  // 詳細分析セクションに切り替えた場合はタブを初期化
  if (sectionName === 'analytics-detail') {
    initAnalyticsTabs();
    // 初期データ読み込み
    loadDashboardData();
  }

  // 期間選択と更新ボタンはアナリティクスセクションのみ表示
  // ※ header-actions全体ではなく、日付ピッカーのみ非表示にする（会社ビューバーは常に表示）
  const analyticsSection = ['overview', 'analytics-detail'];
  const dateRangePicker = document.querySelector('.date-range-picker');
  if (dateRangePicker) {
    dateRangePicker.style.display = analyticsSection.includes(sectionName) ? '' : 'none';
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

    // 動的読み込み対応: 新規ユーザー追加ボタンのイベントハンドラー設定
    const btnAddCompanyUser = document.getElementById('btn-add-company-user');
    if (btnAddCompanyUser && !btnAddCompanyUser.hasAttribute('data-listener-attached')) {
      btnAddCompanyUser.addEventListener('click', () => showCompanyUserModal(null, '', ''));
      btnAddCompanyUser.setAttribute('data-listener-attached', 'true');
    }

    // 動的読み込み対応: 一括発行ボタン
    const btnBulkGenerate = document.getElementById('btn-bulk-generate');
    if (btnBulkGenerate && !btnBulkGenerate.hasAttribute('data-listener-attached')) {
      btnBulkGenerate.addEventListener('click', () => bulkGenerateUsers());
      btnBulkGenerate.setAttribute('data-listener-attached', 'true');
    }

    // 動的読み込み対応: モーダル関連
    setupCompanyUserModalEvents();
  }

  // 設定セクションに切り替えた場合
  if (sectionName === 'settings') {
    const { isAdmin } = await import('./auth.js');
    if (isAdmin()) {
      loadAdminUsersData();
      // 動的読み込み対応: 管理者追加ボタンのイベントハンドラー設定
      setupAdminUserManagement();
    } else {
      loadCompanyStaffData();
      setupCompanyStaffEvents();
    }

    // 動的読み込み対応: フィード出力ボタンのイベントハンドラー設定
    setupFeedDownloadButtons();
  }

  // お知らせ管理セクションに切り替えた場合
  if (sectionName === 'announcements') {
    initAnnouncementsSection();
  }

  // 管理画面利用状況セクションに切り替えた場合
  if (sectionName === 'admin-usage') {
    initAdminUsageSection();
  }

  // 広告費用管理セクションに切り替えた場合
  if (sectionName === 'ad-costs') {
    initAdCostsSection();
  }

  // 広告URL発行セクションに切り替えた場合
  if (sectionName === 'ad-url') {
    initAdUrlSection();
  }

  // Job-Manage埋め込みセクションに切り替えた場合は初期化
  if (sectionName === 'job-manage') {
    // 戻るボタンのイベントハンドラー設定（動的読み込み対応）
    const jmBackBtn = document.getElementById('jm-back-btn');
    if (jmBackBtn && !jmBackBtn.hasAttribute('data-listener-attached')) {
      jmBackBtn.addEventListener('click', navigateBack);
      jmBackBtn.setAttribute('data-listener-attached', 'true');
    }

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

  // Company-Detailセクションに切り替えた場合は初期化（動的読み込み対応）
  if (sectionName === 'company-detail') {
    initCompanyDetailSection();
  }

  // セクション表示をトラッキング
  trackSectionView(sectionName);

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
 * 応募者通知からの遷移を処理
 * @param {string} applicationId - 応募ID
 * @param {string} companyDomain - 会社ドメイン
 */
async function handleNavigateToApplicant(applicationId, companyDomain) {
  if (!applicationId) return;

  // 会社情報を取得
  const companies = await getAllCompanies();
  const company = companies.find(c => c.companyDomain === companyDomain);
  const companyName = company?.company || companyDomain || '全会社';

  // 会社を設定
  setCurrentCompany(companyDomain, companyName);

  // 応募者IDを設定
  setPendingApplicationId(applicationId);

  // applicantsタブを初期表示に設定
  setPendingInitialTab('applicants');

  // job-manageセクションに遷移
  pushHistory('applicant-select');
  switchSection('job-manage');
}

/**
 * 前のセクションに戻る
 */
function navigateBack() {
  // ブラウザ履歴を使って戻る（popstateイベントが発火してセクション切り替えが行われる）
  history.back();
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

// ========================================
// 会社選択モーダル（複数会社所属ユーザー用）
// ========================================

/**
 * 会社選択モーダルを表示
 * @param {Array} companies - 会社一覧
 */
function showCompanySelectModal(companies) {
  const modal = document.getElementById('company-select-modal');
  const list = document.getElementById('company-select-list');

  if (!modal || !list) return;

  // リストを構築
  list.innerHTML = companies.map(company => `
    <div class="company-select-item" data-domain="${escapeHtml(company.companyDomain)}">
      <div class="company-icon">🏢</div>
      <div class="company-info">
        <div class="company-name">${escapeHtml(company.companyName)}</div>
        <div class="company-domain">${escapeHtml(company.companyDomain)}</div>
      </div>
      <div class="arrow-icon">→</div>
    </div>
  `).join('');

  modal.style.display = 'flex';
}

/**
 * 会社選択モーダルを閉じる
 */
function hideCompanySelectModal() {
  const modal = document.getElementById('company-select-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * 会社選択モーダルのイベント設定
 */
function setupCompanySelectModal() {
  const modal = document.getElementById('company-select-modal');
  const list = document.getElementById('company-select-list');

  if (!list) return;

  // 会社選択時の処理
  list.addEventListener('click', async (e) => {
    const item = e.target.closest('.company-select-item');
    if (!item) return;

    const companyDomain = item.dataset.domain;
    const result = await confirmCompanySelection(companyDomain);

    if (result.success) {
      hideCompanySelectModal();
      showDashboard();
      // ログインをトラッキング
      if (result.userId) {
        sessionStorage.setItem('company_user_doc_id', result.userId);
        trackLogin(result.userId);
      }
      navigateToJobManage(result.companyDomain, result.companyName, 'overview', null, 'jobs');
    } else {
      showToast(result.error || '会社の選択に失敗しました', 'error');
    }
  });

  // モーダル外クリックでは閉じない（会社選択は必須）
}

// イベントバインド
function bindEvents() {
  console.log('bindEvents called');

  // 応募者通知からの遷移イベント
  document.addEventListener('navigateToApplicant', (event) => {
    const { applicationId, companyDomain } = event.detail;
    handleNavigateToApplicant(applicationId, companyDomain);
  });

  // ブラウザの戻る/進むボタン対応
  window.addEventListener('popstate', (event) => {
    if (event.state && event.state.section) {
      // 会社情報を復元
      if (event.state.company) {
        setCurrentCompany(event.state.company.domain, event.state.company.name);
      } else {
        clearCurrentCompany();
      }
      clearEditingCompanyDomain();
      // pushState: false で履歴に追加しない
      switchSection(event.state.section, { pushState: false });
    }
  });

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
  console.log('Setting up login tabs, found:', document.querySelectorAll('.login-tab').length);
  document.querySelectorAll('.login-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      console.log('Tab clicked:', tab.dataset.tab);
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
      const email = document.getElementById('company-email')?.value || '';
      const password = document.getElementById('company-password')?.value || '';
      const errorEl = document.getElementById('company-login-error');

      if (errorEl) errorEl.style.display = 'none';

      const result = await handleCompanyLogin(email, password);
      if (result.success) {
        // 複数会社に所属している場合は会社選択モーダルを表示
        if (result.requiresCompanySelection) {
          showCompanySelectModal(result.companies);
        } else {
          // 単一会社の場合は直接遷移
          showDashboard();
          // ログインをトラッキング
          if (result.userId) {
            sessionStorage.setItem('company_user_doc_id', result.userId);
            trackLogin(result.userId);
          }
          navigateToJobManage(result.companyDomain, result.companyName || result.companyDomain, 'overview', null, 'jobs');
        }
      } else {
        if (errorEl) {
          errorEl.textContent = result.error;
          errorEl.style.display = 'block';
        }
      }
    });
  }

  // 会社選択モーダルの初期化
  setupCompanySelectModal();

  // パスワードリセットリンク
  const passwordResetLink = document.getElementById('company-password-reset-link');
  if (passwordResetLink) {
    passwordResetLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const emailOrUsername = document.getElementById('company-email')?.value || '';

      if (!emailOrUsername) {
        showToast('メールアドレスまたはユーザーIDを入力してください', 'error');
        return;
      }

      // メールアドレス形式かチェック
      const isEmail = emailOrUsername.includes('@');
      if (!isEmail) {
        showToast('パスワードリセットにはメールアドレスが必要です。ユーザーIDでログインしている場合は、管理者にお問い合わせください。', 'error');
        return;
      }

      const { sendPasswordResetEmail } = await import('./auth.js');
      const result = await sendPasswordResetEmail(emailOrUsername);

      if (result.success) {
        showToast('パスワードリセットメールを送信しました', 'success');
      } else {
        showToast(result.error || 'パスワードリセットメールの送信に失敗しました', 'error');
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

  // LP設定: キーボードショートカット（Ctrl+S で保存）
  const lpEditor = document.getElementById('lp-editor');
  if (lpEditor) {
    initKeyboardShortcuts({
      onSave: () => {
        // LP設定セクションが表示されている場合のみ保存
        const lpSection = document.getElementById('section-lp-settings');
        if (lpSection && !lpSection.classList.contains('hidden')) {
          saveLPSettings();
        }
      },
      scope: lpEditor
    });
  }

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
        showToast('パスワードを変更しました', 'success');
      } else {
        showToast('パスワードは4文字以上で入力してください', 'error');
      }
    });
  }

  // 管理者ユーザー管理
  setupAdminUserManagement();

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
        showToast('Indeed XMLフィードをダウンロードしました', 'success');
      } catch (error) {
        showToast('フィード生成に失敗しました: ' + error.message, 'error');
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
        showToast('Google JSON-LDをダウンロードしました', 'success');
      } catch (error) {
        showToast('フィード生成に失敗しました: ' + error.message, 'error');
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
        showToast('求人ボックスXMLをダウンロードしました', 'success');
      } catch (error) {
        showToast('フィード生成に失敗しました: ' + error.message, 'error');
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
        showToast('CSVをダウンロードしました', 'success');
      } catch (error) {
        showToast('フィード生成に失敗しました: ' + error.message, 'error');
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

/**
 * 会社ユーザー管理モーダルのイベントを動的にセットアップ
 */
function setupCompanyUserModalEvents() {
  // モーダル閉じるボタン
  const cuModalClose = document.getElementById('company-user-modal-close');
  if (cuModalClose && !cuModalClose.hasAttribute('data-listener-attached')) {
    cuModalClose.addEventListener('click', closeCompanyUserModal);
    cuModalClose.setAttribute('data-listener-attached', 'true');
  }

  const cuModalCancel = document.getElementById('company-user-modal-cancel');
  if (cuModalCancel && !cuModalCancel.hasAttribute('data-listener-attached')) {
    cuModalCancel.addEventListener('click', closeCompanyUserModal);
    cuModalCancel.setAttribute('data-listener-attached', 'true');
  }

  // モーダル保存フォーム
  const cuForm = document.getElementById('company-user-form');
  if (cuForm && !cuForm.hasAttribute('data-listener-attached')) {
    cuForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCompanyUser();
    });
    cuForm.setAttribute('data-listener-attached', 'true');
  }

  // ユーザー削除ボタン
  const cuDelete = document.getElementById('company-user-delete');
  if (cuDelete && !cuDelete.hasAttribute('data-listener-attached')) {
    cuDelete.addEventListener('click', deleteCompanyUserHandler);
    cuDelete.setAttribute('data-listener-attached', 'true');
  }

  // パスワード自動生成ボタン
  const cuGeneratePassword = document.getElementById('cu-generate-password');
  if (cuGeneratePassword && !cuGeneratePassword.hasAttribute('data-listener-attached')) {
    cuGeneratePassword.addEventListener('click', () => {
      const passwordInput = document.getElementById('cu-password');
      if (passwordInput) {
        passwordInput.value = generatePassword();
      }
    });
    cuGeneratePassword.setAttribute('data-listener-attached', 'true');
  }

  // クリップボードコピーボタン
  const cuCopyCredentials = document.getElementById('cu-copy-credentials');
  if (cuCopyCredentials && !cuCopyCredentials.hasAttribute('data-listener-attached')) {
    cuCopyCredentials.addEventListener('click', copyCredentialsToClipboard);
    cuCopyCredentials.setAttribute('data-listener-attached', 'true');
  }

  // モーダル外クリックで閉じる
  const cuModal = document.getElementById('company-user-modal');
  if (cuModal && !cuModal.hasAttribute('data-listener-attached')) {
    cuModal.addEventListener('click', (e) => {
      if (e.target === cuModal) {
        closeCompanyUserModal();
      }
    });
    cuModal.setAttribute('data-listener-attached', 'true');
  }
}

/**
 * フィード出力ボタンのイベントを動的にセットアップ
 */
function setupFeedDownloadButtons() {
  const feedStatus = document.getElementById('feed-status');
  const showFeedLoading = () => {
    if (feedStatus) {
      feedStatus.style.display = 'block';
      feedStatus.textContent = 'フィード生成中...';
    }
  };
  const hideFeedLoading = () => {
    if (feedStatus) feedStatus.style.display = 'none';
  };

  const btnDownloadIndeed = document.getElementById('btn-download-indeed');
  if (btnDownloadIndeed && !btnDownloadIndeed.hasAttribute('data-listener-attached')) {
    btnDownloadIndeed.addEventListener('click', async () => {
      try {
        showFeedLoading();
        await downloadIndeedXml();
        showToast('Indeed XMLフィードをダウンロードしました', 'success');
      } catch (error) {
        showToast('フィード生成に失敗しました: ' + error.message, 'error');
      } finally {
        hideFeedLoading();
      }
    });
    btnDownloadIndeed.setAttribute('data-listener-attached', 'true');
  }

  const btnDownloadGoogle = document.getElementById('btn-download-google');
  if (btnDownloadGoogle && !btnDownloadGoogle.hasAttribute('data-listener-attached')) {
    btnDownloadGoogle.addEventListener('click', async () => {
      try {
        showFeedLoading();
        await downloadGoogleJsonLd();
        showToast('Google JSON-LDをダウンロードしました', 'success');
      } catch (error) {
        showToast('フィード生成に失敗しました: ' + error.message, 'error');
      } finally {
        hideFeedLoading();
      }
    });
    btnDownloadGoogle.setAttribute('data-listener-attached', 'true');
  }

  const btnDownloadJobbox = document.getElementById('btn-download-jobbox');
  if (btnDownloadJobbox && !btnDownloadJobbox.hasAttribute('data-listener-attached')) {
    btnDownloadJobbox.addEventListener('click', async () => {
      try {
        showFeedLoading();
        await downloadJobBoxXml();
        showToast('求人ボックスXMLをダウンロードしました', 'success');
      } catch (error) {
        showToast('フィード生成に失敗しました: ' + error.message, 'error');
      } finally {
        hideFeedLoading();
      }
    });
    btnDownloadJobbox.setAttribute('data-listener-attached', 'true');
  }

  const btnDownloadCsv = document.getElementById('btn-download-csv');
  if (btnDownloadCsv && !btnDownloadCsv.hasAttribute('data-listener-attached')) {
    btnDownloadCsv.addEventListener('click', async () => {
      try {
        showFeedLoading();
        await downloadCsv();
        showToast('CSVをダウンロードしました', 'success');
      } catch (error) {
        showToast('フィード生成に失敗しました: ' + error.message, 'error');
      } finally {
        hideFeedLoading();
      }
    });
    btnDownloadCsv.setAttribute('data-listener-attached', 'true');
  }
}

// 応募者管理用の会社グリッドを表示
async function renderApplicantCompanyGrid() {
  const grid = document.getElementById('applicant-company-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading-cell">会社一覧を読み込み中...</div>';

  try {
    const companies = await JobsLoader.fetchCompanies();

    // 会社ユーザーの場合は直接自社の応募者管理画面に遷移（SPA内）
    if (!isAdmin()) {
      const companyDomain = getUserCompanyDomain();
      if (companyDomain) {
        // 会社名を取得
        const userCompany = companies.find(c => c.companyDomain === companyDomain);
        const companyName = userCompany?.company || companyDomain;
        // セクション切り替え完了後に遷移（isSectionSwitching チェックを回避）
        setTimeout(() => {
          navigateToJobManage(companyDomain, companyName, 'applicant-select', null, 'applicants');
        }, 50);
        return;
      }
    }
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

  tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">データを読み込み中...</td></tr>';

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
      tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">会社データがありません</td></tr>';
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
            <td>-</td>
            <td>-</td>
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
          const roleBadge = user.role === 'admin'
            ? '<span class="badge primary">管理者</span>'
            : '<span class="badge">担当者</span>';

          html += `
            <tr data-user-id="${escapeHtml(user.id)}">
              ${idx === 0 ? `<td rowspan="${users.length}">${escapeHtml(company.company)}</td>` : ''}
              <td><code>${escapeHtml(user.username)}</code></td>
              <td>${escapeHtml(user.name || '-')}</td>
              <td>${roleBadge}</td>
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
    tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">データの取得に失敗しました</td></tr>';
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
  const nameInput = document.getElementById('cu-name');
  const roleSelect = document.getElementById('cu-role');
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
    if (nameInput) nameInput.value = user.name || '';
    if (roleSelect) roleSelect.value = user.role || 'staff';
    isActiveCheckbox.checked = user.isActive !== false;
    deleteBtn.style.display = '';
    currentEditingUserId = user.id;
  } else {
    // 新規作成モード
    title.textContent = '会社ユーザーの追加';
    usernameInput.value = generateUsername(companyDomain);
    passwordInput.value = generatePassword();
    passwordInput.placeholder = 'パスワード';
    passwordInput.required = false;
    if (nameInput) nameInput.value = '';
    if (roleSelect) roleSelect.value = 'staff';
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
  const email = document.getElementById('cu-email')?.value?.trim();
  const password = document.getElementById('cu-password')?.value;
  const name = document.getElementById('cu-name')?.value?.trim() || '';
  const username = document.getElementById('cu-username')?.value?.trim() || '';
  const role = document.getElementById('cu-role')?.value || 'staff';
  const isActive = document.getElementById('cu-is-active')?.checked;

  if (!companyDomain || !email) {
    showToast('必須項目を入力してください', 'error');
    return;
  }

  // メールアドレス形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast('メールアドレスの形式が正しくありません', 'error');
    return;
  }

  const saveBtn = document.getElementById('company-user-modal-save');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';
  }

  try {
    if (currentEditingUserId) {
      // 更新（メールアドレスは変更不可）
      const updateData = { name, role, isActive };
      if (username) {
        updateData.username = username;
      }

      const result = await updateCompanyUser(currentEditingUserId, updateData);
      if (!result.success) {
        throw new Error(result.error);
      }

      showToast('ユーザー情報を更新しました', 'success');
      closeCompanyUserModal();

    } else {
      // 新規作成
      // パスワードは新規ユーザーのみ必須（既存のFirebase Authユーザーは不要）
      // Cloud Functionが判断するため、ここではパスワード長のみチェック
      if (password && password.length < 8) {
        showToast('パスワードは8文字以上で入力してください', 'error');
        return;
      }

      const result = await addCompanyUser(email, password || '', companyDomain, name, role, username);
      if (!result.success) {
        throw new Error(result.error);
      }

      // 発行情報を表示
      const issuedEmailEl = document.getElementById('cu-issued-email');
      if (issuedEmailEl) {
        issuedEmailEl.textContent = email;
      }
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

      // レガシー認証の場合は警告を表示
      if (result._isLegacy) {
        showToast('ユーザーを作成しました（レガシーモード）。Cloud Functionの設定を推奨します。', 'warning');
      } else {
        showToast('ユーザーを作成しました', 'success');
      }
    }

    await loadCompanyUsersData();

  } catch (error) {
    console.error('ユーザー保存エラー:', error);
    showToast('保存に失敗しました: ' + error.message, 'error');
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

  const confirmed = await showConfirmDialog({
    title: 'ユーザーの削除',
    message: 'このユーザーを削除してもよろしいですか？',
    confirmText: '削除する',
    cancelText: 'キャンセル',
    danger: true
  });
  if (!confirmed) return;

  try {
    const result = await deleteCompanyUser(currentEditingUserId);
    if (!result.success) {
      throw new Error(result.error);
    }

    showToast('ユーザーを削除しました', 'success');
    closeCompanyUserModal();
    await loadCompanyUsersData();

  } catch (error) {
    console.error('ユーザー削除エラー:', error);
    showToast('削除に失敗しました: ' + error.message, 'error');
  }
}

// パスワードを再発行
async function resetPassword(userId, username) {
  const confirmed = await showConfirmDialog({
    title: 'パスワードの再発行',
    message: `${username} のパスワードを再発行しますか？`,
    confirmText: '再発行する',
    cancelText: 'キャンセル'
  });
  if (!confirmed) return;

  const newPassword = generatePassword();

  try {
    const result = await resetCompanyUserPassword(userId, newPassword);
    if (!result.success) {
      throw new Error(result.error);
    }

    // クリップボードにコピー
    try {
      await navigator.clipboard.writeText(`ユーザーID: ${username}\nパスワード: ${newPassword}`);
      showToast('新しいパスワードをクリップボードにコピーしました', 'success');
    } catch {
      showToast('パスワードを再発行しました', 'success');
    }

  } catch (error) {
    console.error('パスワード再発行エラー:', error);
    showToast('パスワードの再発行に失敗しました: ' + error.message, 'error');
  }
}

// 未発行の会社に一括発行
async function bulkGenerateUsers() {
  const confirmed = await showConfirmDialog({
    title: 'ユーザーIDの一括発行',
    message: '未発行の全会社にユーザーIDを発行しますか？',
    confirmText: '発行する',
    cancelText: 'キャンセル'
  });
  if (!confirmed) return;

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
    showToast('発行対象の会社がありませんでした', 'info');
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

  showToast(`${results.length}社にユーザーIDを発行しました`, 'success');

  await loadCompanyUsersData();
}

// クリップボードにコピー
function copyCredentialsToClipboard() {
  const email = document.getElementById('cu-issued-email')?.textContent;
  const password = document.getElementById('cu-issued-password')?.textContent;

  if (email && password) {
    const text = `メールアドレス: ${email}\nパスワード: ${password}`;
    navigator.clipboard.writeText(text).then(() => {
      showToast('クリップボードにコピーしました', 'success');
    }).catch(() => {
      showToast('コピーに失敗しました', 'error');
    });
  }
}

// 管理者ユーザー管理のセットアップ
function setupAdminUserManagement() {
  const addAdminBtn = document.getElementById('add-admin-user');
  if (addAdminBtn && !addAdminBtn.hasAttribute('data-listener-attached')) {
    addAdminBtn.setAttribute('data-listener-attached', 'true');
    addAdminBtn.addEventListener('click', async () => {
      const email = document.getElementById('admin-email')?.value?.trim();
      if (!email) {
        showToast('メールアドレスを入力してください', 'error');
        return;
      }

      addAdminBtn.disabled = true;
      addAdminBtn.textContent = '追加中...';

      try {
        const { addAdminUserByEmail } = await import('./auth.js');
        const result = await addAdminUserByEmail(email);

        if (result.success) {
          showToast(`管理者を追加しました: ${email}`, 'success');
          document.getElementById('admin-email').value = '';
          await loadAdminUsersData();
        } else {
          showToast(result.error || '追加に失敗しました', 'error');
        }
      } catch (error) {
        showToast('エラーが発生しました: ' + error.message, 'error');
      } finally {
        addAdminBtn.disabled = false;
        addAdminBtn.textContent = '管理者を追加';
      }
    });
  }
}

// 管理者ユーザー一覧を読み込み
async function loadAdminUsersData() {
  const container = document.getElementById('admin-users-list');
  if (!container) return;

  container.innerHTML = '<div class="loading-spinner-small"></div><span>読み込み中...</span>';

  try {
    const { getAdminUsers, getCurrentUser } = await import('./auth.js');
    const currentUser = getCurrentUser();

    if (!currentUser) {
      container.innerHTML = `
        <div class="admin-users-notice">
          <p>管理者ユーザー一覧を表示するには、<strong>Googleでログイン</strong>してください。</p>
          <p style="font-size: 0.875rem; color: var(--text-muted);">レガシー認証（admin/password）ではこの機能は使用できません。</p>
        </div>
      `;
      return;
    }

    const adminUsers = await getAdminUsers();

    if (adminUsers.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted);">登録されている管理者はいません</p>';
      return;
    }

    container.innerHTML = adminUsers.map(user => `
      <div class="admin-user-item" data-id="${escapeHtml(user.id)}">
        <div class="admin-user-info">
          <span class="admin-user-email">${escapeHtml(user.email || '(メールなし)')}</span>
          ${user.id === currentUser.uid ? '<span class="admin-user-badge">あなた</span>' : ''}
          <span class="admin-user-date">${user.createdAt ? user.createdAt.toLocaleDateString('ja-JP') : ''}</span>
        </div>
        ${user.id !== currentUser.uid ? `
          <button class="btn-delete-admin" data-id="${escapeHtml(user.id)}" data-email="${escapeHtml(user.email)}">削除</button>
        ` : ''}
      </div>
    `).join('');

    // 削除ボタンのイベント
    container.querySelectorAll('.btn-delete-admin').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.id;
        const email = btn.dataset.email;

        if (!confirm(`管理者 "${email}" を削除してよろしいですか？`)) return;

        btn.disabled = true;
        btn.textContent = '削除中...';

        try {
          const { deleteAdminUser } = await import('./auth.js');
          const result = await deleteAdminUser(userId);

          if (result.success) {
            showToast('管理者を削除しました', 'success');
            await loadAdminUsersData();
          } else {
            showToast(result.error || '削除に失敗しました', 'error');
          }
        } catch (error) {
          showToast('エラーが発生しました: ' + error.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = '削除';
        }
      });
    });
  } catch (error) {
    console.error('Failed to load admin users:', error);
    container.innerHTML = '<p style="color: var(--error-color);">読み込みに失敗しました</p>';
  }
}

// 会社スタッフ一覧を読み込み（会社ユーザー用）
async function loadCompanyStaffData() {
  const container = document.getElementById('company-staff-list');
  if (!container) return;

  container.innerHTML = '<div class="loading-spinner-small"></div><span>読み込み中...</span>';

  try {
    const { getCompanyUsers, getUserCompanyDomain } = await import('./auth.js');
    const companyDomain = getUserCompanyDomain();

    if (!companyDomain) {
      container.innerHTML = '<p style="color: var(--text-muted);">会社情報が見つかりません</p>';
      return;
    }

    const staffList = await getCompanyUsers(companyDomain);

    if (staffList.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted);">登録されているスタッフはいません</p>';
      return;
    }

    const currentUserId = sessionStorage.getItem('company_user_id');

    container.innerHTML = staffList.map(staff => `
      <div class="admin-user-item" data-id="${staff.id}">
        <div class="admin-user-info">
          <span class="admin-user-email">${escapeHtml(staff.name || staff.username || staff.email)}</span>
          <span class="admin-user-date" style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(staff.email)}</span>
          ${(staff.username === currentUserId || staff.email === currentUserId) ? '<span class="admin-user-badge">あなた</span>' : ''}
        </div>
        ${(staff.username !== currentUserId && staff.email !== currentUserId) ? `
          <button class="btn-delete-admin" data-id="${staff.id}" data-name="${escapeHtml(staff.name || staff.username || staff.email)}">削除</button>
        ` : ''}
      </div>
    `).join('');

    // 削除ボタンのイベント
    container.querySelectorAll('.btn-delete-admin').forEach(btn => {
      btn.addEventListener('click', async () => {
        const staffId = btn.dataset.id;
        const name = btn.dataset.name;

        if (!confirm(`スタッフ "${name}" を削除してよろしいですか？`)) return;

        btn.disabled = true;
        btn.textContent = '削除中...';

        try {
          const { deleteCompanyStaff } = await import('./auth.js');
          const result = await deleteCompanyStaff(staffId);

          if (result.success) {
            showToast('スタッフを削除しました', 'success');
            await loadCompanyStaffData();
          } else {
            showToast(result.error || '削除に失敗しました', 'error');
          }
        } catch (error) {
          showToast('エラーが発生しました: ' + error.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = '削除';
        }
      });
    });
  } catch (error) {
    console.error('Failed to load company staff:', error);
    container.innerHTML = '<p style="color: var(--error-color);">読み込みに失敗しました</p>';
  }
}

// スタッフ追加ボタンのイベント設定
function setupCompanyStaffEvents() {
  const addStaffBtn = document.getElementById('add-company-staff');
  if (addStaffBtn && !addStaffBtn.hasAttribute('data-listener-attached')) {
    addStaffBtn.setAttribute('data-listener-attached', 'true');
    addStaffBtn.addEventListener('click', async () => {
      const email = document.getElementById('staff-email')?.value?.trim();
      const name = document.getElementById('staff-name')?.value?.trim();
      const username = document.getElementById('staff-username')?.value?.trim();
      const password = document.getElementById('staff-password')?.value;

      if (!email) {
        showToast('メールアドレスを入力してください', 'error');
        return;
      }

      if (!password || password.length < 6) {
        showToast('パスワードは6文字以上で入力してください', 'error');
        return;
      }

      addStaffBtn.disabled = true;
      addStaffBtn.textContent = '追加中...';

      try {
        const { addCompanyStaff } = await import('./auth.js');
        const result = await addCompanyStaff(email, password, name, username);

        if (result.success) {
          showToast(`スタッフを追加しました: ${email}`, 'success');
          document.getElementById('staff-email').value = '';
          document.getElementById('staff-name').value = '';
          document.getElementById('staff-username').value = '';
          document.getElementById('staff-password').value = '';
          await loadCompanyStaffData();
        } else {
          showToast(result.error || '追加に失敗しました', 'error');
        }
      } catch (error) {
        showToast('エラーが発生しました: ' + error.message, 'error');
      } finally {
        addStaffBtn.disabled = false;
        addStaffBtn.textContent = 'スタッフを追加';
      }
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

  // Firestoreローダーを初期化（awaitで完了を待つ）
  JobsLoader.initFirestoreLoader().then(() => {
    // セッション確認
    if (checkSession()) {
      showDashboard();
      // Firebase認証が完了したらデータを読み込む
      document.addEventListener('authReady', async () => {
        loadDashboardData();

        // sessionStorageからの応募者通知遷移をチェック
        const pendingAppId = sessionStorage.getItem('pendingApplicationId');
        const pendingDomain = sessionStorage.getItem('pendingCompanyDomain');
        if (pendingAppId) {
          sessionStorage.removeItem('pendingApplicationId');
          sessionStorage.removeItem('pendingCompanyDomain');
          handleNavigateToApplicant(pendingAppId, pendingDomain);
        }
      }, { once: true });
      // フォールバック: 認証に時間がかかる場合は3秒後に読み込み
      setTimeout(async () => {
        if (!getIdToken()) {
          loadDashboardData();
        }
      }, 3000);
    } else {
      showLogin();
    }
  });

  // イベントバインド
  bindEvents();

  // 日付ピッカーの初期化
  initDatePicker(() => {
    // 日付変更時にダッシュボードデータを再読み込み
    loadDashboardData();
    // ページアナリティクスタブが表示中の場合は再読み込み
    const paTab = document.getElementById('page-analytics-tab');
    if (paTab && paTab.classList.contains('active')) {
      loadPageAnalyticsData();
    }
  });

  // 分析タブの初期化
  initAnalyticsTabs();

  // ページアナリティクスタブの初期化
  initPageAnalyticsTab();

  // タブ切り替え時にページアナリティクスデータを読み込み
  const pageAnalyticsTab = document.getElementById('tab-page-analytics');
  if (pageAnalyticsTab) {
    pageAnalyticsTab.addEventListener('click', () => {
      loadPageAnalyticsData();
    });
  }

  // 企業詳細セクションの初期化
  initCompanyDetailSection();
}

// グローバルにエクスポート（後方互換）
if (typeof window !== 'undefined') {
  window.AdminDashboard = {
    config,
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

  // データ移行モジュール（Firestore移行用）
  window.DataMigration = {
    migrateAllData: DataMigration.migrateAllData,
    migrateTestCompany: DataMigration.migrateTestCompany,
    migrateAllLPSettings: DataMigration.migrateAllLPSettings,
    getMigrationProgress: DataMigration.getMigrationProgress
  };
}

export default {
  initAdminDashboard,
  switchSection
};
