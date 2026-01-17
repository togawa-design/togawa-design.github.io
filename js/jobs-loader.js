/**
 * Google Sheets連携 - 求人データローダー
 *
 * 【セットアップ手順】
 * 1. Google Sheetsで求人データを作成（下記のカラム構成で）
 * 2. ファイル > 共有 > 「リンクを知っている全員」に変更
 * 3. ファイル > ウェブに公開 > シート1 > CSV形式で公開
 * 4. 下記のSHEET_IDを自分のシートIDに変更
 *
 * シートIDの確認方法:
 * URLが https://docs.google.com/spreadsheets/d/XXXXXX/edit の場合
 * XXXXXXの部分がシートID
 */

const JobsLoader = {
  // Google SheetのID
  SHEET_ID: '1NVIDV3OiXbNrVI7EFdRrU2Ggn8dx7Q0rSnvJ6uaWvX0',
  SHEET_NAME: 'Sheet1', // 求人データのシート名
  STATS_SHEET_NAME: 'Stats', // 実績データのシート名

  // デフォルト画像（imageUrlが空の場合に使用）
  DEFAULT_IMAGE: 'images/default-job.svg',

  // CSVデータを取得するURL
  get csvUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${this.SHEET_NAME}`;
  },

  // 実績データを取得するURL
  get statsUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${this.STATS_SHEET_NAME}`;
  },

  // 求人データを取得
  async fetchJobs() {
    try {
      const response = await fetch(this.csvUrl);
      if (!response.ok) {
        throw new Error('データの取得に失敗しました');
      }
      const csvText = await response.text();
      return this.parseCSV(csvText);
    } catch (error) {
      console.error('求人データの取得エラー:', error);
      return null;
    }
  },

  // CSVをパース
  parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = this.parseCSVLine(lines[0]);
    const jobs = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = this.parseCSVLine(lines[i]);
      const job = {};

      headers.forEach((header, index) => {
        // ヘッダー名を正規化
        const key = this.normalizeHeader(header);
        job[key] = values[index] || '';
      });

      // featuresは配列に変換
      if (job.features) {
        job.features = job.features.split(',').map(f => f.trim()).filter(f => f);
      }

      jobs.push(job);
    }

    return jobs;
  },

  // CSVの1行をパース（カンマ区切り、ダブルクォート対応）
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
      'id': 'id',
      'ID': 'id',
      '会社名': 'company',
      'company': 'company',
      'タイトル': 'title',
      'title': 'title',
      '勤務地': 'location',
      'location': 'location',
      '特典総額': 'totalBonus',
      'totalBonus': 'totalBonus',
      '月収例': 'monthlySalary',
      'monthlySalary': 'monthlySalary',
      '特徴': 'features',
      'features': 'features',
      'バッジ': 'badges',
      'badges': 'badges',
      '画像URL': 'imageUrl',
      'imageUrl': 'imageUrl',
      '詳細URL': 'detailUrl',
      'detailUrl': 'detailUrl',
      '表示': 'visible',
      'visible': 'visible',
      '並び順': 'order',
      'order': 'order',
      '会社ドメイン': 'companyDomain',
      'companyDomain': 'companyDomain',
      'company_domain': 'companyDomain',
      '説明': 'description',
      'description': 'description',
      '仕事内容': 'jobDescription',
      'jobDescription': 'jobDescription',
      '応募資格': 'requirements',
      'requirements': 'requirements',
      '待遇': 'benefits',
      'benefits': 'benefits',
      '勤務時間': 'workingHours',
      'workingHours': 'workingHours',
      '休日': 'holidays',
      'holidays': 'holidays',
      // デザインパターン列
      'デザインパターン': 'designPattern',
      'designPattern': 'designPattern',
      'design_pattern': 'designPattern',
      'パターン': 'designPattern',
      'pattern': 'designPattern'
    };

    return mapping[header.replace(/"/g, '').trim()] || header.replace(/"/g, '').trim();
  },

  // 求人カードのHTMLを生成
  renderJobCard(job) {
    const badges = job.badges ? job.badges.split(',').map(b => b.trim()) : [];
    const features = Array.isArray(job.features) ? job.features : [];

    let badgesHtml = '';
    if (badges.includes('NEW') || badges.includes('new')) {
      badgesHtml += '<span class="job-badge new">NEW</span>';
    }
    if (badges.includes('人気') || badges.includes('hot')) {
      badgesHtml += '<span class="job-badge hot">人気</span>';
    }

    const featuresHtml = features.map(f => `<li>${this.escapeHtml(f)}</li>`).join('');

    // 画像URL: 指定あり→その画像、なし→デフォルト画像
    const imageSrc = job.imageUrl && job.imageUrl.trim()
      ? job.imageUrl
      : this.DEFAULT_IMAGE;
    const imageContent = `<img src="${this.escapeHtml(imageSrc)}" alt="${this.escapeHtml(job.company)}" onerror="this.parentElement.innerHTML='<div class=\\'job-image-placeholder\\'>${this.escapeHtml(job.company)}</div>'">`;

    return `
      <article class="job-card" data-job-id="${this.escapeHtml(job.id || '')}">
        ${badgesHtml ? `<div class="job-card-header">${badgesHtml}</div>` : ''}
        <div class="job-card-image">
          ${imageContent}
        </div>
        <div class="job-card-body">
          <h3 class="job-title">${this.escapeHtml(job.title)}</h3>
          <p class="job-location">${this.escapeHtml(job.location)}</p>
          <div class="job-benefits">
            <div class="benefit-item highlight">
              <span class="benefit-label">特典総額</span>
              <span class="benefit-value">${this.escapeHtml(job.totalBonus)}</span>
            </div>
            <div class="benefit-item">
              <span class="benefit-label">月収例</span>
              <span class="benefit-value">${this.escapeHtml(job.monthlySalary)}</span>
            </div>
          </div>
          ${featuresHtml ? `<ul class="job-features">${featuresHtml}</ul>` : ''}
          <a href="${this.getDetailUrl(job)}" class="btn-apply">詳細を見る</a>
        </div>
      </article>
    `;
  },

  // HTMLエスケープ
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // 詳細URLを取得（companyDomainがあればcompany.html?id=xxx、なければdetailUrl）
  getDetailUrl(job) {
    if (job.companyDomain && job.companyDomain.trim()) {
      return `company.html?id=${encodeURIComponent(job.companyDomain.trim())}`;
    }
    return this.escapeHtml(job.detailUrl || '#');
  },

  // URLパラメータからcompanyDomainを取得
  getCompanyDomainFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  },

  // 会社ページを描画（複数求人対応）
  async renderJobDetail() {
    const container = document.getElementById('job-detail-container');
    if (!container) return;

    const companyDomain = this.getCompanyDomainFromUrl();
    if (!companyDomain) {
      container.innerHTML = `
        <div class="jobs-error">
          <p>求人が見つかりませんでした。</p>
          <a href="/" class="btn-more">トップページに戻る</a>
        </div>
      `;
      return;
    }

    const jobs = await this.fetchJobs();
    if (!jobs) {
      container.innerHTML = `
        <div class="jobs-error">
          <p>求人情報を取得できませんでした。</p>
          <button onclick="JobsLoader.renderJobDetail()">再読み込み</button>
        </div>
      `;
      return;
    }

    // 同じ会社の求人をすべて取得
    const companyJobs = jobs
      .filter(j => j.companyDomain && j.companyDomain.trim() === companyDomain && j.visible !== 'false' && j.visible !== 'FALSE')
      .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999));

    if (companyJobs.length === 0) {
      container.innerHTML = `
        <div class="jobs-error">
          <p>求人が見つかりませんでした。</p>
          <a href="/" class="btn-more">トップページに戻る</a>
        </div>
      `;
      return;
    }

    // 最初の求人から会社情報を取得
    const firstJob = companyJobs[0];

    // ページタイトルとメタ情報を更新
    document.title = `${firstJob.company}の求人一覧 | リクエコ求人ナビ`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = `${firstJob.company}の期間工・期間従業員求人一覧。${companyJobs.length}件の求人を掲載中。`;
    }

    // パンくずリストを更新
    const breadcrumbCurrent = document.getElementById('breadcrumb-current');
    if (breadcrumbCurrent) {
      breadcrumbCurrent.textContent = firstJob.company;
    }

    // 会社ページコンテンツを描画
    container.innerHTML = this.renderCompanyPageContent(firstJob, companyJobs);

    // アナリティクス: 会社ページ閲覧トラッキング
    this.trackCompanyPageView(firstJob);

    // 応募ボタンのトラッキング設定
    this.setupApplyTracking();

    // 他社の求人を描画
    this.renderRelatedJobs(jobs, companyDomain);
  },

  // デザインパターンのCSSクラスを取得
  getDesignPatternClass(pattern) {
    const validPatterns = ['modern', 'classic', 'minimal', 'colorful'];
    const normalizedPattern = pattern ? pattern.toLowerCase().trim() : '';
    if (validPatterns.includes(normalizedPattern)) {
      return `pattern-${normalizedPattern}`;
    }
    return ''; // デフォルト（スタンダード）はクラスなし
  },

  // 会社ページのHTMLを生成（複数求人一覧）
  renderCompanyPageContent(companyInfo, companyJobs) {
    const imageSrc = companyInfo.imageUrl && companyInfo.imageUrl.trim() ? companyInfo.imageUrl : this.DEFAULT_IMAGE;
    const patternClass = this.getDesignPatternClass(companyInfo.designPattern);

    return `
      <div class="company-page ${patternClass}">
        <div class="company-header">
          <div class="company-header-image">
            <img src="${this.escapeHtml(imageSrc)}" alt="${this.escapeHtml(companyInfo.company)}" onerror="this.style.display='none'">
          </div>
          <div class="company-header-info">
            <h1 class="company-name">${this.escapeHtml(companyInfo.company)}</h1>
            <p class="company-job-count">${companyJobs.length}件の求人を掲載中</p>
          </div>
        </div>

        ${companyInfo.description ? `
        <div class="company-description">
          <h2>会社について</h2>
          <p>${this.escapeHtml(companyInfo.description).replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}

        <div class="company-jobs">
          <h2>募集中の求人</h2>
          <div class="company-jobs-list">
            ${companyJobs.map(job => this.renderCompanyJobCard(job)).join('')}
          </div>
        </div>

        <div class="company-cta">
          <p>お仕事選びでお困りですか？</p>
          <div class="company-cta-buttons">
            <a href="#" class="btn-apply-large">無料で相談する</a>
            <a href="#" class="btn-line-large">LINEで相談する</a>
          </div>
        </div>
      </div>
    `;
  },

  // 会社ページ内の求人カードを生成
  renderCompanyJobCard(job) {
    const badges = job.badges ? job.badges.split(',').map(b => b.trim()) : [];
    const features = Array.isArray(job.features) ? job.features : [];

    let badgesHtml = '';
    if (badges.includes('NEW') || badges.includes('new')) {
      badgesHtml += '<span class="job-badge new">NEW</span>';
    }
    if (badges.includes('人気') || badges.includes('hot')) {
      badgesHtml += '<span class="job-badge hot">人気</span>';
    }

    return `
      <div class="company-job-card">
        <div class="company-job-card-header">
          ${badgesHtml}
          <h3 class="company-job-title">${this.escapeHtml(job.title)}</h3>
          <p class="company-job-location">${this.escapeHtml(job.location)}</p>
        </div>
        <div class="company-job-card-body">
          <div class="company-job-benefits">
            <div class="company-job-benefit highlight">
              <span class="label">特典総額</span>
              <span class="value">${this.escapeHtml(job.totalBonus)}</span>
            </div>
            <div class="company-job-benefit">
              <span class="label">月収例</span>
              <span class="value">${this.escapeHtml(job.monthlySalary)}</span>
            </div>
          </div>
          ${features.length > 0 ? `
          <ul class="company-job-features">
            ${features.map(f => `<li>${this.escapeHtml(f)}</li>`).join('')}
          </ul>
          ` : ''}

          ${job.jobDescription ? `
          <div class="company-job-description">
            <h4>仕事内容</h4>
            <p>${this.escapeHtml(job.jobDescription).replace(/\n/g, '<br>')}</p>
          </div>
          ` : ''}

          ${job.requirements ? `
          <div class="company-job-description">
            <h4>応募資格</h4>
            <p>${this.escapeHtml(job.requirements).replace(/\n/g, '<br>')}</p>
          </div>
          ` : ''}

          ${job.benefits ? `
          <div class="company-job-description">
            <h4>待遇・福利厚生</h4>
            <p>${this.escapeHtml(job.benefits).replace(/\n/g, '<br>')}</p>
          </div>
          ` : ''}

          ${job.workingHours ? `
          <div class="company-job-description">
            <h4>勤務時間</h4>
            <p>${this.escapeHtml(job.workingHours).replace(/\n/g, '<br>')}</p>
          </div>
          ` : ''}

          ${job.holidays ? `
          <div class="company-job-description">
            <h4>休日・休暇</h4>
            <p>${this.escapeHtml(job.holidays).replace(/\n/g, '<br>')}</p>
          </div>
          ` : ''}

          <a href="#" class="btn-apply-job">この求人に応募する</a>
        </div>
      </div>
    `;
  },

  // 他社の求人を描画
  async renderRelatedJobs(jobs, currentDomain) {
    const container = document.getElementById('related-jobs-container');
    if (!container) return;

    const relatedJobs = jobs
      .filter(job => job.companyDomain !== currentDomain && job.visible !== 'false' && job.visible !== 'FALSE')
      .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999))
      .slice(0, 3);

    if (relatedJobs.length === 0) {
      container.innerHTML = '<p>他の求人がありません。</p>';
      return;
    }

    container.innerHTML = relatedJobs.map(job => this.renderJobCard(job)).join('');
  },

  // 求人一覧を描画
  async renderJobs(containerId = 'jobs-container') {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container #${containerId} not found`);
      return;
    }

    // ローディング表示
    container.innerHTML = `
      <div class="jobs-loading">
        <div class="loading-spinner"></div>
        <p>求人情報を読み込んでいます...</p>
      </div>
    `;

    const jobs = await this.fetchJobs();

    if (!jobs || jobs.length === 0) {
      container.innerHTML = `
        <div class="jobs-error">
          <p>求人情報を取得できませんでした。</p>
          <button onclick="JobsLoader.renderJobs('${containerId}')">再読み込み</button>
        </div>
      `;
      return;
    }

    // visible=falseのものを除外、orderでソート
    const visibleJobs = jobs
      .filter(job => job.visible !== 'false' && job.visible !== 'FALSE')
      .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999));

    container.innerHTML = visibleJobs.map(job => this.renderJobCard(job)).join('');
  },

  // 実績データを取得
  async fetchStats() {
    try {
      const response = await fetch(this.statsUrl);
      if (!response.ok) {
        throw new Error('実績データの取得に失敗しました');
      }
      const csvText = await response.text();
      return this.parseStatsCSV(csvText);
    } catch (error) {
      console.error('実績データの取得エラー:', error);
      return null;
    }
  },

  // 実績CSVをパース（キー・値形式）
  parseStatsCSV(csvText) {
    const lines = csvText.split('\n');
    const stats = {};

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = this.parseCSVLine(lines[i]);
      const key = values[0] ? values[0].replace(/"/g, '').trim() : '';
      const value = values[1] ? values[1].replace(/"/g, '').trim() : '';
      const label = values[2] ? values[2].replace(/"/g, '').trim() : '';

      if (key) {
        stats[key] = { value, label };
      }
    }

    return stats;
  },

  // 実績を描画
  async renderStats() {
    const stats = await this.fetchStats();
    if (!stats) return;

    const statsContainer = document.querySelector('.hero-stats');
    if (!statsContainer) return;

    // 統計項目を描画
    const items = Object.keys(stats).map(key => {
      const stat = stats[key];
      return `
        <div class="stat-item">
          <span class="stat-number">${this.escapeHtml(stat.value)}</span>
          <span class="stat-label">${this.escapeHtml(stat.label)}</span>
        </div>
      `;
    }).join('');

    statsContainer.innerHTML = items;
  },

  // ========================================
  // アナリティクス機能
  // ========================================

  // Google Analyticsイベント送信
  trackEvent(eventName, eventParams = {}) {
    // gtag が利用可能かチェック
    if (typeof gtag === 'function') {
      gtag('event', eventName, eventParams);
    }
    // デバッグ用コンソール出力（開発時のみ）
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('[Analytics]', eventName, eventParams);
    }
  },

  // 会社ページ閲覧トラッキング
  trackCompanyPageView(companyInfo) {
    this.trackEvent('view_company_page', {
      company_domain: companyInfo.companyDomain || '',
      company_name: companyInfo.company || '',
      design_pattern: companyInfo.designPattern || 'standard',
      page_location: window.location.href,
      page_title: document.title
    });
  },

  // 求人詳細閲覧トラッキング
  trackJobView(job) {
    this.trackEvent('view_job', {
      job_id: job.id || '',
      job_title: job.title || '',
      company_domain: job.companyDomain || '',
      company_name: job.company || '',
      location: job.location || ''
    });
  },

  // 応募ボタンクリックトラッキング
  trackApplyClick(job, buttonType = 'apply') {
    this.trackEvent('click_apply', {
      job_id: job.id || '',
      job_title: job.title || '',
      company_domain: job.companyDomain || '',
      company_name: job.company || '',
      button_type: buttonType, // 'apply', 'line', 'consult'
      location: job.location || ''
    });
  },

  // 求人カードクリックトラッキング
  trackJobCardClick(job) {
    this.trackEvent('click_job_card', {
      job_id: job.id || '',
      job_title: job.title || '',
      company_domain: job.companyDomain || '',
      company_name: job.company || '',
      source_page: window.location.pathname
    });
  },

  // 応募ボタンにイベントリスナーを設定
  setupApplyTracking() {
    // 応募ボタン
    document.querySelectorAll('.btn-apply-job, .btn-apply-large').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const companyDomain = this.getCompanyDomainFromUrl();
        this.trackApplyClick({ companyDomain }, 'apply');
      });
    });

    // LINEボタン
    document.querySelectorAll('.btn-line-large').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const companyDomain = this.getCompanyDomainFromUrl();
        this.trackApplyClick({ companyDomain }, 'line');
      });
    });
  }
};

// ページ読み込み時に自動実行
document.addEventListener('DOMContentLoaded', () => {
  // 詳細ページの場合
  if (document.getElementById('job-detail-container')) {
    JobsLoader.renderJobDetail();
  }
  // jobs-containerが存在する場合のみ実行
  if (document.getElementById('jobs-container')) {
    JobsLoader.renderJobs();
  }
  // 実績を読み込み
  if (document.querySelector('.hero-stats')) {
    JobsLoader.renderStats();
  }
});
