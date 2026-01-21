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
      applications: '応募データ',
      settings: '設定'
    };
    document.getElementById('page-title').textContent = titles[sectionName];
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

  AdminDashboard.init();
});
