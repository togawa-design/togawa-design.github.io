/**
 * 社員の声セクションコンポーネント
 */
import { escapeHtml } from '@shared/utils.js';

/**
 * 社員の声セクションをレンダリング
 * @param {Object} section - セクション設定
 * @param {Object} context - 描画コンテキスト
 * @returns {string} HTML文字列
 */
export function renderTestimonialSection(section, context) {
  const { data, layout } = section;
  const testimonials = data?.testimonials || [];
  const sectionTitle = data?.sectionTitle || '社員の声';
  const style = layout?.style || 'cards';

  if (testimonials.length === 0) return '';

  const styleRenderers = {
    cards: renderCardsStyle,
    list: renderListStyle,
    slider: renderSliderStyle
  };

  const renderer = styleRenderers[style] || renderCardsStyle;
  return renderer(section.id, sectionTitle, testimonials);
}

/**
 * カードスタイル
 */
function renderCardsStyle(sectionId, title, testimonials) {
  return `
    <section class="lp-testimonial lp-testimonial-cards" data-section-id="${sectionId}">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">${escapeHtml(title)}</h2>
        <div class="lp-testimonial-grid">
          ${testimonials.map(t => renderTestimonialCard(t)).join('')}
        </div>
      </div>
    </section>
  `;
}

/**
 * リストスタイル
 */
function renderListStyle(sectionId, title, testimonials) {
  return `
    <section class="lp-testimonial lp-testimonial-list" data-section-id="${sectionId}">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">${escapeHtml(title)}</h2>
        <div class="lp-testimonial-items">
          ${testimonials.map((t, idx) => renderTestimonialListItem(t, idx)).join('')}
        </div>
      </div>
    </section>
  `;
}

/**
 * スライダースタイル
 */
function renderSliderStyle(sectionId, title, testimonials) {
  return `
    <section class="lp-testimonial lp-testimonial-slider" data-section-id="${sectionId}">
      <div class="lp-section-inner">
        <h2 class="lp-section-title">${escapeHtml(title)}</h2>
        <div class="lp-testimonial-slider-container">
          <div class="lp-testimonial-slider-track">
            ${testimonials.map((t, idx) => renderTestimonialSlide(t, idx)).join('')}
          </div>
          <button class="lp-testimonial-slider-prev" aria-label="前へ">&#10094;</button>
          <button class="lp-testimonial-slider-next" aria-label="次へ">&#10095;</button>
        </div>
        <div class="lp-testimonial-slider-dots">
          ${testimonials.map((_, idx) => `<button class="lp-testimonial-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}" aria-label="社員${idx + 1}"></button>`).join('')}
        </div>
      </div>
    </section>
  `;
}

/**
 * カード形式のアイテム
 */
function renderTestimonialCard(testimonial) {
  const { name, role, department, quote, avatar, yearsWorked } = testimonial;

  return `
    <div class="lp-testimonial-card">
      <div class="lp-testimonial-quote-mark">"</div>
      <p class="lp-testimonial-quote">${escapeHtml(quote || '')}</p>
      <div class="lp-testimonial-author">
        ${avatar ? `
          <div class="lp-testimonial-avatar">
            <img src="${escapeHtml(avatar)}" alt="${escapeHtml(name || '')}" loading="lazy">
          </div>
        ` : `
          <div class="lp-testimonial-avatar lp-testimonial-avatar-placeholder">
            <span>${getInitials(name)}</span>
          </div>
        `}
        <div class="lp-testimonial-info">
          <p class="lp-testimonial-name">${escapeHtml(name || '匿名')}</p>
          ${role || department ? `
            <p class="lp-testimonial-role">
              ${department ? escapeHtml(department) : ''}${department && role ? ' / ' : ''}${role ? escapeHtml(role) : ''}
            </p>
          ` : ''}
          ${yearsWorked ? `<p class="lp-testimonial-years">勤続${escapeHtml(yearsWorked)}</p>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * リスト形式のアイテム
 */
function renderTestimonialListItem(testimonial, idx) {
  const { name, role, department, quote, avatar, yearsWorked } = testimonial;
  const isEven = idx % 2 === 0;

  return `
    <div class="lp-testimonial-list-item ${isEven ? '' : 'lp-testimonial-reverse'}">
      <div class="lp-testimonial-list-avatar">
        ${avatar ? `
          <img src="${escapeHtml(avatar)}" alt="${escapeHtml(name || '')}" loading="lazy">
        ` : `
          <div class="lp-testimonial-avatar-placeholder">
            <span>${getInitials(name)}</span>
          </div>
        `}
      </div>
      <div class="lp-testimonial-list-content">
        <div class="lp-testimonial-list-header">
          <p class="lp-testimonial-name">${escapeHtml(name || '匿名')}</p>
          ${role || department ? `
            <p class="lp-testimonial-role">
              ${department ? escapeHtml(department) : ''}${department && role ? ' / ' : ''}${role ? escapeHtml(role) : ''}
            </p>
          ` : ''}
          ${yearsWorked ? `<p class="lp-testimonial-years">勤続${escapeHtml(yearsWorked)}</p>` : ''}
        </div>
        <p class="lp-testimonial-quote">${escapeHtml(quote || '')}</p>
      </div>
    </div>
  `;
}

/**
 * スライダー形式のアイテム
 */
function renderTestimonialSlide(testimonial, idx) {
  const { name, role, department, quote, avatar, yearsWorked } = testimonial;

  return `
    <div class="lp-testimonial-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
      <div class="lp-testimonial-slide-inner">
        <div class="lp-testimonial-quote-mark">"</div>
        <p class="lp-testimonial-quote">${escapeHtml(quote || '')}</p>
        <div class="lp-testimonial-author">
          ${avatar ? `
            <div class="lp-testimonial-avatar">
              <img src="${escapeHtml(avatar)}" alt="${escapeHtml(name || '')}">
            </div>
          ` : `
            <div class="lp-testimonial-avatar lp-testimonial-avatar-placeholder">
              <span>${getInitials(name)}</span>
            </div>
          `}
          <div class="lp-testimonial-info">
            <p class="lp-testimonial-name">${escapeHtml(name || '匿名')}</p>
            ${role || department ? `
              <p class="lp-testimonial-role">
                ${department ? escapeHtml(department) : ''}${department && role ? ' / ' : ''}${role ? escapeHtml(role) : ''}
              </p>
            ` : ''}
            ${yearsWorked ? `<p class="lp-testimonial-years">勤続${escapeHtml(yearsWorked)}</p>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 名前からイニシャルを取得
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(/[\s　]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2);
}

export default renderTestimonialSection;
