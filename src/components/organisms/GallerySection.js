/**
 * ギャラリーセクションコンポーネント
 * 複数画像をグリッド表示
 */
import { escapeHtml } from '@shared/utils.js';

/**
 * ギャラリーセクションをレンダリング
 * @param {Object} section - セクション設定
 * @param {Object} context - 描画コンテキスト
 * @returns {string} HTML文字列
 */
export function renderGallerySection(section, context) {
  const { data, layout } = section;
  const images = data?.images || [];
  const sectionTitle = data?.sectionTitle || '';
  const columns = layout?.columns || 3;
  const style = layout?.style || 'grid';

  if (images.length === 0) return '';

  const styleRenderers = {
    grid: renderGridGallery,
    masonry: renderMasonryGallery,
    slider: renderSliderGallery
  };

  const renderer = styleRenderers[style] || renderGridGallery;
  return renderer(section.id, sectionTitle, images, columns);
}

/**
 * グリッドギャラリー
 */
function renderGridGallery(sectionId, title, images, columns) {
  return `
    <section class="lp-gallery lp-gallery-grid" data-section-id="${sectionId}">
      <div class="lp-section-inner">
        ${title ? `<h2 class="lp-section-title">${escapeHtml(title)}</h2>` : ''}
        <div class="lp-gallery-items cols-${columns}">
          ${images.map((image, idx) => renderGalleryItem(image, idx)).join('')}
        </div>
      </div>
    </section>
  `;
}

/**
 * メイソンリーギャラリー
 */
function renderMasonryGallery(sectionId, title, images, columns) {
  return `
    <section class="lp-gallery lp-gallery-masonry" data-section-id="${sectionId}">
      <div class="lp-section-inner">
        ${title ? `<h2 class="lp-section-title">${escapeHtml(title)}</h2>` : ''}
        <div class="lp-gallery-masonry-grid cols-${columns}">
          ${images.map((image, idx) => renderMasonryItem(image, idx)).join('')}
        </div>
      </div>
    </section>
  `;
}

/**
 * スライダーギャラリー
 */
function renderSliderGallery(sectionId, title, images, columns) {
  return `
    <section class="lp-gallery lp-gallery-slider" data-section-id="${sectionId}">
      <div class="lp-section-inner">
        ${title ? `<h2 class="lp-section-title">${escapeHtml(title)}</h2>` : ''}
        <div class="lp-gallery-slider-container">
          <div class="lp-gallery-slider-track">
            ${images.map((image, idx) => renderSliderItem(image, idx)).join('')}
          </div>
          <button class="lp-gallery-slider-prev" aria-label="前へ">&#10094;</button>
          <button class="lp-gallery-slider-next" aria-label="次へ">&#10095;</button>
        </div>
        <div class="lp-gallery-slider-dots">
          ${images.map((_, idx) => `<button class="lp-gallery-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}" aria-label="画像${idx + 1}"></button>`).join('')}
        </div>
      </div>
    </section>
  `;
}

/**
 * グリッドアイテム
 */
function renderGalleryItem(image, idx) {
  const src = typeof image === 'string' ? image : image.url;
  const alt = typeof image === 'object' ? (image.alt || image.caption || '') : '';
  const caption = typeof image === 'object' ? image.caption : '';

  return `
    <div class="lp-gallery-item" data-index="${idx}">
      <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">
      ${caption ? `<div class="lp-gallery-caption">${escapeHtml(caption)}</div>` : ''}
    </div>
  `;
}

/**
 * メイソンリーアイテム
 */
function renderMasonryItem(image, idx) {
  const src = typeof image === 'string' ? image : image.url;
  const alt = typeof image === 'object' ? (image.alt || image.caption || '') : '';
  const caption = typeof image === 'object' ? image.caption : '';

  return `
    <div class="lp-gallery-masonry-item" data-index="${idx}">
      <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">
      ${caption ? `<div class="lp-gallery-caption">${escapeHtml(caption)}</div>` : ''}
    </div>
  `;
}

/**
 * スライダーアイテム
 */
function renderSliderItem(image, idx) {
  const src = typeof image === 'string' ? image : image.url;
  const alt = typeof image === 'object' ? (image.alt || image.caption || '') : '';
  const caption = typeof image === 'object' ? image.caption : '';

  return `
    <div class="lp-gallery-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
      <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">
      ${caption ? `<div class="lp-gallery-slide-caption">${escapeHtml(caption)}</div>` : ''}
    </div>
  `;
}

export default renderGallerySection;
