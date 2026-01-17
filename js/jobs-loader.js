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
  SHEET_NAME: 'Sheet1', // シート名（必要に応じて変更）

  // デフォルト画像（imageUrlが空の場合に使用）
  DEFAULT_IMAGE: 'images/default-job.svg',

  // CSVデータを取得するURL
  get csvUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${this.SHEET_NAME}`;
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
      'order': 'order'
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
          <a href="${this.escapeHtml(job.detailUrl || '#')}" class="btn-apply">詳細を見る</a>
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
  }
};

// ページ読み込み時に自動実行
document.addEventListener('DOMContentLoaded', () => {
  // jobs-containerが存在する場合のみ実行
  if (document.getElementById('jobs-container')) {
    JobsLoader.renderJobs();
  }
});
