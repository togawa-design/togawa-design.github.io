/**
 * Jobs Listing ページ機能
 */

import { escapeHtml, trackEvent } from '@shared/utils.js';
import * as JobsLoader from '@shared/jobs-loader.js';
import { JobCard, LocationCard } from '@components/molecules/index.js';
import { LoadingSpinner } from '@components/atoms/index.js';
import { initMobileMenu } from '@features/home/index.js';
import { initFooterContent } from '@shared/layout.js';

// 全求人一覧を表示
export async function renderAllJobs(container) {
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

    const companiesWithJobData = await Promise.all(
      visibleCompanies.map(async (company) => {
        company._displayMonthlySalary = company.monthlySalary || '';

        if (company.jobsSheet && company.jobsSheet.trim()) {
          const companyJobs = await JobsLoader.fetchCompanyJobs(company.jobsSheet.trim());
          if (companyJobs && companyJobs.length > 0) {
            const sortedJobs = companyJobs
              .filter(j => j.visible !== 'false' && j.visible !== 'FALSE')
              .filter(j => JobsLoader.isJobInPublishPeriod(j))
              .sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999));

            if (sortedJobs.length > 0) {
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
        ${companiesWithJobData.map(company => JobCard({ job: company, linkToJobsList: true })).join('')}
      </div>
    `;

    trackJobsPageView(companiesWithJobData.length);

  } catch (error) {
    console.error('求人の取得エラー:', error);
    container.innerHTML = `
      <div class="jobs-error">
        <p>データの取得に失敗しました。</p>
        <button onclick="location.reload()">再読み込み</button>
      </div>
    `;
  }
}

// 勤務地リストを表示
export async function renderLocationsList() {
  const container = document.getElementById('jobs-locations-container');
  if (!container) return;

  try {
    const locations = await JobsLoader.getLocationList();

    if (!locations || locations.length === 0) {
      const section = document.getElementById('jobs-locations');
      if (section) section.style.display = 'none';
      return;
    }

    const topLocations = locations.slice(0, 8);

    container.innerHTML = `
      <div class="other-locations-grid">
        ${topLocations.map(loc => `
          <a href="location.html?prefecture=${encodeURIComponent(loc.prefecture)}" class="other-location-card">
            <span class="other-location-name">${escapeHtml(loc.prefecture)}</span>
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
}

// アナリティクス: 求人一覧ページ閲覧トラッキング
function trackJobsPageView(jobCount) {
  trackEvent('view_jobs_page', {
    job_count: jobCount,
    page_location: window.location.href,
    page_title: document.title
  });
}

// キーワード・職種検索結果を表示
export async function renderFilteredJobs(container, filterType, filterValue) {
  try {
    let jobs = [];
    let titleText = '';

    if (filterType === 'keyword') {
      jobs = await JobsLoader.getJobsByKeyword(filterValue);
      titleText = `「${filterValue}」の検索結果`;
    } else if (filterType === 'occupation') {
      jobs = await JobsLoader.getJobsByOccupation(filterValue);
      titleText = `職種「${filterValue}」の検索結果`;
    }

    // 掲載期間内のみ表示
    jobs = jobs.filter(job =>
      job.visible !== 'false' &&
      job.visible !== 'FALSE' &&
      JobsLoader.isJobInPublishPeriod(job)
    );

    if (jobs.length === 0) {
      container.innerHTML = `
        <div class="jobs-page-header">
          <h1 class="jobs-page-title">${escapeHtml(titleText)}</h1>
          <p class="jobs-page-description">該当する求人が見つかりませんでした</p>
        </div>
        <div class="jobs-error">
          <p>条件に一致する求人はありません。</p>
          <a href="jobs.html" class="btn-more">すべての求人を見る</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="jobs-page-header">
        <h1 class="jobs-page-title">${escapeHtml(titleText)}</h1>
        <p class="jobs-page-description">${jobs.length}件の求人が見つかりました</p>
        <a href="jobs.html" class="filter-clear-link">フィルターを解除</a>
      </div>
      <div class="jobs-grid jobs-page-grid">
        ${jobs.map(job => JobCard({ job, showCompanyName: true })).join('')}
      </div>
    `;

    trackEvent('view_filtered_jobs', {
      filter_type: filterType,
      filter_value: filterValue,
      result_count: jobs.length
    });

  } catch (error) {
    console.error('フィルタリング求人の取得エラー:', error);
    container.innerHTML = `
      <div class="jobs-error">
        <p>データの取得に失敗しました。</p>
        <button onclick="location.reload()">再読み込み</button>
      </div>
    `;
  }
}

// ページ初期化
export async function initJobsPage() {
  const container = document.getElementById('jobs-page-container');
  if (!container) return;

  // URLパラメータをチェック
  const params = new URLSearchParams(window.location.search);
  const keyword = params.get('keyword');
  const occupation = params.get('occupation');

  if (keyword) {
    await renderFilteredJobs(container, 'keyword', keyword);
  } else if (occupation) {
    await renderFilteredJobs(container, 'occupation', occupation);
  } else {
    await renderAllJobs(container);
  }

  await renderLocationsList();
  initMobileMenu();
  initFooterContent();
}

export default {
  initJobsPage,
  renderAllJobs,
  renderFilteredJobs,
  renderLocationsList
};
