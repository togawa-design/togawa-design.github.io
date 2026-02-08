/**
 * Molecules - Atomsを組み合わせた複合コンポーネント
 */

import { escapeHtml, nl2br } from '@shared/utils.js';
import { Badge, Button, Icons, TagList, Image } from '@components/atoms/index.js';

// 掲載開始日から1週間以内かどうかをチェック
function isWithinOneWeek(publishStartDate) {
  if (!publishStartDate) return false;

  const startDate = new Date(publishStartDate);
  if (isNaN(startDate.getTime())) return false;

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return startDate >= oneWeekAgo;
}

// 給与表示を給与形態に即したものに決定
function getSalaryDisplay(job) {
  const salaryType = job.salaryType || '';
  const dailySalary = job.dailySalaryExample || '';
  const monthlySalary = job.monthlySalaryExample || job._displayMonthlySalary || job.monthlySalary || '';
  const yearlySalary = job.yearlySalaryExample || '';

  // 日収例、月収例、年収例の優先順位で表示
  if (dailySalary) {
    return { label: '日収例', value: dailySalary };
  }
  if (monthlySalary && salaryType !== '日給') {
    return { label: '月収例', value: monthlySalary };
  }
  if (yearlySalary) {
    return { label: '年収例', value: yearlySalary };
  }

  // 例がない場合は給与形態に応じたラベルで給与額を表示
  const baseSalary = job._displayMonthlySalary || job.monthlySalary || '';
  if (!baseSalary) {
    return { label: '', value: '' };
  }

  switch (salaryType) {
    case '時給':
      return { label: '時給', value: baseSalary };
    case '日給':
      return { label: '日給', value: baseSalary };
    case '月給':
      return { label: '月給', value: baseSalary };
    default:
      return { label: '給与', value: baseSalary };
  }
}

// 求人カード
export function JobCard({ job, showCompanyName = false, linkToJobsList = false }) {
  // displayedFeaturesが設定されている場合はそれを優先表示
  const displayedFeaturesRaw = job.displayedFeatures || '';
  const displayedFeatures = displayedFeaturesRaw
    ? displayedFeaturesRaw.split(',').map(f => f.trim()).filter(f => f)
    : [];

  const allFeaturesRaw = job.features || '';
  const allFeatures = Array.isArray(allFeaturesRaw)
    ? allFeaturesRaw
    : (allFeaturesRaw ? allFeaturesRaw.split(',').map(f => f.trim()).filter(f => f) : []);

  // displayedFeaturesがあればそれを使用、なければallFeaturesの最初の3つ
  const features = displayedFeatures.length > 0 ? displayedFeatures.slice(0, 3) : allFeatures.slice(0, 3);

  const imageSrc = job.jobLogo?.trim() || job.imageUrl?.trim() || job.logoUrl?.trim() || '';
  const hasImage = !!imageSrc;

  // 給与表示を取得
  const salaryDisplay = getSalaryDisplay(job);

  // 掲載開始日から1週間以内の場合はNEWタグを自動表示
  const isNew = isWithinOneWeek(job.publishStartDate);
  const newTagHtml = isNew ? '<span class="job-new-tag">✨ NEW</span>' : '';

  // 動画ボタン表示判定
  const showVideoButton = String(job.showVideoButton).toLowerCase() === 'true' && job.videoUrl?.trim();
  const videoUrl = job.videoUrl?.trim() || '';

  // 求人ID（複数のフィールド名に対応）
  const jobId = job.id || job.jobId || job._docId || '';

  // リンク先を決定
  let detailUrl = 'jobs.html';
  if (linkToJobsList) {
    // 企業の採用ページへリンク
    if (job.companyDomain?.trim()) {
      detailUrl = `company-recruit.html?id=${encodeURIComponent(job.companyDomain.trim())}`;
    }
  } else {
    // LPページへリンク（求人IDがある場合）、なければ採用ページへ
    if (job.companyDomain?.trim() && jobId) {
      detailUrl = `lp.html?j=${encodeURIComponent(job.companyDomain.trim())}_${encodeURIComponent(jobId)}`;
    } else if (job.companyDomain?.trim()) {
      detailUrl = `company-recruit.html?id=${encodeURIComponent(job.companyDomain.trim())}`;
    } else if (job.detailUrl) {
      detailUrl = job.detailUrl;
    }
  }

  // 動画ボタンのHTML（動画URLがある場合のみ表示）
  const videoButtonHtml = showVideoButton ? `
    <button type="button" class="btn-job-video" data-video-url="${escapeHtml(videoUrl)}" title="動画で求人を見る">
      <span class="btn-job-video-icon">▶</span>
      <span class="btn-job-video-text">動画を見る</span>
    </button>
  ` : '';

  // 表示するタイトル（titleがなければcompanyをフォールバック）
  const displayTitle = job.title || job.company || '';
  // 会社名はtitleがある場合のみ別途表示（重複防止）
  const displayCompanyName = showCompanyName && job.title && job.company ? job.company : '';

  // 画像表示: 画像があれば表示、なければデフォルト画像
  // linkToJobsList=true は会社カード、false は求人カード
  const defaultLogoUrl = linkToJobsList
    ? '/images/default-company-logo.webp'
    : '/images/default-job-logo.webp';
  const imageHtml = Image({
    src: hasImage ? imageSrc : defaultLogoUrl,
    alt: job.company || displayTitle,
    fallback: defaultLogoUrl
  });

  return `
    <article class="job-card${isNew ? ' is-new' : ''}${showVideoButton ? ' has-video' : ''}" data-job-id="${escapeHtml(job.id || '')}">
      ${newTagHtml}
      <div class="job-card-image">
        ${imageHtml}
      </div>
      <div class="job-card-body">
        ${displayCompanyName ? `<p class="job-company-name">${escapeHtml(displayCompanyName)}</p>` : ''}
        <h3 class="job-title">${escapeHtml(displayTitle)}</h3>
        <p class="job-location">${escapeHtml(job.companyAddress || job.location || '')}</p>
        ${job.access ? `<p class="job-access">${escapeHtml(job.access)}</p>` : ''}
        ${salaryDisplay.value ? `
        <div class="job-benefits">
          <div class="benefit-item">
            <span class="benefit-label">${escapeHtml(salaryDisplay.label)}</span>
            <span class="benefit-value">${escapeHtml(salaryDisplay.value)}</span>
          </div>
        </div>
        ` : ''}
        ${TagList({ tags: features, className: 'job-features' })}
        <div class="job-card-actions">
          ${Button({ text: '詳細を見る', href: detailUrl, className: 'btn-apply' })}
          ${videoButtonHtml}
        </div>
      </div>
    </article>
  `;
}

// 会社ページ用求人カード（シンプル版）
export function CompanyJobCard({ job }) {
  // displayedFeaturesが設定されている場合はそれを優先表示
  const displayedFeaturesRaw = job.displayedFeatures || '';
  const displayedFeatures = displayedFeaturesRaw
    ? displayedFeaturesRaw.split(',').map(f => f.trim()).filter(f => f)
    : [];

  const allFeaturesRaw = job.features || '';
  const allFeatures = Array.isArray(allFeaturesRaw)
    ? allFeaturesRaw
    : (allFeaturesRaw ? allFeaturesRaw.split(',').map(f => f.trim()).filter(f => f) : []);

  // displayedFeaturesがあればそれを使用、なければallFeaturesの最初の3つ
  const features = displayedFeatures.length > 0 ? displayedFeatures.slice(0, 3) : allFeatures.slice(0, 3);

  let shortDesc = '';
  if (job.jobDescription) {
    shortDesc = job.jobDescription.length > 100
      ? job.jobDescription.substring(0, 100) + '...'
      : job.jobDescription;
  }

  const detailUrl = `job-detail.html?company=${encodeURIComponent(job.companyDomain || '')}&job=${encodeURIComponent(job.id || '')}`;

  return `
    <div class="job-list-card">
      <div class="job-list-card-header">
        <h3 class="job-list-title">
          <a href="${detailUrl}">${escapeHtml(job.title)}</a>
        </h3>
      </div>
      <div class="job-list-card-body">
        <ul class="job-list-info">
          <li><span class="info-label">勤務地</span><span class="info-value">${escapeHtml(job.location)}</span></li>
          ${job.access ? `<li><span class="info-label">アクセス</span><span class="info-value">${escapeHtml(job.access)}</span></li>` : ''}
          <li><span class="info-label">給与</span><span class="info-value">${escapeHtml(job.monthlySalary || job.salary || '')}</span></li>
          <li><span class="info-label">雇用形態</span><span class="info-value">${escapeHtml(job.employmentType || '')}</span></li>
          ${job.totalBonus ? `<li><span class="info-label">特典総額</span><span class="info-value highlight">${escapeHtml(job.totalBonus)}</span></li>` : ''}
        </ul>
        ${features.length > 0 ? `
          <div class="job-list-tags">
            ${features.map(f => `<span class="job-tag">${escapeHtml(f)}</span>`).join('')}
          </div>
        ` : ''}
        ${shortDesc ? `<p class="job-list-desc">${escapeHtml(shortDesc)}</p>` : ''}
      </div>
      <div class="job-list-card-footer">
        ${Button({ text: '詳細を見る', href: detailUrl, className: 'btn-detail' })}
      </div>
    </div>
  `;
}

// 勤務地カード
export function LocationCard({ location }) {
  return `
    <a href="location.html?prefecture=${encodeURIComponent(location.prefecture)}" class="location-item" data-prefecture="${escapeHtml(location.prefecture)}">
      <span class="location-name">${escapeHtml(location.prefecture)}</span>
      <span class="location-count">${location.count}件</span>
    </a>
  `;
}

// ポイントカード
export function PointCard({ number, icon, label, value, isHighlight = false }) {
  return `
    <div class="lp-point-card${isHighlight ? ' accent' : ''}">
      ${number ? `<div class="lp-point-number">${number}</div>` : ''}
      ${icon ? `<div class="lp-point-icon">${icon}</div>` : ''}
      <div class="lp-point-content">
        <span class="lp-point-label">${escapeHtml(label)}</span>
        <span class="lp-point-value">${escapeHtml(value)}</span>
      </div>
    </div>
  `;
}

// 詳細テーブル行
export function DetailRow({ label, value }) {
  if (!value) return '';
  return `
    <div class="lp-detail-row">
      <div class="lp-detail-label">${escapeHtml(label)}</div>
      <div class="lp-detail-value">${nl2br(value)}</div>
    </div>
  `;
}

// FAQアイテム
export function FAQItem({ question, answer, id }) {
  return `
    <div class="lp-faq-item">
      <button class="lp-faq-question" aria-expanded="false" aria-controls="faq-answer-${id}">
        <span class="lp-faq-icon">Q</span>
        <span>${escapeHtml(question)}</span>
        <span class="lp-faq-toggle">+</span>
      </button>
      <div class="lp-faq-answer" id="faq-answer-${id}">
        <span class="lp-faq-icon">A</span>
        <span>${nl2br(answer)}</span>
      </div>
    </div>
  `;
}

// モーダル
export function Modal({ className = 'modal', title = '', content = '' }) {
  return `
    <div class="${className}">
      <div class="${className}-overlay"></div>
      <div class="${className}-content">
        <button class="${className}-close">${Icons.close}</button>
        ${title ? `<h3>${escapeHtml(title)}</h3>` : ''}
        <div class="${className}-body">${content}</div>
      </div>
    </div>
  `;
}

// 検索パネル
export function SearchPanel({ id, isActive = false, content }) {
  return `
    <div id="${id}" class="search-panel${isActive ? ' active' : ''}">
      ${content}
    </div>
  `;
}

// 統計カード
export function StatCard({ value, label, icon = null }) {
  return `
    <div class="stat-card">
      ${icon ? `<div class="stat-icon">${icon}</div>` : ''}
      <div class="stat-value">${escapeHtml(String(value))}</div>
      <div class="stat-label">${escapeHtml(label)}</div>
    </div>
  `;
}

// パンくずリスト
export function Breadcrumb({ items }) {
  return `
    <nav class="breadcrumb" aria-label="パンくずリスト">
      <ol>
        ${items.map((item, index) => {
          const isLast = index === items.length - 1;
          if (isLast) {
            return `<li aria-current="page">${escapeHtml(item.text)}</li>`;
          }
          return `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.text)}</a></li>`;
        }).join('')}
      </ol>
    </nav>
  `;
}
