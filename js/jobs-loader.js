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
  SHEET_NAME: '会社一覧', // 会社一覧シート名
  STATS_SHEET_NAME: 'Stats', // 実績データのシート名

  // デフォルト画像（imageUrlが空の場合に使用）
  DEFAULT_IMAGE: 'images/default-job.svg',

  // 会社一覧CSVを取得するURL
  get csvUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${this.SHEET_NAME}`;
  },

  // 実績データを取得するURL
  get statsUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${this.STATS_SHEET_NAME}`;
  },

  // 指定シートのCSVを取得するURL
  getSheetUrl(sheetName) {
    return `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  },

  // 会社一覧データを取得
  async fetchCompanies() {
    try {
      const response = await fetch(this.csvUrl);
      if (!response.ok) {
        throw new Error('会社一覧の取得に失敗しました');
      }
      const csvText = await response.text();
      return this.parseCSV(csvText);
    } catch (error) {
      console.error('会社一覧の取得エラー:', error);
      return null;
    }
  },

  // 会社の求人データを取得（別ファイルのスプレッドシートから）
  async fetchCompanyJobs(jobsSheetIdOrUrl) {
    if (!jobsSheetIdOrUrl) return null;
    try {
      // スプレッドシートIDを抽出（URLの場合はIDを取り出す、IDの場合はそのまま使用）
      const sheetId = this.extractSpreadsheetId(jobsSheetIdOrUrl.trim());
      if (!sheetId) {
        console.error('スプレッドシートIDを取得できませんでした:', jobsSheetIdOrUrl);
        return null;
      }

      // 別ファイルのスプレッドシートからCSVを取得（最初のシートを使用）
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('求人データの取得に失敗しました');
      }
      const csvText = await response.text();
      // デバッグ: CSV内容を確認
      console.log('[DEBUG] 求人シートCSV取得:', sheetId);
      console.log('[DEBUG] CSV行数:', csvText.split('\n').length);
      console.log('[DEBUG] 1行目(ヘッダー):', csvText.split('\n')[0]);
      console.log('[DEBUG] 3行目(データ):', csvText.split('\n')[2]);
      // 求人シートは2行目まで固定なので、3行目からデータを読み込む
      // headerRow=0 (1行目がヘッダー), dataStartRow=2 (3行目からデータ)
      const result = this.parseCSV(csvText, 0, 2);
      console.log('[DEBUG] パース結果:', result.length, '件', result);
      return result;
    } catch (error) {
      console.error('求人データの取得エラー:', error);
      return null;
    }
  },

  // スプレッドシートIDを抽出（URLまたはIDから）
  extractSpreadsheetId(input) {
    // URLからIDを抽出: https://docs.google.com/spreadsheets/d/XXXXX/edit...
    const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    // IDのみの場合（英数字、ハイフン、アンダースコアで構成）
    if (/^[a-zA-Z0-9_-]+$/.test(input)) {
      return input;
    }
    return null;
  },

  // 後方互換: fetchJobs は fetchCompanies のエイリアス
  async fetchJobs() {
    return this.fetchCompanies();
  },

  // CSVをパース
  // headerRow: ヘッダー行のインデックス（デフォルト0 = 1行目）
  // dataStartRow: データ開始行のインデックス（デフォルト1 = 2行目）
  parseCSV(csvText, headerRow = 0, dataStartRow = 1) {
    const lines = csvText.split('\n');
    const headers = this.parseCSVLine(lines[headerRow] || '');
    const jobs = [];

    for (let i = dataStartRow; i < lines.length; i++) {
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
      '表示する': 'showCompany',
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
      'pattern': 'designPattern',
      // 管理シート列（会社ごとの求人シート名）
      '管理シート': 'jobsSheet',
      'jobsSheet': 'jobsSheet',
      'jobs_sheet': 'jobsSheet',
      // 掲載期間
      '掲載開始日': 'publishStartDate',
      'publishStartDate': 'publishStartDate',
      'publish_start_date': 'publishStartDate',
      '掲載終了日': 'publishEndDate',
      'publishEndDate': 'publishEndDate',
      'publish_end_date': 'publishEndDate',
      // 求人詳細情報
      '職種名': 'jobType',
      'jobType': 'jobType',
      'job_type': 'jobType',
      '給与': 'salary',
      'salary': 'salary',
      '雇用形態': 'employmentType',
      'employmentType': 'employmentType',
      'employment_type': 'employmentType',
      '資格・スキル': 'skills',
      'skills': 'skills',
      '資格': 'skills',
      'スキル': 'skills'
    };

    // ダブルクォートを除去してトリム
    const cleanHeader = header.replace(/"/g, '').trim();

    // マッピングに存在すればそれを使用
    if (mapping[cleanHeader]) {
      return mapping[cleanHeader];
    }

    // スペースで分割して最初の部分（英語名）を取得
    // 例: "id 管理ID" → "id"
    const parts = cleanHeader.split(/\s+/);
    if (parts.length > 1 && mapping[parts[0]]) {
      return mapping[parts[0]];
    }

    // それでもマッチしなければ最初の部分をそのまま返す
    return parts[0] || cleanHeader;
  },

  // 会社が表示対象かどうか判定（管理シートあり＋表示するが○）
  isCompanyVisible(company) {
    // 管理シートが空なら非表示
    if (!company.jobsSheet || !company.jobsSheet.trim()) {
      return false;
    }
    // 「表示する」列が○でなければ非表示
    if (company.showCompany !== '○' && company.showCompany !== '◯') {
      return false;
    }
    return true;
  },

  // 求人が掲載期間内かどうか判定
  isJobInPublishPeriod(job) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 掲載開始日チェック
    if (job.publishStartDate && job.publishStartDate.trim()) {
      const startDate = this.parseDate(job.publishStartDate);
      if (startDate && today < startDate) {
        return false; // まだ掲載開始日前
      }
    }

    // 掲載終了日チェック
    if (job.publishEndDate && job.publishEndDate.trim()) {
      const endDate = this.parseDate(job.publishEndDate);
      if (endDate && today > endDate) {
        return false; // 掲載終了日を過ぎている
      }
    }

    return true;
  },

  // 日付文字列をDateオブジェクトに変換
  parseDate(dateStr) {
    if (!dateStr) return null;
    // YYYY/MM/DD または YYYY-MM-DD 形式に対応
    const normalized = dateStr.trim().replace(/\//g, '-');
    const date = new Date(normalized);
    if (isNaN(date.getTime())) {
      return null;
    }
    date.setHours(0, 0, 0, 0);
    return date;
  },

  // 求人カードのHTMLを生成（TOP画面用：求人シートから特典総額・月収例を取得）
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

    // 特典総額（_displayTotalBonus）と月収例（_displayMonthlySalary）はrenderJobsで設定される
    const totalBonus = job._displayTotalBonus || job.totalBonus || '';
    const monthlySalary = job._displayMonthlySalary || job.monthlySalary || '';

    // 特典総額が空の場合は非表示
    const totalBonusHtml = totalBonus ? `
            <div class="benefit-item highlight">
              <span class="benefit-label">特典総額</span>
              <span class="benefit-value">${this.escapeHtml(totalBonus)}</span>
            </div>` : '';

    return `
      <article class="job-card" data-job-id="${this.escapeHtml(job.id || '')}">
        ${badgesHtml ? `<div class="job-card-header">${badgesHtml}</div>` : ''}
        <div class="job-card-image">
          ${imageContent}
        </div>
        <div class="job-card-body">
          <h3 class="job-title">${this.escapeHtml(job.title)}</h3>
          <p class="job-location">${this.escapeHtml(job.location)}</p>
          <div class="job-benefits">${totalBonusHtml}
            <div class="benefit-item">
              <span class="benefit-label">月収例</span>
              <span class="benefit-value">${this.escapeHtml(monthlySalary)}</span>
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

  // 会社ページを描画（複数求人対応・別シート対応）
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

    // 会社一覧を取得
    const companies = await this.fetchCompanies();
    if (!companies) {
      container.innerHTML = `
        <div class="jobs-error">
          <p>会社情報を取得できませんでした。</p>
          <button onclick="JobsLoader.renderJobDetail()">再読み込み</button>
        </div>
      `;
      return;
    }

    // 該当する会社を検索（表示対象のみ）
    const companyInfo = companies.find(
      c => c.companyDomain && c.companyDomain.trim() === companyDomain && this.isCompanyVisible(c)
    );

    if (!companyInfo) {
      container.innerHTML = `
        <div class="jobs-error">
          <p>会社が見つかりませんでした。</p>
          <a href="/" class="btn-more">トップページに戻る</a>
        </div>
      `;
      return;
    }

    // 求人データを取得（管理シートが指定されていれば別シートから、なければ会社情報をそのまま使用）
    let companyJobs = [];
    if (companyInfo.jobsSheet && companyInfo.jobsSheet.trim()) {
      // 別シートから求人を取得
      const jobs = await this.fetchCompanyJobs(companyInfo.jobsSheet.trim());
      if (jobs && jobs.length > 0) {
        companyJobs = jobs
          .filter(j => j.visible !== 'false' && j.visible !== 'FALSE')
          .filter(j => this.isJobInPublishPeriod(j)) // 掲載期間チェック
          .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999));
      }
    }

    // 求人がない場合は会社情報だけで表示（後方互換）
    if (companyJobs.length === 0) {
      companyJobs = [companyInfo];
    }

    // ページタイトルとメタ情報を更新
    document.title = `${companyInfo.company}の求人一覧 | リクエコ求人ナビ`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = `${companyInfo.company}の期間工・期間従業員求人一覧。${companyJobs.length}件の求人を掲載中。`;
    }

    // パンくずリストを更新
    const breadcrumbCurrent = document.getElementById('breadcrumb-current');
    if (breadcrumbCurrent) {
      breadcrumbCurrent.textContent = companyInfo.company;
    }

    // 会社ページコンテンツを描画
    container.innerHTML = this.renderCompanyPageContent(companyInfo, companyJobs);

    // アナリティクス: 会社ページ閲覧トラッキング
    this.trackCompanyPageView(companyInfo);

    // 応募ボタンのトラッキング設定
    this.setupApplyTracking();

    // 他社の求人を描画
    this.renderRelatedJobs(companies, companyDomain);
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

          ${job.jobType ? `
          <div class="company-job-description">
            <h4>職種名</h4>
            <p>${this.escapeHtml(job.jobType).replace(/\n/g, '<br>')}</p>
          </div>
          ` : ''}

          ${job.jobDescription ? `
          <div class="company-job-description">
            <h4>仕事内容</h4>
            <p>${this.escapeHtml(job.jobDescription).replace(/\n/g, '<br>')}</p>
          </div>
          ` : ''}

          ${job.salary ? `
          <div class="company-job-description">
            <h4>給与</h4>
            <p>${this.escapeHtml(job.salary).replace(/\n/g, '<br>')}</p>
          </div>
          ` : ''}

          ${job.employmentType ? `
          <div class="company-job-description">
            <h4>雇用形態</h4>
            <p>${this.escapeHtml(job.employmentType).replace(/\n/g, '<br>')}</p>
          </div>
          ` : ''}

          ${job.requirements ? `
          <div class="company-job-description">
            <h4>応募資格</h4>
            <p>${this.escapeHtml(job.requirements).replace(/\n/g, '<br>')}</p>
          </div>
          ` : ''}

          ${job.skills ? `
          <div class="company-job-description">
            <h4>資格・スキル</h4>
            <p>${this.escapeHtml(job.skills).replace(/\n/g, '<br>')}</p>
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
      .filter(job => job.companyDomain !== currentDomain && this.isCompanyVisible(job))
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

    // URLパラメータから勤務地を取得
    const params = new URLSearchParams(window.location.search);
    const locationFilter = params.get('location');

    // ローディング表示
    container.innerHTML = `
      <div class="jobs-loading">
        <div class="loading-spinner"></div>
        <p>${locationFilter ? `${locationFilter}の求人を読み込んでいます...` : '求人情報を読み込んでいます...'}</p>
      </div>
    `;

    // 勤務地フィルターがある場合は全求人を取得
    if (locationFilter) {
      const filteredJobs = await this.getJobsByLocation(locationFilter);

      if (!filteredJobs || filteredJobs.length === 0) {
        container.innerHTML = `
          <div class="jobs-error">
            <p>${locationFilter}の求人が見つかりませんでした。</p>
            <a href="/" class="btn-more">すべての求人を見る</a>
          </div>
        `;
        return;
      }

      // フィルター表示を追加
      const filterHeader = document.createElement('div');
      filterHeader.className = 'location-filter-header';
      filterHeader.innerHTML = `
        <div class="filter-info">
          <span class="filter-label">${locationFilter}の求人</span>
          <span class="filter-count">${filteredJobs.length}件</span>
        </div>
        <a href="/" class="btn-clear-filter">フィルターを解除</a>
      `;
      container.before(filterHeader);

      container.innerHTML = filteredJobs.map(job => this.renderJobCardForSearch(job)).join('');
      return;
    }

    const companies = await this.fetchCompanies();

    if (!companies || companies.length === 0) {
      container.innerHTML = `
        <div class="jobs-error">
          <p>求人情報を取得できませんでした。</p>
          <button onclick="JobsLoader.renderJobs('${containerId}')">再読み込み</button>
        </div>
      `;
      return;
    }

    // 表示対象の会社のみ抽出（管理シートあり＋表示が○）、orderでソート
    const visibleCompanies = companies
      .filter(company => this.isCompanyVisible(company))
      .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999));

    // 各会社の求人シートからデータを取得して表示用プロパティを設定
    const companiesWithJobData = await Promise.all(
      visibleCompanies.map(async (company) => {
        // デバッグ: 会社データの全キーを確認
        console.log('[DEBUG] 会社データ:', company.company, Object.keys(company), company);
        // デフォルトは管理シート（会社一覧）の値を使用
        company._displayTotalBonus = '';
        company._displayMonthlySalary = company.monthlySalary || '';

        if (company.jobsSheet && company.jobsSheet.trim()) {
          const companyJobs = await this.fetchCompanyJobs(company.jobsSheet.trim());
          console.log('[DEBUG] 求人シートデータ:', company.company, companyJobs);
          if (companyJobs && companyJobs.length > 0) {
            // 表示順でソート
            const sortedJobs = companyJobs
              .filter(j => j.visible !== 'false' && j.visible !== 'FALSE')
              .filter(j => this.isJobInPublishPeriod(j))
              .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999));

            console.log('[DEBUG] ソート後の求人:', company.company, sortedJobs);
            if (sortedJobs.length > 0) {
              // 表示順1の求人から特典総額を取得
              const firstJob = sortedJobs[0];
              console.log('[DEBUG] 表示順1の求人:', firstJob, 'totalBonus:', firstJob.totalBonus, 'monthlySalary:', firstJob.monthlySalary);
              company._displayTotalBonus = firstJob.totalBonus || '';

              // 全求人の中で最も高い月収例を取得（求人シートに値があれば優先）
              const maxMonthlySalary = this.getMaxMonthlySalary(sortedJobs);
              console.log('[DEBUG] 最高月収例:', maxMonthlySalary);
              if (maxMonthlySalary) {
                company._displayMonthlySalary = maxMonthlySalary;
              }
            }
          }
        }
        return company;
      })
    );

    container.innerHTML = companiesWithJobData.map(company => this.renderJobCard(company)).join('');
  },

  // 月収例から最高額を取得
  getMaxMonthlySalary(jobs) {
    let maxSalary = 0;
    let maxSalaryStr = '';

    jobs.forEach(job => {
      if (!job.monthlySalary) return;

      const salaryStr = job.monthlySalary;
      let salary = 0;

      // 「万円」の前の数字を取得（例: 35万円、35.5万円）
      const manMatch = salaryStr.match(/(\d+(?:\.\d+)?)\s*万/);
      if (manMatch) {
        salary = parseFloat(manMatch[1]) * 10000;
      } else {
        // 「円」の前の数字を取得（例: 350,000円）
        const yenMatch = salaryStr.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
        if (yenMatch) {
          salary = parseInt(yenMatch[1].replace(/,/g, ''));
        } else {
          // ¥マーク形式（例: ¥355,000、¥350000）
          const yenSymbolMatch = salaryStr.match(/[¥￥]\s*(\d{1,3}(?:,\d{3})*|\d+)/);
          if (yenSymbolMatch) {
            salary = parseInt(yenSymbolMatch[1].replace(/,/g, ''));
          } else {
            // 数字のみ（カンマ区切り対応）
            const numMatch = salaryStr.match(/(\d{1,3}(?:,\d{3})*|\d+)/);
            if (numMatch) {
              salary = parseInt(numMatch[1].replace(/,/g, ''));
            }
          }
        }
      }

      if (salary > maxSalary) {
        maxSalary = salary;
        maxSalaryStr = salaryStr;
      }
    });

    return maxSalaryStr;
  },

  // 検索結果用の求人カード（会社名を表示）
  renderJobCardForSearch(job) {
    const features = Array.isArray(job.features) ? job.features : [];
    const featuresHtml = features.slice(0, 3).map(f => `<li>${this.escapeHtml(f)}</li>`).join('');

    return `
      <article class="job-card" data-job-id="${this.escapeHtml(job.id || '')}">
        <div class="job-card-body">
          <p class="job-company-name">${this.escapeHtml(job.company || '')}</p>
          <h3 class="job-title">${this.escapeHtml(job.title || '')}</h3>
          <p class="job-location">${this.escapeHtml(job.location || '')}</p>
          <div class="job-benefits">
            <div class="benefit-item highlight">
              <span class="benefit-label">特典総額</span>
              <span class="benefit-value">${this.escapeHtml(job.totalBonus || '')}</span>
            </div>
            <div class="benefit-item">
              <span class="benefit-label">月収例</span>
              <span class="benefit-value">${this.escapeHtml(job.monthlySalary || '')}</span>
            </div>
          </div>
          ${featuresHtml ? `<ul class="job-features">${featuresHtml}</ul>` : ''}
        </div>
        <div class="job-card-footer">
          <a href="company.html?id=${this.escapeHtml(job.companyDomain || '')}" class="btn-detail">詳細を見る</a>
        </div>
      </article>
    `;
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

  // すべての会社の求人データを取得
  async fetchAllJobs() {
    const companies = await this.fetchCompanies();
    if (!companies) return [];

    const allJobs = [];

    for (const company of companies) {
      // 表示対象の会社のみ処理
      if (!this.isCompanyVisible(company)) continue;

      const jobs = await this.fetchCompanyJobs(company.jobsSheet);
      if (jobs) {
        // 各求人に会社情報を付与
        jobs.forEach(job => {
          job.company = company.company;
          job.companyDomain = company.companyDomain;
          allJobs.push(job);
        });
      }
    }

    return allJobs;
  },

  // すべての勤務地を取得（都道府県ごとにグループ化）
  async getLocationList() {
    const allJobs = await this.fetchAllJobs();
    const locationMap = {};

    allJobs.forEach(job => {
      if (!job.location) return;

      // 都道府県を抽出（「愛知県」「群馬県」など）
      const prefMatch = job.location.match(/^(.+?[都道府県])/);
      const prefecture = prefMatch ? prefMatch[1] : job.location;

      if (!locationMap[prefecture]) {
        locationMap[prefecture] = {
          prefecture: prefecture,
          jobs: [],
          count: 0
        };
      }
      locationMap[prefecture].jobs.push(job);
      locationMap[prefecture].count++;
    });

    // 件数でソート
    return Object.values(locationMap).sort((a, b) => b.count - a.count);
  },

  // 勤務地で求人をフィルタリング
  async getJobsByLocation(prefecture) {
    const allJobs = await this.fetchAllJobs();
    return allJobs.filter(job => {
      if (!job.location) return false;
      return job.location.includes(prefecture);
    });
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
    // デバッグ用コンソール出力（debug_modeパラメータがある場合も出力）
    var isDebug = window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' ||
                  new URLSearchParams(window.location.search).has('debug_mode');
    if (isDebug) {
      console.log('[Analytics]', eventName, eventParams);
    }
    // gtag が利用可能かチェック
    if (typeof gtag === 'function') {
      gtag('event', eventName, eventParams);
      if (isDebug) {
        console.log('[Analytics] gtag sent successfully');
      }
    } else {
      console.warn('[Analytics] gtag is not defined, event not sent:', eventName);
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
  },

  // フッターの勤務地リンクを動的に更新
  async renderFooterLocations() {
    const container = document.getElementById('footer-locations');
    if (!container) return;

    try {
      const locations = await this.getLocationList();

      // 上位4件を取得
      const topLocations = locations.slice(0, 4);

      if (topLocations.length === 0) {
        container.innerHTML = '<li><a href="location.html">すべてのエリア</a></li>';
        return;
      }

      // 上位4件 + すべてのエリアリンク
      container.innerHTML = topLocations.map(loc =>
        `<li><a href="location.html?prefecture=${encodeURIComponent(loc.prefecture)}">${this.escapeHtml(loc.prefecture)}の求人</a></li>`
      ).join('') + '<li><a href="location.html">すべてのエリア</a></li>';

    } catch (error) {
      console.error('フッター勤務地の取得エラー:', error);
    }
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
  // フッターの勤務地リンクを動的に更新
  if (document.getElementById('footer-locations')) {
    JobsLoader.renderFooterLocations();
  }
});
