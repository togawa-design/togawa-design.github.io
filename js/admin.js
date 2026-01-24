// リクエコ求人ナビ - 管理者ダッシュボード

const AdminDashboard = {
  // 設定
  config: {
    // 簡易認証（本番環境では適切な認証システムに置き換えてください）
    credentials: {
      username: 'admin',
      // パスワードはハッシュ化推奨。ここではデモ用に平文
      password: 'receco2025'
    },
    sessionKey: 'rikueco_admin_session',
    gaPropertyId: 'G-E1XC94EG05',
    gaApiKey: 'AIzaSyAIC2WGg5dnvMh6TO4sivpbk4HtpYw4tbo',
    // Cloud Functions API エンドポイント（デプロイ後に設定）
    apiEndpoint: 'https://asia-northeast1-generated-area-484613-e3.cloudfunctions.net/getAnalyticsData',
    // Firebase設定
    firebaseConfig: {
      apiKey: "AIzaSyB3eXZoFkXOwnHxPvaHiWO7csmZK4KGqAQ",
      authDomain: "generated-area-484613-e3-90bd4.firebaseapp.com",
      projectId: "generated-area-484613-e3-90bd4"
    }
  },

  // 背景画像プリセット（チームワーク・働く人）
  heroImagePresets: [
    {
      id: 'teamwork-1',
      name: 'チームミーティング',
      url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1920&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&q=60'
    },
    {
      id: 'teamwork-2',
      name: 'オフィスワーク',
      url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=60'
    },
    {
      id: 'teamwork-3',
      name: 'コラボレーション',
      url: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1920&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=60'
    },
    {
      id: 'teamwork-4',
      name: 'ビジネス握手',
      url: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1920&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&q=60'
    },
    {
      id: 'teamwork-5',
      name: 'ワークショップ',
      url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1920&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&q=60'
    },
    {
      id: 'work-1',
      name: '製造ライン',
      url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=60'
    },
    {
      id: 'work-2',
      name: '倉庫作業',
      url: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1920&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&q=60'
    },
    {
      id: 'work-3',
      name: '建設現場',
      url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=60'
    },
    {
      id: 'work-4',
      name: '工場作業',
      url: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1920&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&q=60'
    },
    {
      id: 'work-5',
      name: 'チームワーク',
      url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1920&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=60'
    }
  ],

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

      // 認証状態の監視
      this.firebaseAuth.onAuthStateChanged(async (user) => {
        if (user) {
          this.currentUser = user;
          try {
            this.idToken = await user.getIdToken();
            console.log('[Admin] Firebase ID token obtained');
            // セッションがあり、トークンが取得できたらデータを再読み込み
            const session = sessionStorage.getItem(this.config.sessionKey);
            if (session) {
              this.loadDashboardData();
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
      this.loadDashboardData();
    } else {
      this.showLogin();
    }
  },

  // スプレッドシート設定
  spreadsheetConfig: {
    sheetId: '1NVIDV3OiXbNrVI7EFdRrU2Ggn8dx7Q0rSnvJ6uaWvX0',
    companySheetName: '会社一覧',
    lpSettingsSheetName: 'LP設定',
    // Google Apps Script Web App URL（デプロイ後に設定）
    gasApiUrl: localStorage.getItem('gas_api_url') || ''
  },

  // イベントバインド
  bindEvents() {
    // ログインフォーム
    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // ログアウト
    document.getElementById('logout-btn').addEventListener('click', () => {
      this.handleLogout();
    });

    // サイドバーナビゲーション
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        this.switchSection(section);
      });
    });

    // 日付範囲変更
    document.getElementById('date-range').addEventListener('change', () => {
      this.loadDashboardData();
    });

    // 更新ボタン
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.loadDashboardData();
    });

    // 企業検索
    document.getElementById('company-search').addEventListener('input', (e) => {
      this.filterCompanies(e.target.value);
    });

    // ソート変更
    document.getElementById('sort-by').addEventListener('change', () => {
      this.sortCompanies();
    });

    // 設定保存
    document.getElementById('save-settings').addEventListener('click', () => {
      this.saveSettings();
    });

    // GAS設定保存
    const saveGasSettingsBtn = document.getElementById('save-gas-settings');
    if (saveGasSettingsBtn) {
      saveGasSettingsBtn.addEventListener('click', () => {
        this.saveGasSettings();
      });
    }

    // パスワード変更
    document.getElementById('change-password').addEventListener('click', () => {
      this.changePassword();
    });

    // Googleログイン
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
      googleLoginBtn.addEventListener('click', () => {
        this.handleGoogleLogin();
      });
    }

    // 会社管理: 新規登録ボタン → 専用ページへ遷移
    const btnAddCompany = document.getElementById('btn-add-company');
    if (btnAddCompany) {
      btnAddCompany.addEventListener('click', () => {
        window.location.href = 'company-edit.html';
      });
    }

    // LP設定: 会社選択
    const lpCompanySelect = document.getElementById('lp-company-select');
    if (lpCompanySelect) {
      lpCompanySelect.addEventListener('change', (e) => {
        this.loadLPSettings(e.target.value);
      });
    }

    // LP設定: 保存ボタン
    const btnSaveLPSettings = document.getElementById('btn-save-lp-settings');
    if (btnSaveLPSettings) {
      btnSaveLPSettings.addEventListener('click', () => {
        this.saveLPSettings();
      });
    }

    // LP設定: リセットボタン
    const btnResetLPSettings = document.getElementById('btn-reset-lp-settings');
    if (btnResetLPSettings) {
      btnResetLPSettings.addEventListener('click', () => {
        const companyDomain = document.getElementById('lp-company-select').value;
        if (companyDomain) {
          this.loadLPSettings(companyDomain);
        }
      });
    }

    // LP設定: プレビューボタン
    const btnTogglePreview = document.getElementById('btn-toggle-preview');
    if (btnTogglePreview) {
      btnTogglePreview.addEventListener('click', () => {
        this.toggleLPPreview();
      });
    }

    // LP設定: プレビューを閉じる
    const btnClosePreview = document.getElementById('btn-close-preview');
    if (btnClosePreview) {
      btnClosePreview.addEventListener('click', () => {
        this.closeLPPreview();
      });
    }

    // LP設定: デバイス切り替え
    document.querySelectorAll('.preview-device-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const device = e.target.dataset.device;
        this.switchPreviewDevice(device);
      });
    });

    // LP設定: フォーム入力時にプレビュー更新
    const lpFormInputs = document.querySelectorAll('#lp-editor input, #lp-editor textarea');
    lpFormInputs.forEach(input => {
      input.addEventListener('input', () => {
        this.debouncedUpdatePreview();
      });
    });

    // LP設定: デザインパターン変更時にプレビュー更新
    document.querySelectorAll('input[name="design-pattern"]').forEach(radio => {
      radio.addEventListener('change', () => {
        this.updateLPPreview();
      });
    });

    // LP設定: セクション並び替え（ドラッグ＆ドロップ）
    this.initSectionSortable();

    // LP設定: セクション表示/非表示切り替え
    document.querySelectorAll('#lp-section-order input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.updateLPPreview();
      });
    });

    // LP設定: 編集モード切り替え
    const editModeToggle = document.getElementById('preview-edit-mode');
    if (editModeToggle) {
      editModeToggle.addEventListener('change', (e) => {
        this.togglePreviewEditMode(e.target.checked);
      });
    }

    // 会社編集モーダル: 閉じるボタン
    const companyModalClose = document.getElementById('company-modal-close');
    if (companyModalClose) {
      companyModalClose.addEventListener('click', () => {
        this.closeCompanyModal();
      });
    }

    // 会社編集モーダル: キャンセルボタン
    const companyModalCancel = document.getElementById('company-modal-cancel');
    if (companyModalCancel) {
      companyModalCancel.addEventListener('click', () => {
        this.closeCompanyModal();
      });
    }

    // 会社編集モーダル: フォーム送信
    const companyEditForm = document.getElementById('company-edit-form');
    if (companyEditForm) {
      companyEditForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveCompanyData();
      });
    }

    // 会社編集モーダル: オーバーレイクリックで閉じる
    const companyModal = document.getElementById('company-modal');
    if (companyModal) {
      companyModal.addEventListener('click', (e) => {
        if (e.target === companyModal) {
          this.closeCompanyModal();
        }
      });
    }

    // 求人管理: 新規求人作成ボタン
    const btnAddJob = document.getElementById('btn-add-job');
    if (btnAddJob) {
      btnAddJob.addEventListener('click', () => {
        this.showJobModal();
      });
    }

    // 求人管理: 閉じるボタン
    const btnCloseJobs = document.getElementById('btn-close-jobs');
    if (btnCloseJobs) {
      btnCloseJobs.addEventListener('click', () => {
        this.closeJobsArea();
      });
    }

    // 求人編集モーダル: 閉じるボタン
    const jobModalClose = document.getElementById('job-modal-close');
    if (jobModalClose) {
      jobModalClose.addEventListener('click', () => {
        this.closeJobModal();
      });
    }

    // 求人編集モーダル: キャンセルボタン
    const jobModalCancel = document.getElementById('job-modal-cancel');
    if (jobModalCancel) {
      jobModalCancel.addEventListener('click', () => {
        this.closeJobModal();
      });
    }

    // 求人編集モーダル: 削除ボタン
    const jobModalDelete = document.getElementById('job-modal-delete');
    if (jobModalDelete) {
      jobModalDelete.addEventListener('click', () => {
        this.deleteJob();
      });
    }

    // 求人編集モーダル: フォーム送信
    const jobEditForm = document.getElementById('job-edit-form');
    if (jobEditForm) {
      jobEditForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveJobData();
      });
    }

    // 求人編集モーダル: オーバーレイクリックで閉じる
    const jobModal = document.getElementById('job-modal');
    if (jobModal) {
      jobModal.addEventListener('click', (e) => {
        if (e.target === jobModal) {
          this.closeJobModal();
        }
      });
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
      this.loadDashboardData();
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
      this.loadDashboardData();
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

    // Firebase認証からもログアウト
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
    document.querySelector(`[data-section="${sectionName}"]`).parentElement.classList.add('active');

    // セクションの表示切り替え
    document.querySelectorAll('.admin-section').forEach(section => {
      section.classList.remove('active');
    });
    document.getElementById(`section-${sectionName}`).classList.add('active');

    // タイトル更新
    const titles = {
      overview: '概要',
      companies: '企業別データ',
      'company-manage': '会社管理',
      'lp-settings': 'LP設定',
      applications: '応募データ',
      settings: '設定'
    };
    document.getElementById('page-title').textContent = titles[sectionName];

    // 会社管理セクションに切り替えた場合はデータを読み込む
    if (sectionName === 'company-manage') {
      this.loadCompanyManageData();
    }

    // LP設定セクションに切り替えた場合は会社リストを読み込む
    if (sectionName === 'lp-settings') {
      this.loadCompanyListForLP();
      // プリセット画像をレンダリング
      this.renderHeroImagePresets();
    }
  },

  // ダッシュボードデータ読み込み
  async loadDashboardData() {
    const days = document.getElementById('date-range').value;

    // APIエンドポイントが設定されている場合はAPIから取得
    const apiEndpoint = localStorage.getItem('api_endpoint') || this.config.apiEndpoint;

    if (apiEndpoint && this.idToken) {
      // Firebase認証でログインしている場合はAPIを使用
      await this.fetchGAData(days, apiEndpoint);
    } else if (apiEndpoint && !this.idToken) {
      // 認証なしでAPIを試行（403になる可能性あり）
      try {
        await this.fetchGAData(days, apiEndpoint);
      } catch (e) {
        this.loadMockData(days);
      }
    } else {
      // デモ用モックデータ
      this.loadMockData(days);
    }
  },

  // Cloud Functions API からデータ取得
  async fetchGAData(days, apiEndpoint) {
    try {
      // ローディング表示
      this.showLoading(true);
      this.showSectionLoading(true);

      // 認証トークンを取得
      const headers = {};
      if (this.idToken) {
        headers['Authorization'] = `Bearer ${this.idToken}`;
      }

      const response = await fetch(`${apiEndpoint}?days=${days}`, { headers });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      const data = result.data;

      // 概要データを更新
      if (data.overview) {
        document.getElementById('total-pageviews').textContent = this.formatNumber(data.overview.pageViews);
        document.getElementById('total-users').textContent = this.formatNumber(data.overview.users);
        document.getElementById('company-views').textContent = this.formatNumber(data.overview.companyViews);
        document.getElementById('apply-clicks').textContent = this.formatNumber(data.overview.applyClicks);
      }

      // 日別チャートを描画
      if (data.daily) {
        this.renderDailyChartFromAPI(data.daily);
      }

      // 企業別データを描画（(not set) を除外）
      if (data.companies) {
        this.companyData = data.companies
          .filter(c => c.domain && c.domain !== '(not set)' && c.name && c.name !== '(not set)')
          .map(c => ({
            name: c.name,
            domain: c.domain,
            views: c.views,
            clicks: c.clicks,
            pattern: 'standard' // APIからはパターン情報は取れないのでデフォルト
          }));
        this.renderOverviewTable();
        this.renderCompanyCards();
      }

      // 応募データを描画
      if (data.applications) {
        this.renderApplicationsDataFromAPI(data.applications);
      }

      this.showLoading(false);

    } catch (error) {
      console.error('[Admin] API fetch error:', error);
      console.error('[Admin] idToken available:', !!this.idToken);
      this.showLoading(false);
      // エラー時はモックデータにフォールバック
      this.loadMockData(days);
    }
  },

  // ローディング表示
  showLoading(show) {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.textContent = show ? '読み込み中...' : '更新';
      refreshBtn.disabled = show;
    }
  },

  // 各セクションにローディング表示
  showSectionLoading(show) {
    const loadingHtml = '<div class="section-loading"><div class="loading-spinner"></div><span>データを読み込み中...</span></div>';

    // 概要カード
    const statCards = document.querySelectorAll('.stat-value');
    statCards.forEach(card => {
      if (show) {
        card.dataset.originalText = card.textContent;
        card.innerHTML = '<span class="loading-dots">...</span>';
      }
    });

    // チャートエリア
    const chartEl = document.getElementById('daily-chart');
    if (chartEl && show) {
      chartEl.innerHTML = loadingHtml;
    }

    // 企業別テーブル
    const tableBody = document.querySelector('.data-table tbody');
    if (tableBody && show) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;">${loadingHtml}</td></tr>`;
    }

    // 企業カード
    const companyCards = document.getElementById('company-cards');
    if (companyCards && show) {
      companyCards.innerHTML = loadingHtml;
    }

    // 応募ログテーブル
    const logTable = document.querySelector('#applications-section .data-table tbody');
    if (logTable && show) {
      logTable.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;">${loadingHtml}</td></tr>`;
    }
  },

  // API からの日別データでチャートを描画
  renderDailyChartFromAPI(dailyData) {
    const chartEl = document.getElementById('daily-chart');

    if (!dailyData || dailyData.length === 0) {
      chartEl.innerHTML = '<p>データがありません</p>';
      return;
    }

    const maxViews = Math.max(...dailyData.map(d => d.views));

    let chartHtml = '<div class="simple-chart">';
    chartHtml += '<div class="chart-bars">';

    // 表示件数を調整
    const displayData = dailyData.length > 30 ? dailyData.filter((_, i) => i % 3 === 0) : dailyData;

    displayData.forEach(d => {
      const heightPercent = maxViews > 0 ? (d.views / maxViews) * 100 : 0;
      chartHtml += `
        <div class="chart-bar-wrapper">
          <div class="chart-bar" style="height: ${heightPercent}%">
            <span class="bar-value">${d.views}</span>
          </div>
          <span class="bar-label">${d.date}</span>
        </div>
      `;
    });

    chartHtml += '</div></div>';
    chartEl.innerHTML = chartHtml;
  },

  // API からの応募データを描画
  renderApplicationsDataFromAPI(applications) {
    const tbody = document.querySelector('#applications-table tbody');

    const typeLabels = {
      apply: '応募ボタン',
      line: 'LINE相談',
      consult: '相談フォーム'
    };

    if (!applications || applications.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">応募データがありません</td></tr>';
      return;
    }

    tbody.innerHTML = applications.map(app => `
      <tr>
        <td>${app.date}</td>
        <td>${this.escapeHtml(app.company)}</td>
        <td><span class="type-badge ${app.type}">${typeLabels[app.type] || app.type}</span></td>
        <td>${app.source}</td>
      </tr>
    `).join('');
  },

  // モックデータ読み込み（デモ用）
  loadMockData(days) {
    // 概要データ
    const baseViews = days * 150;
    const baseUsers = days * 80;
    const companyViews = days * 45;
    const applyClicks = days * 12;

    document.getElementById('total-pageviews').textContent = this.formatNumber(baseViews + Math.floor(Math.random() * 500));
    document.getElementById('total-users').textContent = this.formatNumber(baseUsers + Math.floor(Math.random() * 200));
    document.getElementById('company-views').textContent = this.formatNumber(companyViews + Math.floor(Math.random() * 100));
    document.getElementById('apply-clicks').textContent = this.formatNumber(applyClicks + Math.floor(Math.random() * 30));

    // 日別チャートデータ
    this.renderDailyChart(days);

    // 企業別データ
    this.renderCompanyData();

    // 応募データ
    this.renderApplicationsData();
  },

  // 日別チャート描画
  renderDailyChart(days) {
    const chartEl = document.getElementById('daily-chart');
    const data = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      data.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        views: Math.floor(100 + Math.random() * 200),
        clicks: Math.floor(5 + Math.random() * 20)
      });
    }

    // シンプルなバーチャート（CSS/HTMLベース）
    const maxViews = Math.max(...data.map(d => d.views));

    let chartHtml = '<div class="simple-chart">';
    chartHtml += '<div class="chart-bars">';

    // 表示件数を調整（多すぎる場合は間引く）
    const displayData = days > 30 ? data.filter((_, i) => i % 3 === 0) : data;

    displayData.forEach(d => {
      const heightPercent = (d.views / maxViews) * 100;
      chartHtml += `
        <div class="chart-bar-wrapper">
          <div class="chart-bar" style="height: ${heightPercent}%">
            <span class="bar-value">${d.views}</span>
          </div>
          <span class="bar-label">${d.date}</span>
        </div>
      `;
    });

    chartHtml += '</div></div>';
    chartEl.innerHTML = chartHtml;
  },

  // 企業別データ描画
  renderCompanyData() {
    // モックデータ（実際はGAイベントから取得）
    this.companyData = [
      { name: 'トヨタ自動車', domain: 'toyota', views: 1250, clicks: 89, pattern: 'modern' },
      { name: '日産自動車', domain: 'nissan', views: 980, clicks: 67, pattern: 'classic' },
      { name: '本田技研工業', domain: 'honda', views: 856, clicks: 54, pattern: 'colorful' },
      { name: 'スバル', domain: 'subaru', views: 654, clicks: 43, pattern: 'minimal' },
      { name: 'マツダ', domain: 'mazda', views: 523, clicks: 32, pattern: 'standard' },
      { name: 'スズキ', domain: 'suzuki', views: 412, clicks: 28, pattern: 'modern' },
      { name: 'ダイハツ', domain: 'daihatsu', views: 387, clicks: 24, pattern: 'classic' },
      { name: '三菱自動車', domain: 'mitsubishi', views: 298, clicks: 18, pattern: 'standard' }
    ];

    this.renderOverviewTable();
    this.renderCompanyCards();
  },

  // 概要テーブル描画
  renderOverviewTable() {
    const tbody = document.querySelector('#overview-company-table tbody');
    const sortedData = [...this.companyData].sort((a, b) => b.views - a.views);

    tbody.innerHTML = sortedData.slice(0, 5).map((company, index) => {
      const cvr = ((company.clicks / company.views) * 100).toFixed(1);
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${this.escapeHtml(company.name)}</td>
          <td>${this.formatNumber(company.views)}</td>
          <td>${company.clicks}</td>
          <td>${cvr}%</td>
        </tr>
      `;
    }).join('');
  },

  // 企業カード描画
  renderCompanyCards() {
    const container = document.getElementById('company-cards');

    container.innerHTML = this.companyData.map(company => {
      const cvr = ((company.clicks / company.views) * 100).toFixed(1);
      const patternLabel = this.getPatternLabel(company.pattern);

      return `
        <div class="company-card" data-domain="${company.domain}" data-name="${company.name}" data-views="${company.views}" data-clicks="${company.clicks}">
          <div class="company-card-header">
            <h4>${this.escapeHtml(company.name)}</h4>
            <span class="pattern-badge ${company.pattern}">${patternLabel}</span>
          </div>
          <div class="company-card-stats">
            <div class="card-stat">
              <span class="stat-value">${this.formatNumber(company.views)}</span>
              <span class="stat-label">ページビュー</span>
            </div>
            <div class="card-stat">
              <span class="stat-value">${company.clicks}</span>
              <span class="stat-label">応募クリック</span>
            </div>
            <div class="card-stat">
              <span class="stat-value">${cvr}%</span>
              <span class="stat-label">CVR</span>
            </div>
          </div>
          <a href="company.html?c=${company.domain}" target="_blank" class="btn-view-page">ページを確認</a>
        </div>
      `;
    }).join('');
  },

  // パターンラベル取得
  getPatternLabel(pattern) {
    const labels = {
      standard: 'スタンダード',
      modern: 'モダン',
      classic: 'クラシック',
      minimal: 'ミニマル',
      colorful: 'カラフル'
    };
    return labels[pattern] || 'スタンダード';
  },

  // 企業フィルター
  filterCompanies(query) {
    const cards = document.querySelectorAll('.company-card');
    const lowerQuery = query.toLowerCase();

    cards.forEach(card => {
      const name = card.dataset.name.toLowerCase();
      const domain = card.dataset.domain.toLowerCase();

      if (name.includes(lowerQuery) || domain.includes(lowerQuery)) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  },

  // 企業ソート
  sortCompanies() {
    const sortBy = document.getElementById('sort-by').value;
    const container = document.getElementById('company-cards');
    const cards = Array.from(container.querySelectorAll('.company-card'));

    cards.sort((a, b) => {
      switch (sortBy) {
        case 'views':
          return parseInt(b.dataset.views) - parseInt(a.dataset.views);
        case 'clicks':
          return parseInt(b.dataset.clicks) - parseInt(a.dataset.clicks);
        case 'cvr':
          const cvrA = parseInt(a.dataset.clicks) / parseInt(a.dataset.views);
          const cvrB = parseInt(b.dataset.clicks) / parseInt(b.dataset.views);
          return cvrB - cvrA;
        case 'name':
          return a.dataset.name.localeCompare(b.dataset.name, 'ja');
        default:
          return 0;
      }
    });

    cards.forEach(card => container.appendChild(card));
  },

  // 応募データ描画
  renderApplicationsData() {
    const tbody = document.querySelector('#applications-table tbody');

    // モックデータ
    const applications = [
      { date: '2025/01/17 14:32', company: 'トヨタ自動車', type: 'apply', source: 'Google検索' },
      { date: '2025/01/17 13:15', company: '日産自動車', type: 'line', source: '直接アクセス' },
      { date: '2025/01/17 11:48', company: 'トヨタ自動車', type: 'apply', source: 'Yahoo検索' },
      { date: '2025/01/17 10:22', company: '本田技研工業', type: 'apply', source: '直接アクセス' },
      { date: '2025/01/16 18:45', company: 'スバル', type: 'line', source: 'Google検索' },
      { date: '2025/01/16 16:30', company: 'トヨタ自動車', type: 'apply', source: 'SNS' },
      { date: '2025/01/16 14:12', company: 'マツダ', type: 'apply', source: 'Google検索' },
      { date: '2025/01/16 11:55', company: '日産自動車', type: 'apply', source: '直接アクセス' }
    ];

    const typeLabels = {
      apply: '応募ボタン',
      line: 'LINE相談',
      consult: '相談フォーム'
    };

    tbody.innerHTML = applications.map(app => `
      <tr>
        <td>${app.date}</td>
        <td>${this.escapeHtml(app.company)}</td>
        <td><span class="type-badge ${app.type}">${typeLabels[app.type]}</span></td>
        <td>${app.source}</td>
      </tr>
    `).join('');
  },

  // 設定保存
  saveSettings() {
    const apiEndpoint = document.getElementById('api-endpoint').value.trim();

    if (apiEndpoint) {
      localStorage.setItem('api_endpoint', apiEndpoint);
    } else {
      localStorage.removeItem('api_endpoint');
    }

    alert('設定を保存しました');
    this.loadDashboardData();
  },

  // GAS設定保存
  saveGasSettings() {
    const gasApiUrl = document.getElementById('gas-api-url').value.trim();

    if (gasApiUrl) {
      localStorage.setItem('gas_api_url', gasApiUrl);
      this.spreadsheetConfig.gasApiUrl = gasApiUrl;
    } else {
      localStorage.removeItem('gas_api_url');
      this.spreadsheetConfig.gasApiUrl = '';
    }

    alert('GAS設定を保存しました。\n\n' + (gasApiUrl ? '会社情報・LP設定はスプレッドシートに直接保存されます。' : 'GAS APIが未設定のため、データはローカルストレージに保存されます。'));
  },

  // パスワード変更
  changePassword() {
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-password').value;

    if (!newPass || !confirmPass) {
      alert('パスワードを入力してください');
      return;
    }

    if (newPass !== confirmPass) {
      alert('パスワードが一致しません');
      return;
    }

    if (newPass.length < 8) {
      alert('パスワードは8文字以上で設定してください');
      return;
    }

    // 注意: 実際の本番環境ではサーバーサイドでパスワードを管理してください
    // ここではデモ用にローカルストレージに保存
    localStorage.setItem('admin_password', newPass);
    this.config.credentials.password = newPass;
    alert('パスワードを変更しました');

    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
  },

  // ユーティリティ
  formatNumber(num) {
    return num.toLocaleString();
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // ========================================
  // 会社管理機能
  // ========================================

  // 会社一覧データを読み込み
  async loadCompanyManageData() {
    const tbody = document.getElementById('company-manage-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データを読み込み中...</td></tr>';

    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetConfig.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(this.spreadsheetConfig.companySheetName)}`;
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error('データの取得に失敗しました');

      const csvText = await response.text();
      let companies = this.parseCompanyCSV(csvText);

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

      if (companies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">会社データがありません</td></tr>';
        return;
      }

      // 会社データをキャッシュ
      this.companiesCache = companies;

      // テーブルを描画
      this.renderCompanyTable();

    } catch (error) {
      console.error('会社データの読み込みエラー:', error);
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データの読み込みに失敗しました</td></tr>';
    }
  },

  // 会社CSVをパース
  parseCompanyCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = this.parseCSVLine(lines[0] || '');
    const companies = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = this.parseCSVLine(lines[i]);
      const company = {};

      headers.forEach((header, index) => {
        const key = this.normalizeHeader(header);
        company[key] = values[index] || '';
      });

      companies.push(company);
    }

    return companies;
  },

  // CSVの1行をパース
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  },

  // ヘッダー名を正規化
  normalizeHeader(header) {
    const mapping = {
      '会社名': 'company',
      'company': 'company',
      '会社ドメイン': 'companyDomain',
      'companyDomain': 'companyDomain',
      'company_domain': 'companyDomain',
      'デザインパターン': 'designPattern',
      'designPattern': 'designPattern',
      'design_pattern': 'designPattern',
      '表示する': 'showCompany',
      'showCompany': 'showCompany',
      'visible': 'showCompany',
      '画像URL': 'imageUrl',
      'imageUrl': 'imageUrl',
      'image_url': 'imageUrl',
      '説明': 'description',
      'description': 'description',
      '並び順': 'order',
      'order': 'order',
      '管理シート': 'manageSheetUrl',
      '管理シートURL': 'manageSheetUrl',
      'manageSheetUrl': 'manageSheetUrl'
    };
    const cleanHeader = header.replace(/"/g, '').trim();
    return mapping[cleanHeader] || cleanHeader;
  },

  // 会社編集ページへ遷移
  editCompany(domain) {
    window.location.href = `company-edit.html?domain=${encodeURIComponent(domain)}`;
  },

  // 新規会社登録ページへ遷移
  showCompanyModal() {
    window.location.href = 'company-edit.html';
  },

  // 会社編集モーダルを閉じる（後方互換性のために残す）
  closeCompanyModal() {
    const modal = document.getElementById('company-modal');
    if (modal) modal.style.display = 'none';
    this.currentEditingCompany = null;
    this.isNewCompany = false;
  },

  // 会社データを保存
  async saveCompanyData() {
    const companyDomain = document.getElementById('edit-company-domain').value.trim().toLowerCase();

    // CSVの列構造に合わせたデータ
    // id, company, title, location, totalBonus, monthlySalary, features, badges, imageUrl, detailUrl, visible, order, company_domain, デザインパターン, 管理シート, 表示する
    const companyData = {
      company: document.getElementById('edit-company-name').value.trim(),
      company_domain: companyDomain,
      companyDomain: companyDomain, // 互換性のため両方設定
      designPattern: document.getElementById('edit-design-pattern').value,
      imageUrl: document.getElementById('edit-image-url').value.trim(),
      order: document.getElementById('edit-order').value || '',
      description: document.getElementById('edit-description').value.trim(),
      showCompany: document.getElementById('edit-show-company').checked ? '○' : '',
      visible: document.getElementById('edit-show-company').checked ? '○' : '' // visible列用
    };

    // バリデーション
    if (!companyData.company || !companyData.companyDomain) {
      alert('会社名と会社ドメインは必須です');
      return;
    }

    // ドメインの形式チェック
    if (!/^[a-z0-9-]+$/.test(companyData.companyDomain)) {
      alert('会社ドメインは半角英数字とハイフンのみ使用できます');
      return;
    }

    // 新規登録時、重複チェック
    if (this.isNewCompany) {
      const existing = this.companiesCache?.find(c => c.companyDomain === companyData.companyDomain);
      if (existing) {
        alert('このドメインは既に使用されています');
        return;
      }
    }

    // GAS APIが設定されている場合はスプレッドシートに保存
    const gasApiUrl = this.spreadsheetConfig.gasApiUrl;
    if (gasApiUrl) {
      try {
        const saveBtn = document.getElementById('company-modal-save');
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = '保存中...';
        }

        // GASのCORS問題を回避するため、GETリクエストでデータを渡す
        const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
          action: 'saveCompany',
          company: companyData
        }))));
        const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

        const response = await fetch(url, {
          method: 'GET',
          redirect: 'follow'
        });

        const result = await response.json();

        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '保存';
        }

        if (!result.success) {
          alert('スプレッドシートへの保存に失敗しました: ' + (result.error || '不明なエラー'));
          return;
        }

        // ローカルストレージのキャッシュをクリア（スプレッドシートが正式なデータ）
        localStorage.removeItem(`company_data_${companyData.companyDomain}`);

        // キャッシュを更新
        if (this.isNewCompany) {
          if (!this.companiesCache) this.companiesCache = [];
          this.companiesCache.push(companyData);
        } else {
          const idx = this.companiesCache?.findIndex(c => c.companyDomain === companyData.companyDomain);
          if (idx !== -1) {
            this.companiesCache[idx] = companyData;
          }
        }

        // モーダルを閉じる
        this.closeCompanyModal();

        // テーブルを再描画
        this.renderCompanyTable();

        alert(`会社情報をスプレッドシートに保存しました。\n\n会社名: ${companyData.company}\nドメイン: ${companyData.companyDomain}`);

      } catch (error) {
        console.error('GAS API呼び出しエラー:', error);
        alert('スプレッドシートへの保存中にエラーが発生しました。ローカルに保存します。');
        // フォールバック: ローカルストレージに保存
        this.saveCompanyDataLocal(companyData);
      }
    } else {
      // GAS APIが設定されていない場合はローカルストレージに保存
      this.saveCompanyDataLocal(companyData);
    }
  },

  // ローカルストレージに会社データを保存（フォールバック）
  saveCompanyDataLocal(companyData) {
    const companyStorageKey = `company_data_${companyData.companyDomain}`;
    localStorage.setItem(companyStorageKey, JSON.stringify(companyData));

    // キャッシュを更新
    if (this.isNewCompany) {
      if (!this.companiesCache) this.companiesCache = [];
      this.companiesCache.push(companyData);
    } else {
      const idx = this.companiesCache?.findIndex(c => c.companyDomain === companyData.companyDomain);
      if (idx !== -1) {
        this.companiesCache[idx] = companyData;
      }
    }

    // モーダルを閉じる
    this.closeCompanyModal();

    // テーブルを再描画
    this.renderCompanyTable();

    alert(`会社情報をローカルに保存しました。\n\n注意: スプレッドシートに自動保存するには、設定画面でGAS API URLを設定してください。\n\n会社名: ${companyData.company}\nドメイン: ${companyData.companyDomain}`);
  },

  // 会社テーブルを再描画
  renderCompanyTable() {
    const tbody = document.getElementById('company-manage-tbody');
    if (!tbody) return;

    const companies = this.companiesCache || [];

    if (companies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">会社データがありません</td></tr>';
      return;
    }

    tbody.innerHTML = companies.map(company => `
      <tr data-domain="${this.escapeHtml(company.companyDomain || '')}">
        <td>${this.escapeHtml(company.company || '')}</td>
        <td><code>${this.escapeHtml(company.companyDomain || '')}</code></td>
        <td><span class="badge ${company.designPattern || 'standard'}">${this.getPatternLabel(company.designPattern || 'standard')}</span></td>
        <td>${company.showCompany === '○' || company.showCompany === '◯' ? '<span class="badge success">表示</span>' : '<span class="badge">非表示</span>'}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-small btn-edit" onclick="AdminDashboard.editCompany('${this.escapeHtml(company.companyDomain || '')}')">編集</button>
            <button class="btn-small btn-primary" onclick="AdminDashboard.openJobsArea('${this.escapeHtml(company.companyDomain || '')}')">求人管理</button>
            <a href="lp.html?c=${this.escapeHtml(company.companyDomain || '')}" target="_blank" class="btn-small btn-view">LP確認</a>
          </div>
        </td>
      </tr>
    `).join('');
  },

  // ========================================
  // LP設定機能
  // ========================================

  // LP設定用の会社リストを読み込み
  async loadCompanyListForLP() {
    const select = document.getElementById('lp-company-select');
    if (!select) return;

    // まず会社データを取得
    if (!this.companiesCache) {
      await this.loadCompanyManageData();
    }

    const companies = this.companiesCache || [];

    // 表示対象の会社のみフィルタリング
    const visibleCompanies = companies.filter(c =>
      c.companyDomain &&
      (c.showCompany === '○' || c.showCompany === '◯')
    );

    select.innerHTML = '<option value="">-- 会社を選択 --</option>' +
      visibleCompanies.map(c =>
        `<option value="${this.escapeHtml(c.companyDomain)}">${this.escapeHtml(c.company)}</option>`
      ).join('');
  },

  // LP設定を読み込み
  async loadLPSettings(companyDomain) {
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

    // ヒーロー画像プリセットをレンダリング
    this.renderHeroImagePresets();

    // 会社情報を取得
    const company = this.companiesCache?.find(c => c.companyDomain === companyDomain);
    if (company) {
      // デザインパターンを設定
      const patternRadio = document.querySelector(`input[name="design-pattern"][value="${company.designPattern || 'standard'}"]`);
      if (patternRadio) patternRadio.checked = true;
    }

    // LP設定シートから設定を取得
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetConfig.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(this.spreadsheetConfig.lpSettingsSheetName)}`;
      const response = await fetch(csvUrl);

      if (response.ok) {
        const csvText = await response.text();
        const settings = this.parseLPSettingsCSV(csvText, companyDomain);

        if (settings) {
          // フォームに設定を反映
          document.getElementById('lp-hero-title').value = settings.heroTitle || '';
          document.getElementById('lp-hero-subtitle').value = settings.heroSubtitle || '';
          document.getElementById('lp-hero-image').value = settings.heroImage || '';
          document.getElementById('lp-point-title-1').value = settings.pointTitle1 || '';
          document.getElementById('lp-point-desc-1').value = settings.pointDesc1 || '';
          document.getElementById('lp-point-title-2').value = settings.pointTitle2 || '';
          document.getElementById('lp-point-desc-2').value = settings.pointDesc2 || '';
          document.getElementById('lp-point-title-3').value = settings.pointTitle3 || '';
          document.getElementById('lp-point-desc-3').value = settings.pointDesc3 || '';
          document.getElementById('lp-cta-text').value = settings.ctaText || '今すぐ応募する';
          document.getElementById('lp-faq').value = settings.faq || '';

          // デザインパターン
          if (settings.designPattern) {
            const patternRadio = document.querySelector(`input[name="design-pattern"][value="${settings.designPattern}"]`);
            if (patternRadio) patternRadio.checked = true;
          }

          // ヒーロー画像プリセットの選択状態を更新
          this.updateHeroImagePresetSelection(settings.heroImage || '');
          return;
        }
      }
    } catch (e) {
      console.log('LP設定シートが見つかりません');
    }

    // 設定が見つからない場合はフォームをクリア
    this.clearLPForm();
  },

  // LP設定CSVをパースして特定の会社の設定を取得
  parseLPSettingsCSV(csvText, companyDomain) {
    const lines = csvText.split('\n');
    const headers = this.parseCSVLine(lines[0] || '');

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = this.parseCSVLine(lines[i]);
      const rowData = {};

      headers.forEach((header, idx) => {
        const key = header.replace(/"/g, '').trim();
        rowData[key] = values[idx] || '';
      });

      if (rowData.companyDomain === companyDomain || rowData['会社ドメイン'] === companyDomain) {
        return {
          heroTitle: rowData.heroTitle || rowData['ヒーロータイトル'] || '',
          heroSubtitle: rowData.heroSubtitle || rowData['ヒーローサブタイトル'] || '',
          heroImage: rowData.heroImage || rowData['ヒーロー画像'] || '',
          pointTitle1: rowData.pointTitle1 || rowData['ポイント1タイトル'] || '',
          pointDesc1: rowData.pointDesc1 || rowData['ポイント1説明'] || '',
          pointTitle2: rowData.pointTitle2 || rowData['ポイント2タイトル'] || '',
          pointDesc2: rowData.pointDesc2 || rowData['ポイント2説明'] || '',
          pointTitle3: rowData.pointTitle3 || rowData['ポイント3タイトル'] || '',
          pointDesc3: rowData.pointDesc3 || rowData['ポイント3説明'] || '',
          ctaText: rowData.ctaText || rowData['CTAテキスト'] || '',
          faq: rowData.faq || rowData['FAQ'] || '',
          designPattern: rowData.designPattern || rowData['デザインパターン'] || ''
        };
      }
    }
    return null;
  },

  // LP設定フォームをクリア
  clearLPForm() {
    document.getElementById('lp-hero-title').value = '';
    document.getElementById('lp-hero-subtitle').value = '';
    document.getElementById('lp-hero-image').value = '';
    document.getElementById('lp-point-title-1').value = '';
    document.getElementById('lp-point-desc-1').value = '';
    document.getElementById('lp-point-title-2').value = '';
    document.getElementById('lp-point-desc-2').value = '';
    document.getElementById('lp-point-title-3').value = '';
    document.getElementById('lp-point-desc-3').value = '';
    document.getElementById('lp-cta-text').value = '今すぐ応募する';
    document.getElementById('lp-faq').value = '';
    document.querySelector('input[name="design-pattern"][value="standard"]').checked = true;
    // プリセット画像の選択をクリア
    this.updateHeroImagePresetSelection('');
  },

  // ヒーロー画像プリセットをレンダリング
  renderHeroImagePresets() {
    const container = document.getElementById('hero-image-presets');
    if (!container) return;

    container.innerHTML = this.heroImagePresets.map(preset => `
      <div class="hero-image-preset" data-url="${this.escapeHtml(preset.url)}" title="${this.escapeHtml(preset.name)}">
        <img src="${this.escapeHtml(preset.thumbnail)}" alt="${this.escapeHtml(preset.name)}" loading="lazy">
        <span class="preset-name">${this.escapeHtml(preset.name)}</span>
        <span class="preset-check">✓</span>
      </div>
    `).join('');

    // クリックイベントを設定
    container.querySelectorAll('.hero-image-preset').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        this.selectHeroImagePreset(url);
      });
    });
  },

  // ヒーロー画像プリセットを選択
  selectHeroImagePreset(url) {
    const input = document.getElementById('lp-hero-image');
    if (input) {
      input.value = url;
      // inputイベントを発火してプレビューを更新
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // 選択状態を更新
    this.updateHeroImagePresetSelection(url);
  },

  // ヒーロー画像プリセットの選択状態を更新
  updateHeroImagePresetSelection(selectedUrl) {
    const container = document.getElementById('hero-image-presets');
    if (!container) return;

    container.querySelectorAll('.hero-image-preset').forEach(item => {
      const itemUrl = item.dataset.url;
      // URLのベース部分で比較（クエリパラメータは無視）
      const baseSelectedUrl = selectedUrl?.split('?')[0] || '';
      const baseItemUrl = itemUrl?.split('?')[0] || '';
      if (baseSelectedUrl && baseItemUrl && baseSelectedUrl === baseItemUrl) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  },

  // LP設定を保存
  async saveLPSettings() {
    const companyDomain = document.getElementById('lp-company-select').value;
    if (!companyDomain) {
      alert('会社を選択してください');
      return;
    }

    const settings = {
      companyDomain: companyDomain,
      designPattern: document.querySelector('input[name="design-pattern"]:checked')?.value || 'standard',
      heroTitle: document.getElementById('lp-hero-title').value,
      heroSubtitle: document.getElementById('lp-hero-subtitle').value,
      heroImage: document.getElementById('lp-hero-image').value,
      pointTitle1: document.getElementById('lp-point-title-1').value,
      pointDesc1: document.getElementById('lp-point-desc-1').value,
      pointTitle2: document.getElementById('lp-point-title-2').value,
      pointDesc2: document.getElementById('lp-point-desc-2').value,
      pointTitle3: document.getElementById('lp-point-title-3').value,
      pointDesc3: document.getElementById('lp-point-desc-3').value,
      ctaText: document.getElementById('lp-cta-text').value,
      faq: document.getElementById('lp-faq').value
    };

    // GAS APIが設定されている場合はスプレッドシートに保存
    const gasApiUrl = this.spreadsheetConfig.gasApiUrl;
    if (gasApiUrl) {
      try {
        const saveBtn = document.getElementById('btn-save-lp-settings');
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = '保存中...';
        }

        // GASのCORS問題を回避するため、GETリクエストでデータを渡す
        const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
          action: 'saveLPSettings',
          settings: settings
        }))));
        const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

        console.log('[LP Save] Sending request to:', url);

        const response = await fetch(url, {
          method: 'GET',
          redirect: 'follow'
        });

        // レスポンスのテキストを取得してデバッグ
        const responseText = await response.text();
        console.log('[LP Save] Response status:', response.status);
        console.log('[LP Save] Response text:', responseText);

        // JSONとしてパース
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.error('[LP Save] JSON parse error:', parseError);
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

        // ローカルストレージのキャッシュをクリア
        localStorage.removeItem(`lp_settings_${companyDomain}`);

        alert(`LP設定をスプレッドシートに保存しました。\n\n会社: ${companyDomain}\nデザインパターン: ${settings.designPattern}`);

      } catch (error) {
        console.error('GAS API呼び出しエラー:', error);
        alert('スプレッドシートへの保存中にエラーが発生しました。ローカルに保存します。');
        // フォールバック: ローカルストレージに保存
        this.saveLPSettingsLocal(settings, companyDomain);
      }
    } else {
      // GAS APIが設定されていない場合はローカルストレージに保存
      this.saveLPSettingsLocal(settings, companyDomain);
    }
  },

  // ローカルストレージにLP設定を保存（フォールバック）
  saveLPSettingsLocal(settings, companyDomain) {
    const lpSettingsKey = `lp_settings_${companyDomain}`;
    localStorage.setItem(lpSettingsKey, JSON.stringify(settings));

    alert(`LP設定をローカルに保存しました。\n\n注意: スプレッドシートに自動保存するには、設定画面でGAS API URLを設定してください。\n\n会社: ${companyDomain}\nデザインパターン: ${settings.designPattern}`);
  },

  // ========================================
  // LPプレビュー機能
  // ========================================

  // プレビュー更新のデバウンス用タイマー
  previewUpdateTimer: null,

  // デバウンス付きプレビュー更新
  debouncedUpdatePreview() {
    if (this.previewUpdateTimer) {
      clearTimeout(this.previewUpdateTimer);
    }
    this.previewUpdateTimer = setTimeout(() => {
      this.updateLPPreview();
    }, 300);
  },

  // プレビュー表示/非表示切り替え
  toggleLPPreview() {
    const container = document.getElementById('lp-preview-container');
    const btn = document.getElementById('btn-toggle-preview');

    if (!container) return;

    if (container.style.display === 'none') {
      container.style.display = 'flex';
      if (btn) btn.textContent = 'プレビューを隠す';
      this.updateLPPreview();
    } else {
      container.style.display = 'none';
      if (btn) btn.textContent = 'プレビュー表示';
    }
  },

  // プレビューを閉じる
  closeLPPreview() {
    const container = document.getElementById('lp-preview-container');
    const btn = document.getElementById('btn-toggle-preview');

    if (container) container.style.display = 'none';
    if (btn) btn.textContent = 'プレビュー表示';
  },

  // デバイス切り替え
  switchPreviewDevice(device) {
    const wrapper = document.querySelector('.lp-preview-frame-wrapper');
    const buttons = document.querySelectorAll('.preview-device-btn');

    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.device === device);
    });

    if (wrapper) {
      wrapper.setAttribute('data-device', device);
    }
  },

  // LPプレビューを更新
  updateLPPreview() {
    const container = document.getElementById('lp-preview-container');
    const iframe = document.getElementById('lp-preview-frame');
    const companyDomain = document.getElementById('lp-company-select')?.value;

    // プレビューが非表示または会社未選択の場合はスキップ
    if (!container || container.style.display === 'none' || !iframe || !companyDomain) {
      return;
    }

    // 現在のフォーム値を取得
    const settings = this.getCurrentLPSettings();
    const company = this.companiesCache?.find(c => c.companyDomain === companyDomain) || {
      company: companyDomain,
      companyDomain: companyDomain
    };

    // プレビュー用HTMLを生成
    const previewHtml = this.generatePreviewHTML(company, settings);

    // iframe に書き込み
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(previewHtml);
    iframeDoc.close();
  },

  // 現在のLP設定フォーム値を取得
  getCurrentLPSettings() {
    return {
      designPattern: document.querySelector('input[name="design-pattern"]:checked')?.value || 'standard',
      heroTitle: document.getElementById('lp-hero-title')?.value || '',
      heroSubtitle: document.getElementById('lp-hero-subtitle')?.value || '',
      heroImage: document.getElementById('lp-hero-image')?.value || '',
      pointTitle1: document.getElementById('lp-point-title-1')?.value || '',
      pointDesc1: document.getElementById('lp-point-desc-1')?.value || '',
      pointTitle2: document.getElementById('lp-point-title-2')?.value || '',
      pointDesc2: document.getElementById('lp-point-desc-2')?.value || '',
      pointTitle3: document.getElementById('lp-point-title-3')?.value || '',
      pointDesc3: document.getElementById('lp-point-desc-3')?.value || '',
      ctaText: document.getElementById('lp-cta-text')?.value || '今すぐ応募する',
      faq: document.getElementById('lp-faq')?.value || ''
    };
  },

  // プレビュー用HTMLを生成
  generatePreviewHTML(company, settings) {
    const pattern = settings.designPattern || 'standard';
    const heroTitle = settings.heroTitle || `${company.company}で働こう`;
    const heroSubtitle = settings.heroSubtitle || '';
    const heroImage = settings.heroImage || '';
    const ctaText = settings.ctaText || '今すぐ応募する';
    const isEditMode = document.getElementById('preview-edit-mode')?.checked || false;

    // ポイントを収集
    const points = [];
    if (settings.pointTitle1) {
      points.push({ title: settings.pointTitle1, desc: settings.pointDesc1 || '' });
    }
    if (settings.pointTitle2) {
      points.push({ title: settings.pointTitle2, desc: settings.pointDesc2 || '' });
    }
    if (settings.pointTitle3) {
      points.push({ title: settings.pointTitle3, desc: settings.pointDesc3 || '' });
    }

    // FAQをパース
    const faqs = settings.faq ? settings.faq.split('||').map(item => {
      const parts = item.split('|');
      const q = parts.find(p => p.startsWith('Q:'))?.replace('Q:', '').trim() || '';
      const a = parts.find(p => p.startsWith('A:'))?.replace('A:', '').trim() || '';
      return { q, a };
    }).filter(f => f.q && f.a) : [];

    // セクションの順番と表示状態を取得
    const sectionOrder = this.getSectionOrder();
    const sectionVisibility = this.getSectionVisibility();

    // 各セクションのHTMLを生成
    const sections = {
      hero: `
        <section class="lp-hero preview-section" data-section="hero">
          ${isEditMode ? '<div class="section-edit-overlay"><span class="section-label">ヒーロー</span></div>' : ''}
          ${heroImage ? `<div class="lp-hero-bg" style="background-image: url('${this.escapeHtml(heroImage)}')"></div>` : '<div class="lp-hero-bg"></div>'}
          <div class="lp-hero-overlay"></div>
          <div class="lp-hero-content">
            <p class="lp-hero-company">${this.escapeHtml(company.company)}</p>
            <h1 class="lp-hero-title">${this.escapeHtml(heroTitle)}</h1>
            ${heroSubtitle ? `<p class="lp-hero-subtitle">${this.escapeHtml(heroSubtitle)}</p>` : ''}
            <div class="lp-hero-cta">
              <a href="#" class="lp-btn-apply-hero">${this.escapeHtml(ctaText)}</a>
            </div>
          </div>
        </section>`,

      points: points.length > 0 && sectionVisibility.points ? `
        <section class="lp-points preview-section" data-section="points">
          ${isEditMode ? '<div class="section-edit-overlay"><span class="section-label">ポイント</span><button class="section-edit-btn" onclick="parent.AdminDashboard.focusSection(\'points\')">編集</button></div>' : ''}
          <div class="lp-section-inner">
            <h2 class="lp-section-title">この求人のポイント</h2>
            <div class="lp-points-grid">
              ${points.map((point, idx) => `
                <div class="lp-point-card">
                  <div class="lp-point-number">${idx + 1}</div>
                  <h3 class="lp-point-title">${this.escapeHtml(point.title)}</h3>
                  <p class="lp-point-desc">${this.escapeHtml(point.desc)}</p>
                </div>
              `).join('')}
            </div>
          </div>
        </section>` : '',

      jobs: sectionVisibility.jobs ? `
        <section class="lp-jobs preview-section" data-section="jobs">
          ${isEditMode ? '<div class="section-edit-overlay"><span class="section-label">求人一覧</span><span class="section-note">実際のデータから表示</span></div>' : ''}
          <div class="lp-section-inner">
            <h2 class="lp-section-title">募集中の求人</h2>
            <div class="lp-jobs-list">
              <div class="lp-job-card" style="opacity: 0.5;">
                <div class="lp-job-card-header"><h3 class="lp-job-title">求人データはスプレッドシートから読み込まれます</h3></div>
                <div class="lp-job-card-body"><p>プレビューでは表示されません</p></div>
              </div>
            </div>
          </div>
        </section>` : '',

      details: sectionVisibility.details ? `
        <section class="lp-details preview-section" data-section="details">
          ${isEditMode ? '<div class="section-edit-overlay"><span class="section-label">募集要項</span><span class="section-note">実際のデータから表示</span></div>' : ''}
          <div class="lp-section-inner">
            <h2 class="lp-section-title">募集要項</h2>
            <div class="lp-details-table">
              <div class="lp-detail-row"><div class="lp-detail-label">仕事内容</div><div class="lp-detail-value" style="opacity: 0.5;">スプレッドシートから読み込み</div></div>
              <div class="lp-detail-row"><div class="lp-detail-label">勤務地</div><div class="lp-detail-value" style="opacity: 0.5;">スプレッドシートから読み込み</div></div>
            </div>
          </div>
        </section>` : '',

      faq: faqs.length > 0 && sectionVisibility.faq ? `
        <section class="lp-faq preview-section" data-section="faq">
          ${isEditMode ? '<div class="section-edit-overlay"><span class="section-label">FAQ</span><button class="section-edit-btn" onclick="parent.AdminDashboard.focusSection(\'faq\')">編集</button></div>' : ''}
          <div class="lp-section-inner">
            <h2 class="lp-section-title">よくある質問</h2>
            <div class="lp-faq-list">
              ${faqs.map(faq => `
                <div class="lp-faq-item">
                  <div class="lp-faq-question">
                    <span class="lp-faq-icon">Q</span>
                    <span>${this.escapeHtml(faq.q)}</span>
                  </div>
                  <div class="lp-faq-answer">
                    <span class="lp-faq-icon">A</span>
                    <span>${this.escapeHtml(faq.a)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </section>` : '',

      apply: `
        <section class="lp-apply preview-section" id="lp-apply" data-section="apply">
          ${isEditMode ? '<div class="section-edit-overlay"><span class="section-label">応募</span><button class="section-edit-btn" onclick="parent.AdminDashboard.focusSection(\'cta\')">編集</button></div>' : ''}
          <div class="lp-section-inner">
            <h2 class="lp-apply-title">まずはお気軽にご応募ください</h2>
            <p class="lp-apply-text">経験・学歴不問！${this.escapeHtml(company.company)}であなたのご応募をお待ちしています。</p>
            <div class="lp-apply-buttons">
              <a href="#" class="lp-btn-apply-main">${this.escapeHtml(ctaText)}</a>
              <a href="#" class="lp-btn-tel-main">
                <span class="tel-number">0120-000-000</span>
                <span class="tel-note">（平日9:00〜18:00）</span>
              </a>
            </div>
          </div>
        </section>`
    };

    // セクションを順番に並べる
    const orderedSections = sectionOrder.map(s => sections[s] || '').join('');

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>プレビュー</title>
  <link rel="stylesheet" href="css/style.min.css">
  <link rel="stylesheet" href="css/lp.css">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; }
    .lp-hero { min-height: 50vh; }
    .preview-note {
      background: #fef3c7;
      color: #92400e;
      padding: 8px 16px;
      text-align: center;
      font-size: 12px;
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    /* 編集モードスタイル */
    .edit-mode .preview-section {
      position: relative;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .edit-mode .preview-section:hover {
      outline: 3px solid #6366f1;
      outline-offset: -3px;
    }
    .section-edit-overlay {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(99, 102, 241, 0.95);
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 100;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .section-label {
      font-weight: 600;
    }
    .section-note {
      opacity: 0.8;
      font-size: 11px;
    }
    .section-edit-btn {
      background: white;
      color: #6366f1;
      border: none;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 600;
    }
    .section-edit-btn:hover {
      background: #f0f0ff;
    }
  </style>
</head>
<body class="lp-body lp-pattern-${this.escapeHtml(pattern)}${isEditMode ? ' edit-mode' : ''}">
  <div class="preview-note">${isEditMode ? '編集モード - セクションをクリックして編集' : 'プレビューモード'}</div>
  ${orderedSections}
</body>
</html>`;
  },

  // セクションの順番を取得
  getSectionOrder() {
    const orderList = document.getElementById('lp-section-order');
    if (!orderList) {
      return ['hero', 'points', 'jobs', 'details', 'faq', 'apply'];
    }
    return Array.from(orderList.querySelectorAll('li')).map(li => li.dataset.section);
  },

  // セクションの表示状態を取得
  getSectionVisibility() {
    return {
      points: document.getElementById('section-points-visible')?.checked ?? true,
      jobs: document.getElementById('section-jobs-visible')?.checked ?? true,
      details: document.getElementById('section-details-visible')?.checked ?? true,
      faq: document.getElementById('section-faq-visible')?.checked ?? true
    };
  },

  // セクション並び替え（ドラッグ＆ドロップ）の初期化
  initSectionSortable() {
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
        this.updateLPPreview();
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const afterElement = this.getDragAfterElement(list, e.clientY);
        if (afterElement == null) {
          list.appendChild(draggedItem);
        } else {
          list.insertBefore(draggedItem, afterElement);
        }
      });
    });
  },

  // ドラッグ位置から挿入先を取得
  getDragAfterElement(container, y) {
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
  },

  // 編集モード切り替え
  togglePreviewEditMode(enabled) {
    this.updateLPPreview();
  },

  // セクションにフォーカス
  focusSection(sectionType) {
    const elementMap = {
      'points': 'lp-point-title-1',
      'faq': 'lp-faq',
      'cta': 'lp-cta-text',
      'hero': 'lp-hero-title'
    };
    const elementId = elementMap[sectionType];
    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
    }
  },

  // ========================================
  // 求人管理機能
  // ========================================

  // 現在選択中の会社ドメインと求人データ
  currentJobCompanyDomain: null,
  currentJobSheetUrl: null,
  jobsCache: [],
  currentEditingJob: null,
  isNewJob: false,

  // 求人管理画面を開く（新しい画面に遷移）
  openJobsArea(companyDomain) {
    // 会社情報を取得
    const company = this.companiesCache?.find(c => c.companyDomain === companyDomain);
    if (!company) {
      alert('会社情報が見つかりません');
      return;
    }

    // URLパラメータを構築
    const params = new URLSearchParams();
    params.set('domain', companyDomain);
    params.set('company', company.company || companyDomain);
    if (company.manageSheetUrl) {
      params.set('sheetUrl', company.manageSheetUrl);
    }

    // 新しい画面に遷移
    window.location.href = `job-manage.html?${params.toString()}`;
  },

  // 求人管理エリアを閉じる
  closeJobsArea() {
    const area = document.getElementById('jobs-manage-area');
    if (area) {
      area.style.display = 'none';
    }
    this.currentJobCompanyDomain = null;
    this.currentJobSheetUrl = null;
    this.jobsCache = [];
  },

  // 求人データを読み込み（GAS API経由で管理シートから取得）
  async loadJobsData(companyDomain) {
    const tbody = document.getElementById('jobs-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データを読み込み中...</td></tr>';

    // 会社の管理シートURLを取得
    const company = this.companiesCache?.find(c => c.companyDomain === companyDomain);
    console.log('[loadJobsData] companyDomain:', companyDomain);
    console.log('[loadJobsData] company:', company);
    console.log('[loadJobsData] manageSheetUrl:', company?.manageSheetUrl);

    if (!company || !company.manageSheetUrl) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">管理シートが設定されていません</td></tr>';
      return;
    }

    try {
      // GAS API経由で求人データを取得
      const gasApiUrl = this.spreadsheetConfig.gasApiUrl;
      console.log('[loadJobsData] gasApiUrl:', gasApiUrl);
      if (!gasApiUrl) {
        throw new Error('GAS API URLが設定されていません');
      }
      const url = `${gasApiUrl}?action=getJobs&domain=${encodeURIComponent(companyDomain)}`;
      console.log('[loadJobsData] request URL:', url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('データの取得に失敗しました');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '求人データの取得に失敗しました');
      }

      this.jobsCache = result.jobs || [];

      if (this.jobsCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">求人データがありません</td></tr>';
        return;
      }

      this.renderJobsTable();

    } catch (error) {
      console.error('求人データの読み込みエラー:', error);
      tbody.innerHTML = `<tr><td colspan="6" class="loading-cell">データの読み込みに失敗しました: ${this.escapeHtml(error.message)}</td></tr>`;
    }
  },

  // 求人CSVをパース
  parseJobsCSV(csvText) {
    const lines = csvText.split('\n');
    if (lines.length < 3) return []; // ヘッダー2行 + データ

    // 1行目が英語ヘッダー、2行目が日本語説明
    const headers = this.parseCSVLine(lines[0] || '');
    const jobs = [];

    for (let i = 2; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = this.parseCSVLine(lines[i]);
      const job = { _rowIndex: i + 1 }; // スプレッドシート上の行番号（1始まり）

      headers.forEach((header, index) => {
        const key = header.replace(/"/g, '').trim();
        job[key] = values[index] || '';
      });

      // IDがあるデータのみ追加
      if (job.id || job.title) {
        jobs.push(job);
      }
    }

    return jobs;
  },

  // 求人テーブルを描画
  renderJobsTable() {
    const tbody = document.getElementById('jobs-tbody');
    if (!tbody) return;

    const jobs = this.jobsCache || [];

    if (jobs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">求人データがありません</td></tr>';
      return;
    }

    tbody.innerHTML = jobs.map(job => {
      const salary = job.monthlySalary ? `¥${Number(job.monthlySalary).toLocaleString()}` : '-';
      const isVisible = job.visible === 'true' || job.visible === 'TRUE' || job.visible === true;

      return `
        <tr data-row="${job._rowIndex}">
          <td>${this.escapeHtml(job.id || '-')}</td>
          <td>${this.escapeHtml(job.title || '-')}</td>
          <td>${this.escapeHtml(job.location || '-')}</td>
          <td>${salary}</td>
          <td>${isVisible ? '<span class="badge success">公開</span>' : '<span class="badge">非公開</span>'}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-small btn-edit" onclick="AdminDashboard.editJob(${job._rowIndex})">編集</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // 求人編集モーダルを表示（新規）
  showJobModal() {
    this.currentEditingJob = null;
    this.isNewJob = true;

    // フォームをクリア
    document.getElementById('job-modal-title').textContent = '新規求人作成';
    document.getElementById('edit-job-title').value = '';
    document.getElementById('edit-job-location').value = '';
    document.getElementById('edit-job-salary').value = '';
    document.getElementById('edit-job-bonus').value = '';
    document.getElementById('edit-job-order').value = '';
    document.getElementById('edit-job-features').value = '';
    document.getElementById('edit-job-badges').value = '';
    document.getElementById('edit-job-description').value = '';
    document.getElementById('edit-job-requirements').value = '';
    document.getElementById('edit-job-benefits').value = '';
    document.getElementById('edit-job-hours').value = '';
    document.getElementById('edit-job-holidays').value = '';
    document.getElementById('edit-job-start-date').value = '';
    document.getElementById('edit-job-end-date').value = '';
    document.getElementById('edit-job-visible').checked = true;

    // 削除ボタンを非表示
    document.getElementById('job-modal-delete').style.display = 'none';

    // モーダルを表示
    document.getElementById('job-modal').style.display = 'flex';
  },

  // 求人編集モーダルを表示（編集）
  editJob(rowIndex) {
    const job = this.jobsCache?.find(j => j._rowIndex === rowIndex);
    if (!job) {
      alert('求人データが見つかりません');
      return;
    }

    this.currentEditingJob = job;
    this.isNewJob = false;

    // フォームに既存データを設定
    document.getElementById('job-modal-title').textContent = '求人情報の編集';
    document.getElementById('edit-job-title').value = job.title || '';
    document.getElementById('edit-job-location').value = job.location || '';
    document.getElementById('edit-job-salary').value = job.monthlySalary || '';
    document.getElementById('edit-job-bonus').value = job.totalBonus || '';
    document.getElementById('edit-job-order').value = job.order || '';
    document.getElementById('edit-job-features').value = job.features || '';
    document.getElementById('edit-job-badges').value = job.badges || '';
    document.getElementById('edit-job-description').value = job.jobDescription || '';
    document.getElementById('edit-job-requirements').value = job.requirements || '';
    document.getElementById('edit-job-benefits').value = job.benefits || '';
    document.getElementById('edit-job-hours').value = job.workingHours || '';
    document.getElementById('edit-job-holidays').value = job.holidays || '';

    // 日付
    if (job.publishStartDate) {
      const startDate = this.formatDateForInput(job.publishStartDate);
      document.getElementById('edit-job-start-date').value = startDate;
    } else {
      document.getElementById('edit-job-start-date').value = '';
    }
    if (job.publishEndDate) {
      const endDate = this.formatDateForInput(job.publishEndDate);
      document.getElementById('edit-job-end-date').value = endDate;
    } else {
      document.getElementById('edit-job-end-date').value = '';
    }

    document.getElementById('edit-job-visible').checked = job.visible === 'true' || job.visible === 'TRUE' || job.visible === true;

    // 削除ボタンを表示
    document.getElementById('job-modal-delete').style.display = '';

    // モーダルを表示
    document.getElementById('job-modal').style.display = 'flex';
  },

  // 日付をinput[type="date"]用にフォーマット
  formatDateForInput(dateStr) {
    if (!dateStr) return '';
    // 様々な形式に対応
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 求人編集モーダルを閉じる
  closeJobModal() {
    document.getElementById('job-modal').style.display = 'none';
    this.currentEditingJob = null;
    this.isNewJob = false;
  },

  // 求人データを保存
  async saveJobData() {
    if (!this.currentJobCompanyDomain) {
      alert('会社が選択されていません');
      return;
    }

    const jobData = {
      title: document.getElementById('edit-job-title').value.trim(),
      location: document.getElementById('edit-job-location').value.trim(),
      monthlySalary: document.getElementById('edit-job-salary').value || '',
      totalBonus: document.getElementById('edit-job-bonus').value || '',
      order: document.getElementById('edit-job-order').value || '',
      features: document.getElementById('edit-job-features').value.trim(),
      badges: document.getElementById('edit-job-badges').value.trim(),
      jobDescription: document.getElementById('edit-job-description').value.trim(),
      requirements: document.getElementById('edit-job-requirements').value.trim(),
      benefits: document.getElementById('edit-job-benefits').value.trim(),
      workingHours: document.getElementById('edit-job-hours').value.trim(),
      holidays: document.getElementById('edit-job-holidays').value.trim(),
      publishStartDate: document.getElementById('edit-job-start-date').value || '',
      publishEndDate: document.getElementById('edit-job-end-date').value || '',
      visible: document.getElementById('edit-job-visible').checked ? 'true' : 'false'
    };

    // バリデーション
    if (!jobData.title || !jobData.location) {
      alert('募集タイトルと勤務地は必須です');
      return;
    }

    // GAS APIで保存
    const gasApiUrl = this.spreadsheetConfig.gasApiUrl;
    if (!gasApiUrl) {
      alert('GAS API URLが設定されていません。設定画面でURLを設定してください。');
      return;
    }

    try {
      const saveBtn = document.getElementById('job-modal-save');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
      }

      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
        action: 'saveJob',
        companyDomain: this.currentJobCompanyDomain,
        job: jobData,
        rowIndex: this.isNewJob ? null : this.currentEditingJob._rowIndex
      }))));
      const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow'
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '保存';
        }
        throw new Error(`GASからの応答が不正です: ${responseText.substring(0, 200)}`);
      }

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存';
      }

      if (!result.success) {
        alert('保存に失敗しました: ' + (result.error || '不明なエラー'));
        return;
      }

      // モーダルを閉じる
      this.closeJobModal();

      // 求人データを再読み込み
      await this.loadJobsData(this.currentJobCompanyDomain);

      alert(this.isNewJob ? '求人を作成しました' : '求人情報を更新しました');

    } catch (error) {
      console.error('求人保存エラー:', error);
      alert('保存中にエラーが発生しました: ' + error.message);
    }
  },

  // 求人を削除
  async deleteJob() {
    if (!this.currentEditingJob || !this.currentJobCompanyDomain) {
      alert('削除対象が選択されていません');
      return;
    }

    if (!confirm('この求人を削除してもよろしいですか？')) {
      return;
    }

    const gasApiUrl = this.spreadsheetConfig.gasApiUrl;
    if (!gasApiUrl) {
      alert('GAS API URLが設定されていません');
      return;
    }

    try {
      const deleteBtn = document.getElementById('job-modal-delete');
      if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = '削除中...';
      }

      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
        action: 'deleteJob',
        companyDomain: this.currentJobCompanyDomain,
        rowIndex: this.currentEditingJob._rowIndex
      }))));
      const url = `${gasApiUrl}?action=post&data=${encodeURIComponent(payload)}`;

      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow'
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        if (deleteBtn) {
          deleteBtn.disabled = false;
          deleteBtn.textContent = '削除';
        }
        throw new Error(`GASからの応答が不正です`);
      }

      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = '削除';
      }

      if (!result.success) {
        alert('削除に失敗しました: ' + (result.error || '不明なエラー'));
        return;
      }

      // モーダルを閉じる
      this.closeJobModal();

      // 求人データを再読み込み
      await this.loadJobsData(this.currentJobCompanyDomain);

      alert('求人を削除しました');

    } catch (error) {
      console.error('求人削除エラー:', error);
      alert('削除中にエラーが発生しました: ' + error.message);
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
