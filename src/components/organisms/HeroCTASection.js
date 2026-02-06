/**
 * ヒーローCTAセクションコンポーネント
 * ヒーローセクション直後に表示される応募ボタン・動画ボタンのセクション
 */
import { escapeHtml } from '@shared/utils.js';

/**
 * ヒーローCTAセクションを描画
 * @param {Object} options - オプション
 * @param {boolean} options.showVideoButton - 動画ボタンを表示するか
 * @param {string} options.videoUrl - 動画URL（YouTube等）
 * @param {string} options.applyButtonText - 応募ボタンテキスト
 * @param {string} options.videoButtonText - 動画ボタンテキスト
 * @param {string} layoutStyle - レイアウトスタイル
 */
export function renderHeroCTASection(options = {}, layoutStyle = 'modern') {
  const {
    showVideoButton = false,
    videoUrl = '',
    applyButtonText = '今すぐ応募する',
    videoButtonText = '求人内容を動画で見る'
  } = options;

  // 動画ボタンを表示するかどうか
  const shouldShowVideo = showVideoButton && videoUrl;

  // 動画IDを抽出（YouTube対応）
  const videoId = extractVideoId(videoUrl);
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : '';

  return `
    <section class="lp-hero-cta-section lp-layout-${layoutStyle}">
      <div class="lp-hero-cta-buttons">
        <a href="#lp-apply" class="lp-hero-cta-btn lp-hero-cta-btn--apply">
          <span class="lp-hero-cta-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
          </span>
          <span class="lp-hero-cta-text">${escapeHtml(applyButtonText)}</span>
        </a>
        ${shouldShowVideo ? `
        <button type="button" class="lp-hero-cta-btn lp-hero-cta-btn--video" data-video-url="${escapeHtml(embedUrl)}">
          <span class="lp-hero-cta-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </span>
          <span class="lp-hero-cta-text">求人内容を<br>動画で見る</span>
        </button>
        ` : ''}
      </div>
    </section>

    ${shouldShowVideo ? `
    <div class="lp-video-modal" id="lp-video-modal">
      <div class="lp-video-modal-overlay"></div>
      <div class="lp-video-modal-content">
        <button type="button" class="lp-video-modal-close" aria-label="閉じる">&times;</button>
        <div class="lp-video-modal-player">
          <iframe id="lp-video-iframe" src="" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
      </div>
    </div>
    ` : ''}
  `;
}

/**
 * YouTube等の動画URLからIDを抽出
 */
function extractVideoId(url) {
  if (!url) return null;

  // YouTube標準URL: https://www.youtube.com/watch?v=VIDEO_ID
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) return youtubeMatch[1];

  // 短縮URL: https://youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  return null;
}

/**
 * 動画モーダルの初期化
 * DOM読み込み後に呼び出す
 */
export function initVideoModal() {
  // 動画ボタンのクリックイベント
  document.querySelectorAll('.lp-hero-cta-btn--video').forEach(btn => {
    btn.addEventListener('click', () => {
      const videoUrl = btn.dataset.videoUrl;
      openVideoModal(videoUrl);
    });
  });

  // モーダルを閉じるイベント
  const modal = document.getElementById('lp-video-modal');
  if (modal) {
    const overlay = modal.querySelector('.lp-video-modal-overlay');
    const closeBtn = modal.querySelector('.lp-video-modal-close');

    if (overlay) {
      overlay.addEventListener('click', closeVideoModal);
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', closeVideoModal);
    }

    // ESCキーで閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeVideoModal();
      }
    });
  }
}

/**
 * 動画モーダルを開く
 */
function openVideoModal(videoUrl) {
  const modal = document.getElementById('lp-video-modal');
  const iframe = document.getElementById('lp-video-iframe');

  if (modal && iframe && videoUrl) {
    iframe.src = videoUrl;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

/**
 * 動画モーダルを閉じる
 */
function closeVideoModal() {
  const modal = document.getElementById('lp-video-modal');
  const iframe = document.getElementById('lp-video-iframe');

  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';

    // 動画を停止
    if (iframe) {
      iframe.src = '';
    }
  }
}

export default renderHeroCTASection;
