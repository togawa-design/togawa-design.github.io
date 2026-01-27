/**
 * カルーセルセクションコンポーネント
 * 画像をスライダー形式で表示（登録・編集・削除対応）
 */
import { escapeHtml } from '@shared/utils.js';

/**
 * カルーセルセクションをレンダリング
 * @param {Object} section - セクション設定
 * @param {Object} context - 描画コンテキスト
 * @returns {string} HTML文字列
 */
export function renderCarouselSection(section, context) {
  const { data, layout } = section;
  const images = data?.images || [];
  const sectionTitle = data?.sectionTitle || '';
  const autoPlay = data?.autoPlay !== false;
  const interval = data?.interval || 5000;
  const style = layout?.style || 'standard';
  const showDots = layout?.showDots !== false;
  const showArrows = layout?.showArrows !== false;

  if (images.length === 0) {
    return `
      <section class="lp-carousel lp-carousel-empty" data-section-id="${section.id}">
        <div class="lp-section-inner">
          ${sectionTitle ? `<h2 class="lp-section-title">${escapeHtml(sectionTitle)}</h2>` : ''}
          <div class="lp-carousel-placeholder">
            <p>画像が登録されていません</p>
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="lp-carousel lp-carousel-${style}" data-section-id="${section.id}">
      <div class="lp-section-inner">
        ${sectionTitle ? `<h2 class="lp-section-title">${escapeHtml(sectionTitle)}</h2>` : ''}
        <div class="lp-carousel-container"
             data-autoplay="${autoPlay}"
             data-interval="${interval}">
          <div class="lp-carousel-track">
            ${images.map((image, idx) => renderCarouselSlide(image, idx, images.length)).join('')}
          </div>
          ${showArrows && images.length > 1 ? `
            <button type="button" class="lp-carousel-btn lp-carousel-prev" aria-label="前の画像">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15,18 9,12 15,6"></polyline>
              </svg>
            </button>
            <button type="button" class="lp-carousel-btn lp-carousel-next" aria-label="次の画像">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9,6 15,12 9,18"></polyline>
              </svg>
            </button>
          ` : ''}
        </div>
        ${showDots && images.length > 1 ? `
          <div class="lp-carousel-dots">
            ${images.map((_, idx) => `
              <button type="button"
                      class="lp-carousel-dot ${idx === 0 ? 'active' : ''}"
                      data-index="${idx}"
                      aria-label="画像${idx + 1}を表示">
              </button>
            `).join('')}
          </div>
        ` : ''}
        <div class="lp-carousel-counter">
          <span class="lp-carousel-current">1</span> / <span class="lp-carousel-total">${images.length}</span>
        </div>
      </div>
    </section>
  `;
}

/**
 * カルーセルスライドをレンダリング
 */
function renderCarouselSlide(image, idx, total) {
  const src = typeof image === 'string' ? image : image.url;
  const alt = typeof image === 'object' ? (image.alt || image.caption || `画像 ${idx + 1}`) : `画像 ${idx + 1}`;
  const caption = typeof image === 'object' ? image.caption : '';

  return `
    <div class="lp-carousel-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
      <div class="lp-carousel-slide-inner">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="${idx === 0 ? 'eager' : 'lazy'}">
        ${caption ? `<div class="lp-carousel-caption">${escapeHtml(caption)}</div>` : ''}
      </div>
    </div>
  `;
}

/**
 * カルーセルを初期化（クライアントサイド）
 */
export function initCarousels() {
  document.querySelectorAll('.lp-carousel-container').forEach(container => {
    const track = container.querySelector('.lp-carousel-track');
    const slides = container.querySelectorAll('.lp-carousel-slide');
    const prevBtn = container.querySelector('.lp-carousel-prev');
    const nextBtn = container.querySelector('.lp-carousel-next');
    const section = container.closest('.lp-carousel');
    const dots = section?.querySelectorAll('.lp-carousel-dot');
    const currentEl = section?.querySelector('.lp-carousel-current');

    if (slides.length <= 1) return;

    let currentIndex = 0;
    let autoPlayTimer = null;
    const autoPlay = container.dataset.autoplay === 'true';
    const interval = parseInt(container.dataset.interval) || 5000;

    function goToSlide(index) {
      if (index < 0) index = slides.length - 1;
      if (index >= slides.length) index = 0;

      slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
      });

      dots?.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
      });

      if (currentEl) {
        currentEl.textContent = index + 1;
      }

      currentIndex = index;
    }

    function nextSlide() {
      goToSlide(currentIndex + 1);
    }

    function prevSlide() {
      goToSlide(currentIndex - 1);
    }

    function startAutoPlay() {
      if (autoPlay && !autoPlayTimer) {
        autoPlayTimer = setInterval(nextSlide, interval);
      }
    }

    function stopAutoPlay() {
      if (autoPlayTimer) {
        clearInterval(autoPlayTimer);
        autoPlayTimer = null;
      }
    }

    // イベントリスナー
    prevBtn?.addEventListener('click', () => {
      prevSlide();
      stopAutoPlay();
      startAutoPlay();
    });

    nextBtn?.addEventListener('click', () => {
      nextSlide();
      stopAutoPlay();
      startAutoPlay();
    });

    dots?.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        goToSlide(idx);
        stopAutoPlay();
        startAutoPlay();
      });
    });

    // タッチ/スワイプ対応
    let touchStartX = 0;
    let touchEndX = 0;

    container.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      stopAutoPlay();
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
      startAutoPlay();
    }, { passive: true });

    // ホバーで一時停止
    container.addEventListener('mouseenter', stopAutoPlay);
    container.addEventListener('mouseleave', startAutoPlay);

    // 自動再生開始
    startAutoPlay();
  });
}

export default renderCarouselSection;
