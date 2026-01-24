// 求人詳細ページ（ランディングページ風）
const JobDetailPage = {
  async init() {
    const companyDomain = Utils.getUrlParam('company');
    const jobId = Utils.getUrlParam('job');

    if (!companyDomain || !jobId) {
      Utils.showError('job-detail-container', '求人が見つかりませんでした。');
      return;
    }

    // ローディング表示
    Utils.showLoading('job-detail-container', '求人情報を読み込んでいます...');

    try {
      // JobsLoaderが読み込まれるまで待機
      await Utils.waitForJobsLoader();

      const allJobs = await JobsLoader.fetchAllJobs();
      const job = allJobs.find(j => {
        return j.companyDomain === companyDomain && String(j.id) === String(jobId);
      });

      if (!job) {
        Utils.showError('job-detail-container', '求人が見つかりませんでした。');
        return;
      }

      this.renderJobDetail(job);
      this.updateBreadcrumb(job);
      this.updateSEO(job);
      this.renderRelatedJobs(allJobs, companyDomain, jobId);

      Utils.trackEvent('view_job_detail', {
        company: job.company,
        job_title: job.title,
        location: job.location
      });

    } catch (error) {
      console.error('求人詳細の取得エラー:', error);
      Utils.showError('job-detail-container', 'データの取得に失敗しました。');
    }
  },

  renderJobDetail(job) {
    const container = document.getElementById('job-detail-container');
    if (!container) return;

    const features = Array.isArray(job.features) ? job.features : [];

    container.innerHTML = `
      <div class="lp-container">
        <!-- ヒーローセクション -->
        <section class="lp-hero-section">
          <div class="lp-hero-bg"></div>
          <div class="lp-hero-inner">
            <p class="lp-hero-label">${Utils.escapeHtml(job.company)}</p>
            <h1 class="lp-hero-title">${Utils.escapeHtml(job.title)}</h1>
            <div class="lp-hero-meta">
              <span class="lp-hero-location">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                ${Utils.escapeHtml(job.location)}
              </span>
            </div>
            <a href="#apply-section" class="lp-hero-cta">今すぐ応募する</a>
          </div>
        </section>

        <!-- ポイントセクション -->
        <section class="lp-points-section">
          <div class="lp-section-inner">
            <h2 class="lp-section-heading">この求人のポイント</h2>
            <div class="lp-points-grid">
              ${job.totalBonus ? `
              <div class="lp-point-card accent">
                <div class="lp-point-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
                </div>
                <div class="lp-point-content">
                  <span class="lp-point-label">特典総額</span>
                  <span class="lp-point-value">${Utils.escapeHtml(job.totalBonus)}</span>
                </div>
              </div>
              ` : ''}
              ${job.monthlySalary ? `
              <div class="lp-point-card">
                <div class="lp-point-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                </div>
                <div class="lp-point-content">
                  <span class="lp-point-label">月収例</span>
                  <span class="lp-point-value">${Utils.escapeHtml(job.monthlySalary)}</span>
                </div>
              </div>
              ` : ''}
              ${job.employmentType ? `
              <div class="lp-point-card">
                <div class="lp-point-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>
                </div>
                <div class="lp-point-content">
                  <span class="lp-point-label">雇用形態</span>
                  <span class="lp-point-value">${Utils.escapeHtml(job.employmentType)}</span>
                </div>
              </div>
              ` : ''}
            </div>
            ${features.length > 0 ? `
            <div class="lp-tags">
              ${features.map(f => `<span class="lp-tag">${Utils.escapeHtml(f)}</span>`).join('')}
            </div>
            ` : ''}
          </div>
        </section>

        <!-- 募集要項セクション -->
        <section class="lp-details-section">
          <div class="lp-section-inner">
            <h2 class="lp-section-heading">募集要項</h2>
            <div class="lp-details-table">
              ${job.jobDescription ? `
              <div class="lp-detail-row">
                <div class="lp-detail-label">仕事内容</div>
                <div class="lp-detail-value">${Utils.nl2br(job.jobDescription)}</div>
              </div>
              ` : ''}
              ${job.salary ? `
              <div class="lp-detail-row">
                <div class="lp-detail-label">給与</div>
                <div class="lp-detail-value">${Utils.nl2br(job.salary)}</div>
              </div>
              ` : ''}
              ${job.requirements ? `
              <div class="lp-detail-row">
                <div class="lp-detail-label">応募資格</div>
                <div class="lp-detail-value">${Utils.nl2br(job.requirements)}</div>
              </div>
              ` : ''}
              ${job.workingHours ? `
              <div class="lp-detail-row">
                <div class="lp-detail-label">勤務時間</div>
                <div class="lp-detail-value">${Utils.nl2br(job.workingHours)}</div>
              </div>
              ` : ''}
              ${job.holidays ? `
              <div class="lp-detail-row">
                <div class="lp-detail-label">休日・休暇</div>
                <div class="lp-detail-value">${Utils.nl2br(job.holidays)}</div>
              </div>
              ` : ''}
              ${job.benefits ? `
              <div class="lp-detail-row">
                <div class="lp-detail-label">待遇・福利厚生</div>
                <div class="lp-detail-value">${Utils.nl2br(job.benefits)}</div>
              </div>
              ` : ''}
              <div class="lp-detail-row">
                <div class="lp-detail-label">勤務地</div>
                <div class="lp-detail-value">${Utils.escapeHtml(job.location)}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- 応募セクション -->
        <section class="lp-apply-section" id="apply-section">
          <div class="lp-section-inner">
            <h2 class="lp-apply-heading">まずはお気軽にご応募ください</h2>
            <p class="lp-apply-text">経験・学歴不問！あなたのご応募をお待ちしています。</p>
            <div class="lp-apply-buttons">
              <a href="#" class="lp-apply-btn primary">この求人に応募する</a>
              <a href="company.html?id=${Utils.escapeHtml(job.companyDomain)}" class="lp-apply-btn secondary">${Utils.escapeHtml(job.company)}の企業情報を見る</a>
            </div>
          </div>
        </section>
      </div>
    `;
  },

  updateBreadcrumb(job) {
    const companyLink = document.getElementById('breadcrumb-company');
    if (companyLink) {
      companyLink.innerHTML = `<a href="company.html?id=${encodeURIComponent(job.companyDomain)}">${Utils.escapeHtml(job.company)}</a>`;
    }
    const current = document.getElementById('breadcrumb-current');
    if (current) {
      current.textContent = job.title;
    }
  },

  updateSEO(job) {
    document.title = `${job.title} | ${job.company} | リクエコ求人ナビ`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = `${job.company}の${job.title}。${job.location}勤務。${job.totalBonus ? '特典総額' + job.totalBonus + '。' : ''}`;
    }
  },

  async renderRelatedJobs(allJobs, currentCompanyDomain, currentJobId) {
    const container = document.getElementById('related-jobs-container');
    if (!container) return;

    const relatedJobs = allJobs
      .filter(job => !(job.companyDomain === currentCompanyDomain && job.id === currentJobId))
      .filter(job => JobsLoader.isCompanyVisible ? JobsLoader.isCompanyVisible(job) : true)
      .slice(0, 6);

    if (relatedJobs.length === 0) {
      container.innerHTML = '<p class="no-data">関連する求人がありません。</p>';
      return;
    }

    container.innerHTML = relatedJobs.map(job => JobsLoader.renderJobCard(job)).join('');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  JobDetailPage.init();
});
