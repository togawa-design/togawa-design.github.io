/**
 * リクエコ求人ナビ - 管理者ダッシュボード（コア）
 *
 * 認証・初期化・ナビゲーションを担当
 *
 * モジュール構成:
 * - admin.js (このファイル): コア機能
 * - admin-analytics.js: アナリティクス関連
 * - admin-company.js: 会社管理・LP設定・求人管理
 * - admin-settings.js: システム設定
 */

const AdminDashboard = {
  // 設定
  config: {
    credentials: {
      username: 'admin',
      password: 'receco2025'
    },
    sessionKey: 'rikueco_admin_session',
    gaPropertyId: 'G-E1XC94EG05',
    gaApiKey: 'AIzaSyAIC2WGg5dnvMh6TO4sivpbk4HtpYw4tbo',
    apiEndpoint: 'https://asia-northeast1-generated-area-484613-e3.cloudfunctions.net/getAnalyticsData',
    firebaseConfig: {
      apiKey: "AIzaSyB3eXZoFkXOwnHxPvaHiWO7csmZK4KGqAQ",
      authDomain: "generated-area-484613-e3-90bd4.firebaseapp.com",
      projectId: "generated-area-484613-e3-90bd4"
    }
  },

  // スプレッドシート設定
  spreadsheetConfig: {
    sheetId: '1NVIDV3OiXbNrVI7EFdRrU2Ggn8dx7Q0rSnvJ6uaWvX0',
    companySheetName: '会社一覧',
    lpSettingsSheetName: 'LP設定',
    gasApiUrl: localStorage.getItem('gas_api_url') || ''
  },

  // Firebase認証関連
  firebaseAuth: null,
  currentUser: null,
  idToken: null,

  // 初期化
  init() {
    this.initFirebase();
    this.checkSession();
    this.bindEvents();
  },

  // Firebase初期化
  initFirebase() {
    if (typeof firebase !== 'undefined') {
      firebase.initializeApp(this.config.firebaseConfig);
      this.firebaseAuth = firebase.auth();

      this.firebaseAuth.onAuthStateChanged(async (user) => {
        if (user) {
          this.currentUser = user;
          try {
            this.idToken = await user.getIdToken();
            console.log('[Admin] Firebase ID token obtained');
            const session = sessionStorage.getItem(this.config.sessionKey);
            if (session) {
              AdminAnalytics.loadDashboardData();
            }
          } catch (e) {
            console.error('[Admin] Failed to get ID token:', e);
          }
        } else {
          this.currentUser = null;
          this.idToken = null;
        }
      });
    }
  },

  // セッション確認
  checkSession() {
    const session = sessionStorage.getItem(this.config.sessionKey);
    if (session) {
      this.showDashboard();
      AdminAnalytics.loadDashboardData();
    } else {
      this.showLogin();
    }
  },

  // イベントバインド
  bindEvents() {
    // ログインフォーム
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // ログアウト
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // サイドバーナビゲーション
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        this.switchSection(section);
      });
    });

    // 日付範囲変更
    const dateRange = document.getElementById('date-range');
    if (dateRange) {
      dateRange.addEventListener('change', () => AdminAnalytics.loadDashboardData());
    }

    // 更新ボタン
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => AdminAnalytics.loadDashboardData());
    }

    // 企業検索
    const companySearch = document.getElementById('company-search');
    if (companySearch) {
      companySearch.addEventListener('input', (e) => AdminAnalytics.filterCompanies(e.target.value));
    }

    // ソート変更
    const sortBy = document.getElementById('sort-by');
    if (sortBy) {
      sortBy.addEventListener('change', () => AdminAnalytics.sortCompanies());
    }

    // Googleログイン
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
      googleLoginBtn.addEventListener('click', () => this.handleGoogleLogin());
    }

    // 各モジュールのイベントバインド
    if (typeof AdminSettings !== 'undefined') {
      AdminSettings.bindEvents();
    }
    if (typeof AdminCompany !== 'undefined') {
      AdminCompany.bindEvents();
    }
  },

  // ログイン処理
  handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');

    if (username === this.config.credentials.username &&
        password === this.config.credentials.password) {
      sessionStorage.setItem(this.config.sessionKey, 'authenticated');
      errorEl.style.display = 'none';
      this.showDashboard();
      AdminAnalytics.loadDashboardData();
    } else {
      errorEl.textContent = 'ユーザー名またはパスワードが正しくありません';
      errorEl.style.display = 'block';
    }
  },

  // Googleログイン処理
  async handleGoogleLogin() {
    if (!this.firebaseAuth) {
      alert('Firebase認証が初期化されていません');
      return;
    }

    const errorEl = document.getElementById('login-error');
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await this.firebaseAuth.signInWithPopup(provider);
      this.currentUser = result.user;
      this.idToken = await result.user.getIdToken();

      sessionStorage.setItem(this.config.sessionKey, 'authenticated');
      sessionStorage.setItem('auth_method', 'google');
      errorEl.style.display = 'none';
      this.showDashboard();
      AdminAnalytics.loadDashboardData();
    } catch (error) {
      console.error('Google login error:', error);
      errorEl.textContent = 'Googleログインに失敗しました: ' + error.message;
      errorEl.style.display = 'block';
    }
  },

  // ログアウト処理
  handleLogout() {
    sessionStorage.removeItem(this.config.sessionKey);
    sessionStorage.removeItem('auth_method');

    if (this.firebaseAuth) {
      this.firebaseAuth.signOut();
    }

    this.showLogin();
  },

  // ログイン画面表示
  showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-dashboard').style.display = 'none';
  },

  // ダッシュボード表示
  showDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'flex';
  },

  // セクション切り替え
  switchSection(sectionName) {
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
      settings: '設定'
    };
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
      pageTitle.textContent = titles[sectionName] || sectionName;
    }

    // 会社管理セクションに切り替えた場合はデータを読み込む
    if (sectionName === 'company-manage' && typeof AdminCompany !== 'undefined') {
      AdminCompany.loadCompanyManageData();
    }

    // LP設定セクションに切り替えた場合は会社リストを読み込む
    if (sectionName === 'lp-settings' && typeof AdminCompany !== 'undefined') {
      AdminCompany.loadCompanyListForLP();
      AdminCompany.renderHeroImagePresets();
    }
  }
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  // ローカルストレージからパスワードを復元
  const savedPassword = localStorage.getItem('admin_password');
  if (savedPassword) {
    AdminDashboard.config.credentials.password = savedPassword;
  }

  // 設定画面のAPIエンドポイント入力欄に現在の値を表示
  const apiEndpointInput = document.getElementById('api-endpoint');
  if (apiEndpointInput) {
    apiEndpointInput.value = localStorage.getItem('api_endpoint') || '';
  }

  // GAS API URLの入力欄に現在の値を表示
  const gasApiUrlInput = document.getElementById('gas-api-url');
  if (gasApiUrlInput) {
    gasApiUrlInput.value = localStorage.getItem('gas_api_url') || '';
  }

  // GAS API URLをconfigに設定
  AdminDashboard.spreadsheetConfig.gasApiUrl = localStorage.getItem('gas_api_url') || '';

  AdminDashboard.init();
});
