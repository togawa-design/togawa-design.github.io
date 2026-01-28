/**
 * 動画セクションコンポーネント
 * YouTube, Vimeo, その他の動画埋め込み対応
 */
import { escapeHtml } from '@shared/utils.js';

/**
 * 動画セクションをレンダリング
 * @param {Object} section - セクション設定
 * @param {Object} context - 描画コンテキスト
 * @returns {string} HTML文字列
 */
export function renderVideoSection(section, context) {
  const { data, layout } = section;
  const sectionTitle = data?.sectionTitle || '';
  const videoUrl = data?.videoUrl || '';
  // URL自動検出を優先（YouTube/Vimeo等はX-Frame-Optionsで直接iframe不可のため）
  const detectedType = detectVideoType(videoUrl);
  const videoType = detectedType !== 'unknown' ? detectedType : (data?.videoType || 'iframe');
  const description = data?.description || '';
  const aspectRatio = layout?.aspectRatio || '16:9';
  const fullWidth = layout?.fullWidth || false;

  if (!videoUrl) {
    return `
      <section class="lp-video lp-video-empty" data-section-id="${section.id}">
        <div class="lp-section-inner">
          ${sectionTitle ? `<h2 class="lp-section-title">${escapeHtml(sectionTitle)}</h2>` : ''}
          <div class="lp-video-placeholder">
            <div class="lp-video-placeholder-icon">🎬</div>
            <p>動画URLが設定されていません</p>
          </div>
        </div>
      </section>
    `;
  }

  const embedHtml = generateEmbedHtml(videoUrl, videoType, aspectRatio);

  return `
    <section class="lp-video ${fullWidth ? 'lp-video-fullwidth' : ''}" data-section-id="${section.id}">
      <div class="lp-section-inner">
        ${sectionTitle ? `<h2 class="lp-section-title">${escapeHtml(sectionTitle)}</h2>` : ''}
        <div class="lp-video-wrapper lp-video-aspect-${aspectRatio.replace(':', '-')}">
          ${embedHtml}
        </div>
        ${description ? `<p class="lp-video-description">${escapeHtml(description)}</p>` : ''}
      </div>
    </section>
  `;
}

/**
 * 動画URLからタイプを検出
 */
function detectVideoType(url) {
  if (!url) return 'unknown';

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  }
  if (url.includes('vimeo.com')) {
    return 'vimeo';
  }
  if (url.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (url.match(/\.(mp4|webm|ogg)$/i)) {
    return 'direct';
  }

  return 'iframe';
}

/**
 * 埋め込みHTMLを生成
 */
function generateEmbedHtml(url, videoType, aspectRatio) {
  switch (videoType) {
    case 'youtube':
      return generateYouTubeEmbed(url);
    case 'vimeo':
      return generateVimeoEmbed(url);
    case 'tiktok':
      return generateTikTokEmbed(url);
    case 'direct':
      return generateDirectVideoEmbed(url);
    case 'iframe':
    default:
      return generateIframeEmbed(url);
  }
}

/**
 * YouTube埋め込み
 */
function generateYouTubeEmbed(url) {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return `<p class="lp-video-error">YouTubeのURLを認識できませんでした</p>`;
  }

  return `
    <iframe
      src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1"
      title="YouTube動画"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
      loading="lazy"
    ></iframe>
  `;
}

/**
 * YouTubeのIDを抽出
 */
function extractYouTubeId(url) {
  // youtube.com/watch?v=xxxxx
  let match = url.match(/[?&]v=([^&]+)/);
  if (match) return match[1];

  // youtu.be/xxxxx
  match = url.match(/youtu\.be\/([^?&]+)/);
  if (match) return match[1];

  // youtube.com/embed/xxxxx
  match = url.match(/youtube\.com\/embed\/([^?&]+)/);
  if (match) return match[1];

  // youtube.com/shorts/xxxxx
  match = url.match(/youtube\.com\/shorts\/([^?&]+)/);
  if (match) return match[1];

  return null;
}

/**
 * Vimeo埋め込み
 */
function generateVimeoEmbed(url) {
  const videoId = extractVimeoId(url);
  if (!videoId) {
    return `<p class="lp-video-error">VimeoのURLを認識できませんでした</p>`;
  }

  return `
    <iframe
      src="https://player.vimeo.com/video/${videoId}?title=0&byline=0&portrait=0"
      title="Vimeo動画"
      frameborder="0"
      allow="autoplay; fullscreen; picture-in-picture"
      allowfullscreen
      loading="lazy"
    ></iframe>
  `;
}

/**
 * VimeoのIDを抽出
 */
function extractVimeoId(url) {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
}

/**
 * TikTok埋め込み
 */
function generateTikTokEmbed(url) {
  // TikTokは動的読み込みが必要なためブロッカイート形式で表示
  return `
    <blockquote class="tiktok-embed" cite="${escapeHtml(url)}" data-video-id="">
      <section>
        <a target="_blank" href="${escapeHtml(url)}">TikTokで見る</a>
      </section>
    </blockquote>
    <script async src="https://www.tiktok.com/embed.js"></script>
  `;
}

/**
 * 直接動画ファイル埋め込み
 */
function generateDirectVideoEmbed(url) {
  const extension = url.split('.').pop().toLowerCase();
  const mimeTypes = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg'
  };
  const mimeType = mimeTypes[extension] || 'video/mp4';

  return `
    <video controls preload="metadata" playsinline>
      <source src="${escapeHtml(url)}" type="${mimeType}">
      <p>お使いのブラウザは動画の再生に対応していません。</p>
    </video>
  `;
}

/**
 * 汎用iframe埋め込み
 */
function generateIframeEmbed(url) {
  return `
    <iframe
      src="${escapeHtml(url)}"
      title="埋め込み動画"
      frameborder="0"
      allowfullscreen
      loading="lazy"
    ></iframe>
  `;
}

export default renderVideoSection;
