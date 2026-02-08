/**
 * Job Detail ページ機能（ランディングページ風）
 */

import { escapeHtml, nl2br, getUrlParam, trackEvent, showLoading, showError, waitForJobsLoader } from '@shared/utils.js';
import * as JobsLoader from '@shared/jobs-loader.js';
import { JobCard, PointCard, DetailRow } from '@components/molecules/index.js';
import { Icons, TagList } from '@components/atoms/index.js';
import { initFooterContent } from '@shared/layout.js';

// 求人詳細を描画
export function renderJobDetail(job) {
  const container = document.getElementById('job-detail-container');
  if (!container) return;

  // displayedFeaturesが設定されている場合はそれを使用、なければfeaturesを使用
  const displayedFeaturesRaw = job.displayedFeatures || '';
  const displayedFeaturesArray = displayedFeaturesRaw
    ? displayedFeaturesRaw.split(',').map(f => f.trim()).filter(f => f)
    : [];

  // 表示用の特徴（displayedFeaturesがあればそれを、なければfeaturesの最初の3つ）
  const featuresRaw = job.features || '';
  const allFeatures = featuresRaw
    ? featuresRaw.split(',').map(f => f.trim()).filter(f => f)
    : [];

  const features = displayedFeaturesArray.length > 0
    ? displayedFeaturesArray.slice(0, 3)
    : allFeatures.slice(0, 3);

  container.innerHTML = `
    <div class="lp-container">
      <!-- ヒーローセクション -->
      <section class="lp-hero-section">
        <div class="lp-hero-bg"></div>
        <div class="lp-hero-inner">
          <p class="lp-hero-label">${escapeHtml(job.company)}</p>
          <h1 class="lp-hero-title">${escapeHtml(job.title)}</h1>
          <div class="lp-hero-meta">
            <span class="lp-hero-location">
              ${Icons.location}
              ${escapeHtml(job.location)}
            </span>
          </div>
          <a href="#apply-section" class="lp-hero-cta" data-apply-btn data-job-id="${escapeHtml(String(job.id))}" data-company-domain="${escapeHtml(job.companyDomain)}" data-company-name="${escapeHtml(job.company)}" data-job-title="${escapeHtml(job.title)}">今すぐ応募する</a>
        </div>
      </section>

      <!-- ポイントセクション -->
      <section class="lp-points-section">
        <div class="lp-section-inner">
          <h2 class="lp-section-heading">この求人のポイント</h2>
          <div class="lp-points-grid">
            ${job.totalBonus ? PointCard({
              icon: Icons.money,
              label: '特典総額',
              value: job.totalBonus,
              isHighlight: true
            }) : ''}
            ${job.monthlySalary ? PointCard({
              icon: Icons.wallet,
              label: '月収例',
              value: job.monthlySalary
            }) : ''}
            ${job.employmentType ? PointCard({
              icon: Icons.briefcase,
              label: '雇用形態',
              value: job.employmentType
            }) : ''}
          </div>
          ${features.length > 0 ? `
          <div class="lp-tags">
            ${features.map(f => `<span class="lp-tag">${escapeHtml(f)}</span>`).join('')}
          </div>
          ` : ''}
        </div>
      </section>

      <!-- 募集要項セクション -->
      <section class="lp-details-section">
        <div class="lp-section-inner">
          <h2 class="lp-section-heading">募集要項</h2>
          <div class="lp-details-table">
            ${DetailRow({ label: '仕事内容', value: job.jobDescription })}
            ${DetailRow({ label: '給与', value: job.salary })}
            ${DetailRow({ label: '応募資格', value: job.requirements })}
            ${DetailRow({ label: '勤務時間', value: job.workingHours })}
            ${DetailRow({ label: '休日・休暇', value: job.holidays })}
            ${DetailRow({ label: '待遇・福利厚生', value: job.benefits })}
            <div class="lp-detail-row">
              <div class="lp-detail-label">勤務地</div>
              <div class="lp-detail-value">${escapeHtml(job.location)}</div>
            </div>
            ${job.access ? `
            <div class="lp-detail-row">
              <div class="lp-detail-label">アクセス</div>
              <div class="lp-detail-value">${escapeHtml(job.access)}</div>
            </div>
            ` : ''}
          </div>
        </div>
      </section>

      <!-- 応募セクション -->
      <section class="lp-apply-section" id="apply-section">
        <div class="lp-section-inner">
          <h2 class="lp-apply-heading">まずはお気軽にご応募ください</h2>
          <p class="lp-apply-text">経験・学歴不問！あなたのご応募をお待ちしています。</p>
          <div class="lp-apply-buttons">
            <a href="#" class="lp-apply-btn primary" data-apply-btn data-job-id="${escapeHtml(String(job.id))}" data-company-domain="${escapeHtml(job.companyDomain)}" data-company-name="${escapeHtml(job.company)}" data-job-title="${escapeHtml(job.title)}">この求人に応募する</a>
            <a href="company.html?id=${escapeHtml(job.companyDomain)}" class="lp-apply-btn secondary">${escapeHtml(job.company)}の企業情報を見る</a>
          </div>
        </div>
      </section>
    </div>
  `;
}

// パンくずリストを更新
export function updateBreadcrumb(job) {
  const companyLink = document.getElementById('breadcrumb-company');
  if (companyLink) {
    companyLink.innerHTML = `<a href="company.html?id=${encodeURIComponent(job.companyDomain)}">${escapeHtml(job.company)}</a>`;
  }
  const current = document.getElementById('breadcrumb-current');
  if (current) {
    current.textContent = job.title;
  }
}

// SEOを更新
export function updateSEO(job) {
  document.title = `${job.title} | ${job.company} | L-SET`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.content = `${job.company}の${job.title}。${job.location}勤務。${job.totalBonus ? '特典総額' + job.totalBonus + '。' : ''}`;
  }
}

// 関連求人を描画
export function renderRelatedJobs(relatedJobs, currentCompanyDomain, currentJobId) {
  const container = document.getElementById('related-jobs-container');
  if (!container) return;

  const filteredJobs = relatedJobs
    .filter(job => !(job.companyDomain === currentCompanyDomain && String(job.id) === String(currentJobId)))
    .slice(0, 6);

  if (filteredJobs.length === 0) {
    container.innerHTML = '<p class="no-data">関連する求人がありません。</p>';
    return;
  }

  container.innerHTML = filteredJobs.map(job => JobCard({ job })).join('');
}

// 関連求人を非同期で取得して描画
export async function renderRelatedJobsAsync(companies, currentCompanyDomain, currentJobId) {
  try {
    const relatedJobs = [];
    for (const company of companies) {
      if (!JobsLoader.isCompanyVisible(company)) continue;
      if (company.companyDomain === currentCompanyDomain) continue;

      if (company.jobsSheet && company.jobsSheet.trim()) {
        const jobs = await JobsLoader.fetchCompanyJobs(company.jobsSheet.trim());
        if (jobs && jobs.length > 0) {
          jobs.forEach(j => {
            j.company = company.company;
            j.companyDomain = company.companyDomain;
          });
          relatedJobs.push(...jobs.slice(0, 2));
        }
      }

      if (relatedJobs.length >= 6) break;
    }

    renderRelatedJobs(relatedJobs.slice(0, 6), currentCompanyDomain, currentJobId);
  } catch (error) {
    console.error('関連求人の取得エラー:', error);
  }
}

// 応募モーダル関連の変数
let currentJobData = null;

// Firebase Firestoreを初期化
function initFirestore() {
  if (typeof firebase === 'undefined') {
    console.warn('[Firestore] Firebase not loaded');
    return false;
  }

  const firebaseConfig = {
    apiKey: "AIzaSyB3eXZoFkXOwnHxPvaHiWO7csmZK4KGqAQ",
    authDomain: "generated-area-484613-e3-90bd4.firebaseapp.com",
    projectId: "generated-area-484613-e3-90bd4"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  window.firebaseDb = firebase.firestore();
  return true;
}

// 生年月日から年齢を計算
function calculateAge(birthdate) {
  if (!birthdate) return '';
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Firestoreに応募データを保存
async function saveApplicationToFirestore(data) {
  try {
    if (!window.firebaseDb) {
      console.warn('[Application] Firestore not initialized');
      return null;
    }

    const applicationData = {
      companyDomain: data.company_domain,
      companyName: data.company_name,
      jobId: data.job_id,
      jobTitle: data.job_title,
      applicantName: data.name,
      applicantNameKana: data.nameKana,
      applicantBirthdate: data.birthdate,
      applicantAge: data.age,
      applicantGender: data.gender || '',
      applicantPhone: data.phone,
      applicantEmail: data.email,
      applicantAddress: data.address,
      applicantMessage: data.message || '',
      userId: null,
      status: 'new',
      type: 'apply',
      source: document.referrer || 'direct',
      userAgent: navigator.userAgent,
      timestamp: new Date(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await window.firebaseDb.collection('applications').add(applicationData);
    console.log('[Application] Saved to Firestore:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('[Application] Failed to save:', error);
    return null;
  }
}

// 応募モーダルを表示
function showApplyModal(jobData) {
  currentJobData = jobData;
  const modal = document.getElementById('apply-modal');
  if (!modal) return;

  // 求人情報を設定
  const jobInfo = document.getElementById('apply-job-info');
  if (jobInfo) {
    jobInfo.textContent = `${jobData.company_name} - ${jobData.job_title}`;
  }

  // フォームをリセット
  const form = document.getElementById('apply-form');
  if (form) {
    form.reset();
  }

  // 直接フォームを表示
  showApplyStep('form');

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// 応募モーダルを閉じる
function hideApplyModal() {
  const modal = document.getElementById('apply-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  document.body.style.overflow = '';
  currentJobData = null;
}

// 応募ステップを表示
function showApplyStep(step) {
  const steps = ['form', 'complete'];
  steps.forEach(s => {
    const el = document.getElementById(`apply-step-${s}`);
    if (el) {
      el.style.display = s === step ? 'block' : 'none';
    }
  });
}

// エラーメッセージを表示
function showFormError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}

// エラーメッセージを非表示
function hideFormError(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.style.display = 'none';
  }
}

// 応募モーダルのイベントを設定
function setupApplyModal() {
  initFirestore();

  const modal = document.getElementById('apply-modal');
  if (!modal) return;

  // 閉じるボタン
  modal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
    btn.addEventListener('click', hideApplyModal);
  });

  // 背景クリックで閉じる
  modal.querySelector('.modal-backdrop')?.addEventListener('click', hideApplyModal);

  // 応募フォーム送信
  document.getElementById('apply-form')?.addEventListener('submit', handleApplySubmit);
}

// 応募フォーム送信処理
async function handleApplySubmit(e) {
  e.preventDefault();

  const name = document.getElementById('apply-name')?.value?.trim();
  const nameKana = document.getElementById('apply-name-kana')?.value?.trim();
  const birthdate = document.getElementById('apply-birthdate')?.value;
  const gender = document.getElementById('apply-gender')?.value;
  const phone = document.getElementById('apply-phone')?.value?.trim();
  const email = document.getElementById('apply-email')?.value?.trim();
  const address = document.getElementById('apply-address')?.value?.trim();
  const message = document.getElementById('apply-message')?.value?.trim();

  hideFormError('apply-form-error');

  // 必須項目のバリデーション
  if (!name || !nameKana || !birthdate || !phone || !email || !address) {
    showFormError('apply-form-error', '必須項目を入力してください');
    return;
  }

  if (!currentJobData) {
    showFormError('apply-form-error', 'エラーが発生しました。再度お試しください');
    return;
  }

  // 年齢を計算
  const age = calculateAge(birthdate);

  try {
    // 応募データを保存
    const applicationId = await saveApplicationToFirestore({
      ...currentJobData,
      name,
      nameKana,
      birthdate,
      age,
      gender,
      phone,
      email,
      address,
      message
    });

    if (!applicationId) {
      throw new Error('Failed to save application');
    }

    // GA4にイベント送信
    trackEvent('submit_application', currentJobData);

    // 完了画面を表示
    showApplyStep('complete');

  } catch (error) {
    console.error('[Apply] Submit error:', error);
    showFormError('apply-form-error', '応募の送信に失敗しました。もう一度お試しください');
  }
}

// 応募ボタンのクリックイベントを設定
function setupApplyButtonTracking() {
  document.querySelectorAll('[data-apply-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();

      const data = {
        company_domain: btn.dataset.companyDomain,
        company_name: btn.dataset.companyName,
        job_id: btn.dataset.jobId,
        job_title: btn.dataset.jobTitle
      };

      // GA4にイベント送信
      trackEvent('click_apply', data);

      // 応募モーダルを表示
      showApplyModal(data);
    });
  });
}

// ページ初期化
export async function initJobDetailPage() {
  // Firestoreローダーを初期化
  await JobsLoader.initFirestoreLoader();

  const companyDomain = getUrlParam('company');
  const jobId = getUrlParam('job');

  if (!companyDomain || !jobId) {
    showError('job-detail-container', '求人が見つかりませんでした。');
    return;
  }

  showLoading('job-detail-container', '求人情報を読み込んでいます...');

  try {
    await waitForJobsLoader();

    const companies = await JobsLoader.fetchCompanies();
    if (!companies) {
      showError('job-detail-container', 'データの取得に失敗しました。');
      return;
    }

    const companyInfo = companies.find(
      c => c.companyDomain && c.companyDomain.trim() === companyDomain
    );

    if (!companyInfo) {
      showError('job-detail-container', '会社が見つかりませんでした。');
      return;
    }

    let job = null;
    if (companyInfo.jobsSheet && companyInfo.jobsSheet.trim()) {
      const companyJobs = await JobsLoader.fetchCompanyJobs(companyInfo.jobsSheet.trim());
      if (companyJobs) {
        job = companyJobs.find(j => String(j.id) === String(jobId));
        if (job) {
          job.company = companyInfo.company;
          job.companyDomain = companyInfo.companyDomain;
        }
      }
    }

    if (!job) {
      showError('job-detail-container', '求人が見つかりませんでした。');
      return;
    }

    renderJobDetail(job);
    updateBreadcrumb(job);
    updateSEO(job);

    renderRelatedJobsAsync(companies, companyDomain, jobId);

    trackEvent('view_job_detail', {
      company_domain: job.companyDomain,
      company_name: job.company,
      job_id: String(job.id),
      job_title: job.title,
      location: job.location
    });

    // 応募モーダルのイベントを設定
    setupApplyModal();

    // 応募ボタンのクリックイベントを設定
    setupApplyButtonTracking();

    // フッターコンテンツを初期化
    initFooterContent();

  } catch (error) {
    console.error('求人詳細の取得エラー:', error);
    showError('job-detail-container', 'データの取得に失敗しました。しばらくしてから再度お試しください。');
  }
}

export default {
  initJobDetailPage,
  renderJobDetail,
  updateBreadcrumb,
  updateSEO,
  renderRelatedJobs,
  renderRelatedJobsAsync
};
