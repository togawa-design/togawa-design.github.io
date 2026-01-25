/**
 * Jobs Listing ページ機能
 */

import { escapeHtml, trackEvent } from '@shared/utils.js';
import * as JobsLoader from '@shared/jobs-loader.js';
import { JobCard, LocationCard } from '@components/molecules/index.js';
import { LoadingSpinner } from '@components/atoms/index.js';
import { initMobileMenu } from '@features/home/index.js';

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
        ${companiesWithJobData.map(company => JobCard({ job: company })).join('')}
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

// ページ初期化
export async function initJobsPage() {
  const container = document.getElementById('jobs-page-container');
  if (!container) return;

  await renderAllJobs(container);
  await renderLocationsList();
  initMobileMenu();
}

export default {
  initJobsPage,
  renderAllJobs,
  renderLocationsList
};
