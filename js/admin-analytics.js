/**
 * リクエコ求人ナビ - 管理画面：アナリティクスモジュール
 * 概要・企業別データ・応募データの表示を担当
 */

const AdminAnalytics = {
  // 企業データキャッシュ
  companyData: [],

  // ダッシュボードデータ読み込み
  async loadDashboardData() {
    const days = document.getElementById('date-range')?.value || 7;
    const apiEndpoint = localStorage.getItem('api_endpoint') || AdminDashboard.config.apiEndpoint;

    if (apiEndpoint && AdminDashboard.idToken) {
      await this.fetchGAData(days, apiEndpoint);
    } else if (apiEndpoint && !AdminDashboard.idToken) {
      try {
        await this.fetchGAData(days, apiEndpoint);
      } catch (e) {
        this.loadMockData(days);
      }
    } else {
      this.loadMockData(days);
    }
  },

  // Cloud Functions API からデータ取得
  async fetchGAData(days, apiEndpoint) {
    try {
      this.showLoading(true);
      this.showSectionLoading(true);

      const headers = {};
      if (AdminDashboard.idToken) {
        headers['Authorization'] = `Bearer ${AdminDashboard.idToken}`;
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
        document.getElementById('total-pageviews').textContent = Utils.formatNumber(data.overview.pageViews);
        document.getElementById('total-users').textContent = Utils.formatNumber(data.overview.users);
        document.getElementById('company-views').textContent = Utils.formatNumber(data.overview.companyViews);
        document.getElementById('apply-clicks').textContent = Utils.formatNumber(data.overview.applyClicks);
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
            pattern: 'standard'
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
      this.showLoading(false);
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

    const statCards = document.querySelectorAll('.stat-value');
    statCards.forEach(card => {
      if (show) {
        card.dataset.originalText = card.textContent;
        card.innerHTML = '<span class="loading-dots">...</span>';
      }
    });

    const chartEl = document.getElementById('daily-chart');
    if (chartEl && show) {
      chartEl.innerHTML = loadingHtml;
    }

    const tableBody = document.querySelector('.data-table tbody');
    if (tableBody && show) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;">${loadingHtml}</td></tr>`;
    }

    const companyCards = document.getElementById('company-cards');
    if (companyCards && show) {
      companyCards.innerHTML = loadingHtml;
    }

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
        <td>${Utils.escapeHtml(app.company)}</td>
        <td><span class="type-badge ${app.type}">${typeLabels[app.type] || app.type}</span></td>
        <td>${app.source}</td>
      </tr>
    `).join('');
  },

  // モックデータ読み込み（デモ用）
  loadMockData(days) {
    const baseViews = days * 150;
    const baseUsers = days * 80;
    const companyViews = days * 45;
    const applyClicks = days * 12;

    document.getElementById('total-pageviews').textContent = Utils.formatNumber(baseViews + Math.floor(Math.random() * 500));
    document.getElementById('total-users').textContent = Utils.formatNumber(baseUsers + Math.floor(Math.random() * 200));
    document.getElementById('company-views').textContent = Utils.formatNumber(companyViews + Math.floor(Math.random() * 100));
    document.getElementById('apply-clicks').textContent = Utils.formatNumber(applyClicks + Math.floor(Math.random() * 30));

    this.renderDailyChart(days);
    this.renderCompanyData();
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

    const maxViews = Math.max(...data.map(d => d.views));

    let chartHtml = '<div class="simple-chart">';
    chartHtml += '<div class="chart-bars">';

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
    if (!tbody) return;

    const sortedData = [...this.companyData].sort((a, b) => b.views - a.views);

    tbody.innerHTML = sortedData.slice(0, 5).map((company, index) => {
      const cvr = ((company.clicks / company.views) * 100).toFixed(1);
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${Utils.escapeHtml(company.name)}</td>
          <td>${Utils.formatNumber(company.views)}</td>
          <td>${company.clicks}</td>
          <td>${cvr}%</td>
        </tr>
      `;
    }).join('');
  },

  // 企業カード描画
  renderCompanyCards() {
    const container = document.getElementById('company-cards');
    if (!container) return;

    container.innerHTML = this.companyData.map(company => {
      const cvr = ((company.clicks / company.views) * 100).toFixed(1);
      const patternLabel = AdminCompany.getPatternLabel(company.pattern);

      return `
        <div class="company-card" data-domain="${company.domain}" data-name="${company.name}" data-views="${company.views}" data-clicks="${company.clicks}">
          <div class="company-card-header">
            <h4>${Utils.escapeHtml(company.name)}</h4>
            <span class="pattern-badge ${company.pattern}">${patternLabel}</span>
          </div>
          <div class="company-card-stats">
            <div class="card-stat">
              <span class="stat-value">${Utils.formatNumber(company.views)}</span>
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
    if (!tbody) return;

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
        <td>${Utils.escapeHtml(app.company)}</td>
        <td><span class="type-badge ${app.type}">${typeLabels[app.type]}</span></td>
        <td>${app.source}</td>
      </tr>
    `).join('');
  }
};

// グローバルにエクスポート
window.AdminAnalytics = AdminAnalytics;
