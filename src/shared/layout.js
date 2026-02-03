/**
 * 共通レイアウトコンポーネント（ヘッダー・フッター）
 * 管理画面以外の公開ページで使用
 */

import { escapeHtml } from '@shared/utils.js';
import * as JobsLoader from '@shared/jobs-loader.js';

/**
 * 共通ヘッダーHTML
 */
export function renderHeader() {
  return `
  <header class="header" role="banner">
    <div class="header-inner">
      <div class="logo">
        <a href="/">
          <span class="logo-text">L-SET</span>
          <span class="logo-sub">製造業・工場求人専門</span>
        </a>
      </div>
      <nav class="main-nav" aria-label="メインナビゲーション">
        <ul class="nav-list">
          <li><a href="/#jobs">お仕事紹介</a></li>
          <li><a href="/#content">コンテンツ</a></li>
          <li><a href="/#about">当サイトについて</a></li>
          <li><a href="/#contact">お問い合わせ</a></li>
        </ul>
      </nav>
      <div class="header-actions">
        <a href="#line" class="btn-line">
          <span class="line-icon">LINE</span>
          <span>友だち追加</span>
        </a>
        <!-- ユーザー認証UIはJSで動的に挿入 -->
      </div>
      <button class="mobile-menu-btn" aria-label="メニュー">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  </header>
  `;
}

/**
 * 共通フッターHTML
 */
export function renderFooter() {
  return `
  <footer class="footer" role="contentinfo">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <h3>サイトについて</h3>
          <ul>
            <li><a href="about.html">当サイトについて</a></li>
            <li><a href="https://www.receco.co.jp/" target="_blank" rel="noopener noreferrer">運営会社</a></li>
            <li><a href="privacy.html">プライバシーポリシー</a></li>
            <li><a href="terms.html">利用規約</a></li>
            <li><a href="admin.html">管理者ページ</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h3>勤務地から探す</h3>
          <ul id="footer-locations">
            <li><a href="location.html">すべてのエリア</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h3>職種名から探す</h3>
          <ul id="footer-job-types">
            <li><a href="jobs.html">すべての求人</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h3>お問い合わせ</h3>
          <ul>
            <li><a href="/#contact">お問い合わせフォーム</a></li>
            <li><a href="#">よくある質問</a></li>
            <li>
              <p class="footer-tel">電話でのお問い合わせ</p>
              <p class="footer-tel-number">0120-XXX-XXX</p>
              <p class="footer-tel-time">平日 9:00〜18:00</p>
            </li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p><small>&copy; 2025 L-SET All Rights Reserved.</small></p>
      </div>
    </div>
  </footer>
  `;
}

/**
 * ヘッダーとフッターを挿入
 */
export function initLayout() {
  // ヘッダー挿入
  const headerPlaceholder = document.getElementById('common-header');
  if (headerPlaceholder) {
    headerPlaceholder.outerHTML = renderHeader();
  }

  // フッター挿入
  const footerPlaceholder = document.getElementById('common-footer');
  if (footerPlaceholder) {
    footerPlaceholder.outerHTML = renderFooter();
  }
}

/**
 * フッターの勤務地リンクを更新
 */
export async function renderFooterLocations() {
  const container = document.getElementById('footer-locations');
  if (!container) return;

  try {
    const locations = await JobsLoader.getLocationList();
    const topLocations = locations.slice(0, 4);

    if (topLocations.length === 0) {
      container.innerHTML = '<li><a href="location.html">すべてのエリア</a></li>';
      return;
    }

    container.innerHTML = topLocations.map(loc =>
      `<li><a href="location.html?prefecture=${encodeURIComponent(loc.prefecture)}">${escapeHtml(loc.prefecture)}の求人</a></li>`
    ).join('') + '<li><a href="location.html">すべてのエリア</a></li>';

  } catch (error) {
    console.error('フッター勤務地の取得エラー:', error);
  }
}

/**
 * フッターの職種名リンクを更新
 */
export async function renderFooterJobTypes() {
  const container = document.getElementById('footer-job-types');
  if (!container) return;

  try {
    const jobTypes = await JobsLoader.getJobTypeList();
    const topJobTypes = jobTypes.slice(0, 5);

    if (topJobTypes.length === 0) {
      container.innerHTML = '<li><a href="jobs.html">すべての求人</a></li>';
      return;
    }

    container.innerHTML = topJobTypes.map(jt =>
      `<li><a href="jobs.html?occupation=${encodeURIComponent(jt.jobType)}">${escapeHtml(jt.jobType)}の求人</a></li>`
    ).join('') + '<li><a href="jobs.html">すべての求人</a></li>';

  } catch (error) {
    console.error('フッター職種名の取得エラー:', error);
  }
}

/**
 * フッターの動的コンテンツを初期化
 */
export function initFooterContent() {
  if (document.getElementById('footer-locations')) {
    renderFooterLocations();
  }
  if (document.getElementById('footer-job-types')) {
    renderFooterJobTypes();
  }
}

export default {
  renderHeader,
  renderFooter,
  initLayout,
  renderFooterLocations,
  renderFooterJobTypes,
  initFooterContent
};
