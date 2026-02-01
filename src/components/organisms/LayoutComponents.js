/**
 * 共通レイアウトコンポーネント
 * ヘッダー、フッター、CTAバー
 */
import { escapeHtml } from '@shared/utils.js';

/**
 * サイトヘッダーをレンダリング
 * @param {Object} options - オプション
 * @param {string} options.logoUrl - ロゴ画像URL
 * @param {string} options.companyName - 会社名表示
 * @param {string} options.recruitPageUrl - 採用ページURL（戻るリンク用）
 * @param {boolean} options.showBackLink - 戻るリンクを表示するか
 * @param {string} options.designPattern - デザインパターン
 */
export function renderSiteHeader(options = {}) {
  const {
    logoUrl = '',
    companyName = '',
    recruitPageUrl = '',
    showBackLink = false,
    designPattern = 'standard'
  } = options;

  // ロゴまたは会社名がない場合はヘッダーを表示しない
  if (!logoUrl && !companyName) {
    return '';
  }

  const logoContent = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}" class="site-header-logo-img">`
    : '';

  const nameContent = companyName
    ? `<span class="site-header-company-name">${escapeHtml(companyName)}</span>`
    : '';

  const backLink = showBackLink && recruitPageUrl
    ? `<a href="${escapeHtml(recruitPageUrl)}" class="site-header-back-link">← 採用ページへ戻る</a>`
    : '';

  return `
    <header class="site-header" data-pattern="${escapeHtml(designPattern)}">
      <div class="site-header-container">
        <a href="${recruitPageUrl ? escapeHtml(recruitPageUrl) : '#'}" class="site-header-logo">
          ${logoContent}
          ${nameContent}
        </a>
        <nav class="site-header-nav">
          ${backLink}
          <a href="#jobs" class="site-header-nav-link">求人一覧</a>
        </nav>
      </div>
    </header>
  `;
}

/**
 * サイトフッターをレンダリング
 * @param {Object} options - オプション
 * @param {string} options.companyName - 会社名
 * @param {string} options.designPattern - デザインパターン
 */
export function renderSiteFooter(options = {}) {
  const {
    companyName = '',
    designPattern = 'standard'
  } = options;

  const year = new Date().getFullYear();

  return `
    <footer class="site-footer" data-pattern="${escapeHtml(designPattern)}">
      <div class="site-footer-container">
        <p class="site-footer-company">${escapeHtml(companyName)} 採用情報</p>
        <p class="site-footer-copyright">&copy; ${year} ${escapeHtml(companyName)}</p>
      </div>
    </footer>
  `;
}

/**
 * 固定CTAバーをレンダリング
 * @param {Object} options - オプション
 * @param {string} options.phoneNumber - 電話番号
 * @param {string} options.ctaButtonText - CTAボタンテキスト
 * @param {string} options.ctaUrl - CTAボタンのリンク先
 * @param {string} options.designPattern - デザインパターン
 */
export function renderFixedCtaBar(options = {}) {
  const {
    phoneNumber = '',
    ctaButtonText = '今すぐ応募する',
    ctaUrl = '#apply',
    designPattern = 'standard'
  } = options;

  // 電話番号もCTAボタンもない場合は表示しない
  if (!phoneNumber && !ctaButtonText) {
    return '';
  }

  const phoneLink = phoneNumber
    ? `<a href="tel:${escapeHtml(phoneNumber.replace(/[-\s]/g, ''))}" class="fixed-cta-phone">
         <span class="fixed-cta-phone-icon">📞</span>
         <span class="fixed-cta-phone-text">お電話で相談：${escapeHtml(phoneNumber)}</span>
       </a>`
    : '';

  const ctaButton = ctaButtonText
    ? `<a href="${escapeHtml(ctaUrl)}" class="fixed-cta-button">${escapeHtml(ctaButtonText)}</a>`
    : '';

  return `
    <div class="fixed-cta-bar" data-pattern="${escapeHtml(designPattern)}">
      ${phoneLink}
      ${ctaButton}
    </div>
  `;
}

/**
 * body要素に必要なpadding/marginを追加するためのクラス名を返す
 * ヘッダーとCTAバーがある場合に適切なスペースを確保
 */
export function getLayoutBodyClasses(options = {}) {
  const classes = [];

  if (options.hasHeader) {
    classes.push('has-fixed-header');
  }

  if (options.hasCtaBar) {
    classes.push('has-fixed-cta-bar');
  }

  return classes.join(' ');
}

export default {
  renderSiteHeader,
  renderSiteFooter,
  renderFixedCtaBar,
  getLayoutBodyClasses
};
