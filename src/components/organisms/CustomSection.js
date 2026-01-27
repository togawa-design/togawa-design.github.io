/**
 * カスタムセクションコンポーネント
 * 複数のレイアウトバリエーションに対応
 */
import { escapeHtml } from '@shared/utils.js';

/**
 * カスタムセクションをレンダリング
 * @param {Object} section - セクション設定
 * @param {Object} context - 描画コンテキスト
 * @returns {string} HTML文字列
 */
export function renderCustomSection(section, context) {
  const { data, layout } = section;
  const variant = layout?.variant || 'text-only';

  const variantRenderers = {
    'text-only': renderTextOnly,
    'image-only': renderImageOnly,
    'text-left-image-right': renderTextLeftImageRight,
    'text-right-image-left': renderTextRightImageLeft,
    'centered-with-button': renderCenteredWithButton,
    'full-width-banner': renderFullWidthBanner
  };

  const renderer = variantRenderers[variant] || renderTextOnly;
  return renderer(section, context);
}

/**
 * テキストのみバリエーション
 */
function renderTextOnly(section, context) {
  const { data } = section;

  return `
    <section class="lp-custom lp-custom-text-only" data-section-id="${section.id}">
      <div class="lp-section-inner">
        ${data.title ? `<h2 class="lp-section-title">${escapeHtml(data.title)}</h2>` : ''}
        ${data.content ? `<div class="lp-custom-content">${formatContent(data.content)}</div>` : ''}
        ${renderButton(data.button)}
      </div>
    </section>
  `;
}

/**
 * 画像のみバリエーション
 */
function renderImageOnly(section, context) {
  const { data } = section;

  if (!data.image) return '';

  return `
    <section class="lp-custom lp-custom-image-only" data-section-id="${section.id}">
      <div class="lp-section-inner">
        ${data.title ? `<h2 class="lp-section-title">${escapeHtml(data.title)}</h2>` : ''}
        <div class="lp-custom-image-container">
          <img src="${escapeHtml(data.image)}" alt="${escapeHtml(data.title || '')}" loading="lazy">
        </div>
        ${renderButton(data.button)}
      </div>
    </section>
  `;
}

/**
 * テキスト左・画像右バリエーション
 */
function renderTextLeftImageRight(section, context) {
  const { data } = section;

  return `
    <section class="lp-custom lp-custom-split lp-custom-text-left" data-section-id="${section.id}">
      <div class="lp-section-inner">
        <div class="lp-split-layout">
          <div class="lp-split-text">
            ${data.title ? `<h2 class="lp-custom-title">${escapeHtml(data.title)}</h2>` : ''}
            ${data.content ? `<div class="lp-custom-content">${formatContent(data.content)}</div>` : ''}
            ${renderButton(data.button)}
          </div>
          <div class="lp-split-image">
            ${data.image ? `<img src="${escapeHtml(data.image)}" alt="" loading="lazy">` : '<div class="lp-image-placeholder"></div>'}
          </div>
        </div>
      </div>
    </section>
  `;
}

/**
 * テキスト右・画像左バリエーション
 */
function renderTextRightImageLeft(section, context) {
  const { data } = section;

  return `
    <section class="lp-custom lp-custom-split lp-custom-text-right" data-section-id="${section.id}">
      <div class="lp-section-inner">
        <div class="lp-split-layout">
          <div class="lp-split-image">
            ${data.image ? `<img src="${escapeHtml(data.image)}" alt="" loading="lazy">` : '<div class="lp-image-placeholder"></div>'}
          </div>
          <div class="lp-split-text">
            ${data.title ? `<h2 class="lp-custom-title">${escapeHtml(data.title)}</h2>` : ''}
            ${data.content ? `<div class="lp-custom-content">${formatContent(data.content)}</div>` : ''}
            ${renderButton(data.button)}
          </div>
        </div>
      </div>
    </section>
  `;
}

/**
 * 中央揃え（ボタン付き）バリエーション
 */
function renderCenteredWithButton(section, context) {
  const { data } = section;

  return `
    <section class="lp-custom lp-custom-centered" data-section-id="${section.id}">
      <div class="lp-section-inner">
        ${data.title ? `<h2 class="lp-section-title">${escapeHtml(data.title)}</h2>` : ''}
        ${data.content ? `<div class="lp-custom-content">${formatContent(data.content)}</div>` : ''}
        ${data.image ? `
          <div class="lp-custom-image-centered">
            <img src="${escapeHtml(data.image)}" alt="" loading="lazy">
          </div>
        ` : ''}
        ${renderButton(data.button, 'centered')}
      </div>
    </section>
  `;
}

/**
 * フルワイドバナーバリエーション
 */
function renderFullWidthBanner(section, context) {
  const { data } = section;
  const bgStyle = data.image ? `background-image: url('${escapeHtml(data.image)}')` : '';

  return `
    <section class="lp-custom lp-custom-banner" data-section-id="${section.id}" style="${bgStyle}">
      <div class="lp-banner-overlay"></div>
      <div class="lp-section-inner">
        ${data.title ? `<h2 class="lp-banner-title">${escapeHtml(data.title)}</h2>` : ''}
        ${data.content ? `<div class="lp-banner-content">${formatContent(data.content)}</div>` : ''}
        ${renderButton(data.button, 'banner')}
      </div>
    </section>
  `;
}

/**
 * ボタンをレンダリング
 * @param {Object} button - ボタン設定
 * @param {string} variant - ボタンバリエーション
 * @returns {string} HTML文字列
 */
function renderButton(button, variant = '') {
  if (!button || !button.text) return '';

  const style = button.style || 'primary';
  const url = button.url || '#';
  const variantClass = variant ? `lp-btn-${variant}` : '';

  return `
    <div class="lp-custom-button-wrapper ${variantClass}">
      <a href="${escapeHtml(url)}" class="lp-btn lp-btn-${style}" ${button.newTab ? 'target="_blank" rel="noopener"' : ''}>
        ${escapeHtml(button.text)}
      </a>
    </div>
  `;
}

/**
 * コンテンツをフォーマット（簡易的なHTML許可）
 * @param {string} content - コンテンツ文字列
 * @returns {string} フォーマット済みHTML
 */
function formatContent(content) {
  if (!content) return '';

  // 改行を<br>に変換
  let formatted = escapeHtml(content).replace(/\n/g, '<br>');

  // 簡易的なマークダウン風の変換
  // **bold** → <strong>bold</strong>
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // *italic* → <em>italic</em>
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');

  return formatted;
}

export default renderCustomSection;
