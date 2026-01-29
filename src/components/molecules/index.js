/**
 * Molecules - Atomsを組み合わせた複合コンポーネント
 */

import { escapeHtml, nl2br } from '@shared/utils.js';
import { Badge, Button, Icons, TagList, Image } from '@components/atoms/index.js';

// 求人カード
export function JobCard({ job, showCompanyName = false, linkToJobsList = false }) {
  const badges = job.badges ? job.badges.split(',').map(b => b.trim()) : [];
  const features = Array.isArray(job.features) ? job.features : [];
  const imageSrc = job.imageUrl?.trim() || 'images/default-job.svg';
  const totalBonus = job._displayTotalBonus || job.totalBonus || '';
  const monthlySalary = job._displayMonthlySalary || job.monthlySalary || '';

  let badgesHtml = '';
  if (badges.includes('NEW') || badges.includes('new')) {
    badgesHtml += Badge({ text: 'NEW', type: 'new' });
  }
  if (badges.includes('人気') || badges.includes('hot')) {
    badgesHtml += Badge({ text: '人気', type: 'hot' });
  }
  if (badges.includes('急募') || badges.includes('URGENT')) {
    badgesHtml += Badge({ text: '急募', type: 'urgent' });
  }

  // linkToJobsList が true の場合は企業の求人一覧ページへ、それ以外は求人詳細ページへ
  let detailUrl = 'jobs.html';
  if (linkToJobsList) {
    // 企業の求人一覧ページへリンク
    if (job.companyDomain?.trim()) {
      detailUrl = `company.html?id=${encodeURIComponent(job.companyDomain.trim())}`;
    }
  } else {
    if (job.companyDomain?.trim() && job.id) {
      detailUrl = `job-detail.html?company=${encodeURIComponent(job.companyDomain.trim())}&job=${encodeURIComponent(job.id)}`;
    } else if (job.companyDomain?.trim()) {
      detailUrl = `company.html?id=${encodeURIComponent(job.companyDomain.trim())}`;
    } else if (job.detailUrl) {
      detailUrl = job.detailUrl;
    }
  }

  return `
    <article class="job-card" data-job-id="${escapeHtml(job.id || '')}">
      ${badgesHtml ? `<div class="job-card-header">${badgesHtml}</div>` : ''}
      <div class="job-card-image">
        ${Image({ src: imageSrc, alt: job.company || job.title, fallback: job.company })}
      </div>
      <div class="job-card-body">
        ${showCompanyName ? `<p class="job-company-name">${escapeHtml(job.company || '')}</p>` : ''}
        <h3 class="job-title">${escapeHtml(job.title)}</h3>
        <p class="job-location">${escapeHtml(job.companyAddress || job.location || '')}</p>
        <div class="job-benefits">
          ${totalBonus ? `
            <div class="benefit-item highlight">
              <span class="benefit-label">特典総額</span>
              <span class="benefit-value">${escapeHtml(totalBonus)}</span>
            </div>
          ` : ''}
          <div class="benefit-item">
            <span class="benefit-label">月収例</span>
            <span class="benefit-value">${escapeHtml(monthlySalary)}</span>
          </div>
        </div>
        ${TagList({ tags: features, className: 'job-features' })}
        ${Button({ text: '詳細を見る', href: detailUrl, className: 'btn-apply' })}
      </div>
    </article>
  `;
}

// 会社ページ用求人カード（シンプル版）
export function CompanyJobCard({ job }) {
  const features = Array.isArray(job.features) ? job.features : [];
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
