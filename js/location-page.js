/**
 * 勤務地ページ - 求人一覧表示
 */

const LocationPage = {
  // URLパラメータから都道府県を取得
  getPrefectureFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('prefecture');
  },

  // ページを初期化
  async init() {
    const container = document.getElementById('location-page-container');
    if (!container) return;

    const prefecture = this.getPrefectureFromUrl();

    if (!prefecture) {
      // 都道府県が指定されていない場合は全エリア一覧を表示
      await this.renderAllLocations(container);
    } else {
      // 特定の都道府県の求人一覧を表示
      await this.renderLocationJobs(container, prefecture);
    }

    // 他のエリアを表示
    await this.renderOtherLocations(prefecture);

    // モバイルメニュー初期化
    this.initMobileMenu();
  },

  // 全エリア一覧を表示
  async renderAllLocations(container) {
    // タイトル更新
    document.title = '勤務地から探す | リクエコ求人ナビ';
    const breadcrumb = document.getElementById('breadcrumb-current');
    if (breadcrumb) {
      breadcrumb.textContent = '勤務地から探す';
    }

    try {
      const locations = await JobsLoader.getLocationList();

      if (!locations || locations.length === 0) {
        container.innerHTML = `
          <div class="jobs-error">
            <p>勤務地データがありません。</p>
            <a href="/" class="btn-more">トップページに戻る</a>
          </div>
        `;
        return;
      }

      // 地域ごとにグループ化
      const regions = this.groupByRegion(locations);

      container.innerHTML = `
        <div class="location-page-header">
          <h1 class="location-page-title">勤務地から探す</h1>
          <p class="location-page-description">働きたいエリアから求人を探せます</p>
        </div>
        <div class="location-regions">
          ${Object.entries(regions).map(([regionName, prefectures]) => `
            <div class="location-region">
              <h2 class="location-region-title">${regionName}</h2>
              <div class="location-prefecture-grid">
                ${prefectures.map(loc => `
                  <a href="location.html?prefecture=${encodeURIComponent(loc.prefecture)}" class="location-prefecture-card">
                    <span class="prefecture-name">${loc.prefecture}</span>
                    <span class="prefecture-count">${loc.count}件</span>
                  </a>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;

    } catch (error) {
      console.error('エリア一覧の取得エラー:', error);
      container.innerHTML = `
        <div class="jobs-error">
          <p>データの取得に失敗しました。</p>
          <button onclick="location.reload()">再読み込み</button>
        </div>
      `;
    }
  },

  // 都道府県を地域ごとにグループ化
  groupByRegion(locations) {
    const regionMap = {
      '北海道': '北海道・東北',
      '青森県': '北海道・東北',
      '岩手県': '北海道・東北',
      '宮城県': '北海道・東北',
      '秋田県': '北海道・東北',
      '山形県': '北海道・東北',
      '福島県': '北海道・東北',
      '茨城県': '関東',
      '栃木県': '関東',
      '群馬県': '関東',
      '埼玉県': '関東',
      '千葉県': '関東',
      '東京都': '関東',
      '神奈川県': '関東',
      '新潟県': '北陸・甲信越',
      '富山県': '北陸・甲信越',
      '石川県': '北陸・甲信越',
      '福井県': '北陸・甲信越',
      '山梨県': '北陸・甲信越',
      '長野県': '北陸・甲信越',
      '岐阜県': '東海',
      '静岡県': '東海',
      '愛知県': '東海',
      '三重県': '東海',
      '滋賀県': '関西',
      '京都府': '関西',
      '大阪府': '関西',
      '兵庫県': '関西',
      '奈良県': '関西',
      '和歌山県': '関西',
      '鳥取県': '中国',
      '島根県': '中国',
      '岡山県': '中国',
      '広島県': '中国',
      '山口県': '中国',
      '徳島県': '四国',
      '香川県': '四国',
      '愛媛県': '四国',
      '高知県': '四国',
      '福岡県': '九州・沖縄',
      '佐賀県': '九州・沖縄',
      '長崎県': '九州・沖縄',
      '熊本県': '九州・沖縄',
      '大分県': '九州・沖縄',
      '宮崎県': '九州・沖縄',
      '鹿児島県': '九州・沖縄',
      '沖縄県': '九州・沖縄'
    };

    const regionOrder = ['北海道・東北', '関東', '北陸・甲信越', '東海', '関西', '中国', '四国', '九州・沖縄'];
    const regions = {};

    // 初期化
    regionOrder.forEach(region => {
      regions[region] = [];
    });

    // グループ化
    locations.forEach(loc => {
      const region = regionMap[loc.prefecture] || 'その他';
      if (!regions[region]) {
        regions[region] = [];
      }
      regions[region].push(loc);
    });

    // 空の地域を削除
    Object.keys(regions).forEach(key => {
      if (regions[key].length === 0) {
        delete regions[key];
      }
    });

    return regions;
  },

  // 特定の都道府県の求人一覧を表示
  async renderLocationJobs(container, prefecture) {
    // タイトル更新
    document.title = `${prefecture}の求人一覧 | リクエコ求人ナビ`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = `${prefecture}の期間工・期間従業員の求人一覧。工場・製造業の求人を多数掲載。`;
    }
    const breadcrumb = document.getElementById('breadcrumb-current');
    if (breadcrumb) {
      breadcrumb.textContent = `${prefecture}の求人`;
    }

    try {
      const jobs = await JobsLoader.getJobsByLocation(prefecture);

      if (!jobs || jobs.length === 0) {
        container.innerHTML = `
          <div class="location-page-header">
            <h1 class="location-page-title">${this.escapeHtml(prefecture)}の求人</h1>
            <p class="location-page-description">現在、${this.escapeHtml(prefecture)}の求人はありません</p>
          </div>
          <div class="jobs-error">
            <p>${this.escapeHtml(prefecture)}の求人が見つかりませんでした。</p>
            <a href="location.html" class="btn-more">他のエリアを探す</a>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="location-page-header">
          <h1 class="location-page-title">${this.escapeHtml(prefecture)}の求人</h1>
          <p class="location-page-description">${jobs.length}件の求人が見つかりました</p>
        </div>
        <div class="jobs-grid location-jobs-grid">
          ${jobs.map(job => this.renderJobCard(job)).join('')}
        </div>
      `;

      // アナリティクス: 勤務地ページ閲覧トラッキング
      this.trackLocationPageView(prefecture, jobs.length);

    } catch (error) {
      console.error('求人の取得エラー:', error);
      container.innerHTML = `
        <div class="jobs-error">
          <p>データの取得に失敗しました。</p>
          <button onclick="location.reload()">再読み込み</button>
        </div>
      `;
    }
  },

  // 求人カードを生成
  renderJobCard(job) {
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
          <a href="company.html?id=${this.escapeHtml(job.companyDomain || '')}" class="btn-apply">詳細を見る</a>
        </div>
      </article>
    `;
  },

  // 他のエリアを表示
  async renderOtherLocations(currentPrefecture) {
    const container = document.getElementById('other-locations-container');
    if (!container) return;

    try {
      const locations = await JobsLoader.getLocationList();

      // 現在の都道府県を除外し、上位6件を表示
      const otherLocations = locations
        .filter(loc => loc.prefecture !== currentPrefecture)
        .slice(0, 6);

      if (otherLocations.length === 0) {
        document.getElementById('other-locations').style.display = 'none';
        return;
      }

      container.innerHTML = `
        <div class="other-locations-grid">
          ${otherLocations.map(loc => `
            <a href="location.html?prefecture=${encodeURIComponent(loc.prefecture)}" class="other-location-card">
              <span class="other-location-name">${loc.prefecture}</span>
              <span class="other-location-count">${loc.count}件の求人</span>
            </a>
          `).join('')}
        </div>
        <div class="other-locations-more">
          <a href="location.html" class="btn-more">すべてのエリアを見る</a>
        </div>
      `;

    } catch (error) {
      console.error('他のエリアの取得エラー:', error);
      container.innerHTML = '<p>データの取得に失敗しました</p>';
    }
  },

  // HTMLエスケープ
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // アナリティクス: 勤務地ページ閲覧トラッキング
  trackLocationPageView(prefecture, jobCount) {
    if (typeof gtag === 'function') {
      gtag('event', 'view_location_page', {
        prefecture: prefecture,
        job_count: jobCount,
        page_location: window.location.href,
        page_title: document.title
      });
    }
  },

  // モバイルメニュー初期化
  initMobileMenu() {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    if (!menuBtn) return;

    // モバイルナビを作成
    const existingNav = document.querySelector('.mobile-nav');
    if (existingNav) return;

    const mobileNav = document.createElement('nav');
    mobileNav.className = 'mobile-nav';
    mobileNav.innerHTML = `
      <ul>
        <li><a href="/#jobs">お仕事紹介</a></li>
        <li><a href="/#content">コンテンツ</a></li>
        <li><a href="/#about">当サイトについて</a></li>
        <li><a href="/#contact">お問い合わせ</a></li>
        <li><a href="admin.html">管理者</a></li>
      </ul>
    `;
    document.querySelector('.header').after(mobileNav);

    menuBtn.addEventListener('click', function() {
      this.classList.toggle('active');
      mobileNav.classList.toggle('active');
    });

    // リンククリックでメニューを閉じる
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuBtn.classList.remove('active');
        mobileNav.classList.remove('active');
      });
    });
  }
};

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
  LocationPage.init();
});
