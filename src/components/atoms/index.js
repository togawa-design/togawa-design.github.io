/**
 * Atoms - 最小単位のUIコンポーネント
 */

import { escapeHtml } from '@shared/utils.js';

// バッジコンポーネント
export function Badge({ text, type = 'default' }) {
  return `<span class="badge ${escapeHtml(type)}">${escapeHtml(text)}</span>`;
}

// ボタンコンポーネント
export function Button({ text, href, className = 'btn', target = '' }) {
  const targetAttr = target ? ` target="${escapeHtml(target)}"` : '';
  if (href) {
    return `<a href="${escapeHtml(href)}" class="${escapeHtml(className)}"${targetAttr}>${escapeHtml(text)}</a>`;
  }
  return `<button class="${escapeHtml(className)}">${escapeHtml(text)}</button>`;
}

// ローディングスピナー
export function LoadingSpinner({ message = '読み込み中...', subMessage = '' }) {
  return `
    <div class="loading-container">
      <div class="loading-inner">
        <div class="loading-spinner large"></div>
        <p class="loading-text">${escapeHtml(message)}</p>
        ${subMessage ? `<p class="loading-subtext">${escapeHtml(subMessage)}</p>` : ''}
      </div>
    </div>
  `;
}

// エラー表示
export function ErrorMessage({ message, buttonText = 'トップページへ戻る', buttonHref = '/' }) {
  return `
    <div class="error-container">
      <p class="error-message">${escapeHtml(message)}</p>
      <a href="${escapeHtml(buttonHref)}" class="btn-back">${escapeHtml(buttonText)}</a>
    </div>
  `;
}

// アイコン（SVG）
export const Icons = {
  location: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,

  money: `<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>`,

  wallet: `<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`,

  briefcase: `<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>`,

  phone: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`,

  close: `&times;`,

  check: `✓`,

  drag: `☰`
};

// 画像コンポーネント
export function Image({ src, alt, fallback, className = '' }) {
  const escapedSrc = escapeHtml(src);
  const escapedAlt = escapeHtml(alt);
  const escapedFallback = fallback ? escapeHtml(fallback) : '';

  const errorHandler = fallback
    ? `onerror="this.parentElement.innerHTML='<div class=\\'image-placeholder\\'>${escapedFallback}</div>'"`
    : `onerror="this.style.display='none'"`;

  return `<img src="${escapedSrc}" alt="${escapedAlt}" class="${className}" ${errorHandler}>`;
}

// タグリスト
export function TagList({ tags, className = 'tag-list' }) {
  if (!tags || tags.length === 0) return '';
  return `
    <ul class="${className}">
      ${tags.map(tag => `<li>${escapeHtml(tag)}</li>`).join('')}
    </ul>
  `;
}

// 統計数値
export function StatNumber({ value, label }) {
  return `
    <div class="stat-item">
      <span class="stat-number">${escapeHtml(String(value))}</span>
      <span class="stat-label">${escapeHtml(label)}</span>
    </div>
  `;
}
