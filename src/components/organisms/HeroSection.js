/**
 * ヒーローセクションコンポーネント
 * レイアウトスタイルに応じて異なるHTMLを出力
 */
import { escapeHtml } from '@shared/utils.js';

export function renderHeroSection(company, mainJob, lpSettings, layoutStyle = 'default') {
  const heroTitle = lpSettings.heroTitle || mainJob.title || `${company.company}で働こう`;
  const heroSubtitle = lpSettings.heroSubtitle || '';
  const heroImage = lpSettings.heroImage || company.imageUrl || '';

  // 特典情報を生成
  const highlights = [];
  if (mainJob.totalBonus) {
    highlights.push({ label: '特典総額', value: mainJob.totalBonus, icon: 'bonus' });
  }
  if (mainJob.monthlySalary) {
    highlights.push({ label: '月収例', value: mainJob.monthlySalary, icon: 'salary' });
  }

  // レイアウトスタイルに応じたレンダリング
  switch (layoutStyle) {
    case 'yellow':
      return renderYellowHero(company, heroTitle, heroSubtitle, heroImage, highlights);
    case 'impact':
      return renderImpactHero(company, heroTitle, heroSubtitle, heroImage, highlights);
    case 'trust':
      return renderTrustHero(company, heroTitle, heroSubtitle, heroImage, highlights);
    case 'athome':
      return renderAthomeHero(company, heroTitle, heroSubtitle, heroImage, highlights);
    case 'local':
      return renderLocalHero(company, heroTitle, heroSubtitle, heroImage, highlights);
    default:
      return renderDefaultHero(company, heroTitle, heroSubtitle, heroImage, highlights);
  }
}

// デフォルトヒーロー
function renderDefaultHero(company, heroTitle, heroSubtitle, heroImage, highlights) {
  return `
    <section class="lp-hero">
      <div class="lp-hero-bg lp-editable-image" data-field="heroImage" data-label="ヒーロー画像" style="${heroImage ? `background-image: url('${escapeHtml(heroImage)}')` : ''}"></div>
      <div class="lp-hero-overlay"></div>
      <div class="lp-hero-content">
        <p class="lp-hero-company">${escapeHtml(company.company)}</p>
        <h1 class="lp-hero-title lp-editable" data-field="heroTitle" data-label="メインタイトル">${escapeHtml(heroTitle)}</h1>
        ${heroSubtitle ? `<p class="lp-hero-subtitle lp-editable" data-field="heroSubtitle" data-label="サブタイトル">${escapeHtml(heroSubtitle)}</p>` : `<p class="lp-hero-subtitle lp-editable lp-placeholder" data-field="heroSubtitle" data-label="サブタイトル">サブタイトルを追加</p>`}

        ${highlights.length > 0 ? `
        <div class="lp-hero-highlights">
          ${highlights.map(h => `
            <div class="lp-highlight-item ${h.icon}">
              <span class="lp-highlight-label">${escapeHtml(h.label)}</span>
              <span class="lp-highlight-value">${escapeHtml(h.value)}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div class="lp-hero-cta">
          <a href="#lp-apply" class="lp-btn-apply-hero">今すぐ応募する</a>
        </div>
      </div>
    </section>
  `;
}

// イエロー: グラデーション背景、丸みのある下部
function renderYellowHero(company, heroTitle, heroSubtitle, heroImage, highlights) {
  return `
    <section class="lp-hero lp-hero--yellow">
      <div class="lp-hero-bg lp-editable-image" data-field="heroImage" data-label="ヒーロー画像" style="${heroImage ? `background-image: url('${escapeHtml(heroImage)}')` : ''}"></div>
      <div class="lp-hero-overlay"></div>
      <div class="lp-hero-content">
        ${heroSubtitle ? `<p class="lp-hero-pretitle lp-editable" data-field="heroSubtitle" data-label="サブタイトル">${escapeHtml(heroSubtitle)}</p>` : '<p class="lp-hero-pretitle">未経験からスタートできる！</p>'}
        <h1 class="lp-hero-title lp-editable" data-field="heroTitle" data-label="メインタイトル">${escapeHtml(heroTitle)}</h1>
        <p class="lp-hero-company">${escapeHtml(company.company)}</p>

        ${highlights.length > 0 ? `
        <div class="lp-hero-highlights">
          ${highlights.map(h => `
            <div class="lp-highlight-item ${h.icon}">
              <span class="lp-highlight-label">${escapeHtml(h.label)}</span>
              <span class="lp-highlight-value">${escapeHtml(h.value)}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div class="lp-hero-cta">
          <a href="#lp-apply" class="lp-btn-apply-hero">今すぐ応募する</a>
          <span class="lp-cta-microcopy">1分で入力完了</span>
        </div>
      </div>
    </section>
  `;
}

// インパクト: ダーク背景、大きなタイポグラフィ、ネオンアクセント
function renderImpactHero(company, heroTitle, heroSubtitle, heroImage, highlights) {
  return `
    <section class="lp-hero lp-hero--impact" style="${heroImage ? `background-image: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url('${escapeHtml(heroImage)}')` : ''}">
      <div class="lp-hero-content">
        <h1 class="lp-hero-title lp-editable" data-field="heroTitle" data-label="メインタイトル">${escapeHtml(heroTitle)}</h1>
        ${heroSubtitle ? `<p class="lp-hero-subtitle lp-editable" data-field="heroSubtitle" data-label="サブタイトル">${escapeHtml(heroSubtitle)}</p>` : '<p class="lp-hero-subtitle">限界を超えろ。常識を変えろ。</p>'}
      </div>
    </section>
  `;
}

// 信頼: 左ボーダー、クリーンなデザイン
function renderTrustHero(company, heroTitle, heroSubtitle, heroImage, highlights) {
  return `
    <section class="lp-hero lp-hero--trust">
      <div class="lp-hero-content">
        <p class="lp-hero-pretitle">Expertise & Growth</p>
        <h1 class="lp-hero-title lp-editable" data-field="heroTitle" data-label="メインタイトル">${escapeHtml(heroTitle)}</h1>
        ${heroSubtitle ? `<p class="lp-hero-subtitle lp-editable" data-field="heroSubtitle" data-label="サブタイトル">${escapeHtml(heroSubtitle)}</p>` : ''}
      </div>
    </section>
  `;
}

// アットホーム: 丸みのあるデザイン、ソフトな色合い
function renderAthomeHero(company, heroTitle, heroSubtitle, heroImage, highlights) {
  return `
    <section class="lp-hero lp-hero--athome">
      <div class="lp-hero-content">
        <h1 class="lp-hero-title lp-editable" data-field="heroTitle" data-label="メインタイトル">${escapeHtml(heroTitle)}</h1>
        ${heroSubtitle ? `<p class="lp-hero-subtitle lp-editable" data-field="heroSubtitle" data-label="サブタイトル">${escapeHtml(heroSubtitle)}</p>` : '<p class="lp-hero-subtitle">スキルよりも、あなたの笑顔を重要視します！</p>'}
        ${heroImage ? `<div class="lp-hero-image-container"><img src="${escapeHtml(heroImage)}" alt="" class="lp-hero-image lp-editable-image" data-field="heroImage" data-label="ヒーロー画像"></div>` : ''}
      </div>
    </section>
  `;
}

// 地域密着: 背景画像とオーバーレイ
function renderLocalHero(company, heroTitle, heroSubtitle, heroImage, highlights) {
  return `
    <section class="lp-hero lp-hero--local" style="${heroImage ? `background-image: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('${escapeHtml(heroImage)}')` : ''}">
      <div class="lp-hero-content">
        <h1 class="lp-hero-title lp-editable" data-field="heroTitle" data-label="メインタイトル">${escapeHtml(heroTitle)}</h1>
        ${heroSubtitle ? `<p class="lp-hero-subtitle lp-editable" data-field="heroSubtitle" data-label="サブタイトル">${escapeHtml(heroSubtitle)}</p>` : ''}
      </div>
    </section>
  `;
}

export default renderHeroSection;
