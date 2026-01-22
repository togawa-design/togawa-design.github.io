/**
 * 求人一覧ページ - 全求人表示
 */

const JobsPage = {
  // ページを初期化
  async init() {
    const container = document.getElementById('jobs-page-container');
    if (!container) return;

    await this.renderAllJobs(container);

    // 勤務地リストを表示
    await this.renderLocationsList();

    // モバイルメニュー初期化
    this.initMobileMenu();
  },

  // 全求人一覧を表示
  async renderAllJobs(container) {
    try {
      const companies = await JobsLoader.fetchCompanies();

      if (!companies || companies.length === 0) {
        container.innerHTML = `
          <div class="jobs-page-header">
            <h1 class="jobs-page-title">求人している会社一覧</h1>
            <p class="jobs-page-description">現在、掲載中の求人はありません</p>
          </div>
          <div class="jobs-error">
            <p>求人情報が見つかりませんでした。</p>
            <a href="/" class="btn-more">トップページに戻る</a>
          </div>
        `;
        return;
      }

      // 表示対象の会社のみ抽出（管理シートあり＋表示が○）、orderでソート
      const visibleCompanies = companies
        .filter(company => JobsLoader.isCompanyVisible(company))
        .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999));

      if (visibleCompanies.length === 0) {
        container.innerHTML = `
          <div class="jobs-page-header">
            <h1 class="jobs-page-title">求人している会社一覧</h1>
            <p class="jobs-page-description">現在、掲載中の求人はありません</p>
          </div>
          <div class="jobs-error">
            <p>求人情報が見つかりませんでした。</p>
            <a href="/" class="btn-more">トップページに戻る</a>
          </div>
        `;
        return;
      }

      // 各会社の求人シートからデータを取得して表示用プロパティを設定
      const companiesWithJobData = await Promise.all(
        visibleCompanies.map(async (company) => {
          company._displayTotalBonus = '';
          company._displayMonthlySalary = company.monthlySalary || '';

          if (company.jobsSheet && company.jobsSheet.trim()) {
            const companyJobs = await JobsLoader.fetchCompanyJobs(company.jobsSheet.trim());
            if (companyJobs && companyJobs.length > 0) {
              const sortedJobs = companyJobs
                .filter(j => j.visible !== 'false' && j.visible !== 'FALSE')
                .filter(j => JobsLoader.isJobInPublishPeriod(j))
                .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999));

              if (sortedJobs.length > 0) {
                const firstJob = sortedJobs[0];
                company._displayTotalBonus = firstJob.totalBonus || '';
                const maxMonthlySalary = JobsLoader.getMaxMonthlySalary(sortedJobs);
                if (maxMonthlySalary) {
                  company._displayMonthlySalary = maxMonthlySalary;
                }
              }
            }
          }
          return company;
        })
      );

      container.innerHTML = `
        <div class="jobs-page-header">
          <h1 class="jobs-page-title">求人している会社一覧</h1>
          <p class="jobs-page-description">${companiesWithJobData.length}社の会社が見つかりました</p>
        </div>
        <div class="jobs-grid jobs-page-grid">
          ${companiesWithJobData.map(company => this.renderJobCard(company)).join('')}
        </div>
      `;

      // アナリティクス: 求人一覧ページ閲覧トラッキング
      this.trackJobsPageView(companiesWithJobData.length);

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
    const badges = job.badges ? job.badges.split(',').map(b => b.trim()) : [];
    const features = Array.isArray(job.features) ? job.features : [];

    let badgesHtml = '';
    if (badges.includes('NEW') || badges.includes('new')) {
      badgesHtml += '<span class="job-badge new">NEW</span>';
    }
    if (badges.includes('急募') || badges.includes('URGENT')) {
      badgesHtml += '<span class="job-badge urgent">急募</span>';
    }

    const featuresHtml = features.map(f => `<li>${this.escapeHtml(f)}</li>`).join('');

    // 画像URL
    const imageSrc = job.imageUrl && job.imageUrl.trim()
      ? job.imageUrl
      : JobsLoader.DEFAULT_IMAGE;
    const imageContent = `<img src="${this.escapeHtml(imageSrc)}" alt="${this.escapeHtml(job.company)}" onerror="this.parentElement.innerHTML='<div class=\\'job-image-placeholder\\'>${this.escapeHtml(job.company)}</div>'">`;

    const totalBonus = job._displayTotalBonus || job.totalBonus || '';
    const monthlySalary = job._displayMonthlySalary || job.monthlySalary || '';

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
          <a href="${JobsLoader.getDetailUrl(job)}" class="btn-apply">詳細を見る</a>
        </div>
      </article>
    `;
  },

  // 勤務地リストを表示
  async renderLocationsList() {
    const container = document.getElementById('jobs-locations-container');
    if (!container) return;

    try {
      const locations = await JobsLoader.getLocationList();

      if (!locations || locations.length === 0) {
        document.getElementById('jobs-locations').style.display = 'none';
        return;
      }

      // 上位8件を表示
      const topLocations = locations.slice(0, 8);

      container.innerHTML = `
        <div class="other-locations-grid">
          ${topLocations.map(loc => `
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
      console.error('勤務地リストの取得エラー:', error);
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

  // アナリティクス: 求人一覧ページ閲覧トラッキング
  trackJobsPageView(jobCount) {
    if (typeof gtag === 'function') {
      gtag('event', 'view_jobs_page', {
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
  JobsPage.init();
});
