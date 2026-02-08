/**
 * Home/Index ページ機能
 */

import { escapeHtml, trackEvent } from '@shared/utils.js';
import * as JobsLoader from '@shared/jobs-loader.js';
import { JobCard, LocationCard, Modal } from '@components/molecules/index.js';
import { LoadingSpinner, Icons } from '@components/atoms/index.js';

// 検索タブ機能
export function initSearchTabs() {
  const searchCards = document.querySelectorAll('.search-card');
  const searchPanels = document.querySelectorAll('.search-panel');

  searchCards.forEach(card => {
    card.addEventListener('click', function() {
      const method = this.dataset.method;

      searchCards.forEach(c => c.classList.remove('active'));
      searchPanels.forEach(p => p.classList.remove('active'));

      this.classList.add('active');

      const panel = document.getElementById('panel-' + method);
      if (panel) {
        panel.classList.add('active');
      }

      if (method === 'location') {
        showLocationModal();
      }

      if (method === 'occupation') {
        showOccupationModal();
      }
    });
  });

  // キーワード検索フォームの処理
  const keywordForm = document.getElementById('keyword-search-form');
  if (keywordForm) {
    keywordForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const keyword = document.getElementById('keyword-input')?.value?.trim();
      if (keyword) {
        window.location.href = `jobs.html?keyword=${encodeURIComponent(keyword)}`;
      }
    });
  }
}

// 勤務地検索モーダル
export async function showLocationModal() {
  const existingModal = document.querySelector('.location-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.className = 'location-modal';
  modal.innerHTML = `
    <div class="location-modal-overlay"></div>
    <div class="location-modal-content">
      <button class="location-modal-close">&times;</button>
      <h3>勤務地から探す</h3>
      <p>働きたいエリアを選択してください</p>
      <div class="location-list">
        ${LoadingSpinner({ message: '勤務地を読み込み中...' })}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    modal.classList.add('active');
  });

  const closeModal = () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  };

  modal.querySelector('.location-modal-close').addEventListener('click', closeModal);
  modal.querySelector('.location-modal-overlay').addEventListener('click', closeModal);

  try {
    const locations = await JobsLoader.getLocationList();
    const listContainer = modal.querySelector('.location-list');

    if (locations.length === 0) {
      listContainer.innerHTML = '<p class="no-data">勤務地データがありません</p>';
      return;
    }

    listContainer.innerHTML = locations.map(loc => LocationCard({ location: loc })).join('');

    listContainer.querySelectorAll('.location-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const prefecture = item.dataset.prefecture;
        closeModal();
        window.location.href = `location.html?prefecture=${encodeURIComponent(prefecture)}`;
      });
    });

  } catch (error) {
    console.error('勤務地の取得エラー:', error);
    modal.querySelector('.location-list').innerHTML = '<p class="error">勤務地の取得に失敗しました</p>';
  }
}

// 職種検索モーダル
export function showOccupationModal() {
  const existingModal = document.querySelector('.occupation-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // 職種一覧
  const occupations = [
    { id: 'office', name: '事務・管理・企画', icon: '💼' },
    { id: 'sales', name: '営業・販売・サービス', icon: '🤝' },
    { id: 'it', name: 'IT・クリエイティブ', icon: '💻' },
    { id: 'manufacturing', name: '製造・エンジニアリング', icon: '🔧' },
    { id: 'medical', name: '医療・福祉・教育', icon: '🏥' },
    { id: 'logistics', name: '物流・運輸', icon: '🚚' },
    { id: 'other', name: 'その他', icon: '📋' }
  ];

  const modal = document.createElement('div');
  modal.className = 'occupation-modal';
  modal.innerHTML = `
    <div class="occupation-modal-overlay"></div>
    <div class="occupation-modal-content">
      <button class="occupation-modal-close">&times;</button>
      <h3>職種から探す</h3>
      <p>希望の職種を選択してください</p>
      <div class="occupation-list">
        ${occupations.map(occ => `
          <a href="jobs.html?occupation=${encodeURIComponent(occ.name)}" class="occupation-item" data-occupation="${occ.id}">
            <span class="occupation-icon">${occ.icon}</span>
            <span class="occupation-name">${occ.name}</span>
          </a>
        `).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    modal.classList.add('active');
  });

  const closeModal = () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  };

  modal.querySelector('.occupation-modal-close').addEventListener('click', closeModal);
  modal.querySelector('.occupation-modal-overlay').addEventListener('click', closeModal);
}

// 相談モーダル
export function showConsultModal() {
  const existingModal = document.querySelector('.consult-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.className = 'consult-modal';
  modal.innerHTML = `
    <div class="consult-modal-overlay"></div>
    <div class="consult-modal-content">
      <button class="consult-modal-close">&times;</button>
      <h3>無料相談</h3>
      <p>専門スタッフがあなたにぴったりの求人をご提案します</p>
      <div class="consult-options">
        <a href="#" class="consult-option line">
          <span class="icon">LINE</span>
          <span>LINEで相談</span>
        </a>
        <a href="#" class="consult-option tel">
          <span class="icon">TEL</span>
          <span>電話で相談</span>
        </a>
        <a href="#" class="consult-option form">
          <span class="icon">FORM</span>
          <span>フォームで相談</span>
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    modal.classList.add('active');
  });

  const closeModal = () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  };

  modal.querySelector('.consult-modal-close').addEventListener('click', closeModal);
  modal.querySelector('.consult-modal-overlay').addEventListener('click', closeModal);
}

// モバイルメニュー
export function initMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  if (!menuBtn) return;

  const existingNav = document.querySelector('.mobile-nav');
  if (existingNav) return;

  const mobileNav = document.createElement('nav');
  mobileNav.className = 'mobile-nav';
  mobileNav.innerHTML = `
    <ul>
      <li><a href="#jobs">お仕事紹介</a></li>
      <li><a href="#content">コンテンツ</a></li>
      <li><a href="#about">当サイトについて</a></li>
      <li><a href="#contact">お問い合わせ</a></li>
      <li><a href="admin.html">管理者</a></li>
    </ul>
  `;

  const header = document.querySelector('.header');
  if (header) {
    header.after(mobileNav);
  }

  menuBtn.addEventListener('click', function() {
    this.classList.toggle('active');
    mobileNav.classList.toggle('active');
  });

  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menuBtn.classList.remove('active');
      mobileNav.classList.remove('active');
    });
  });
}

// スムーススクロール
export function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// スクロール時のヘッダー効果
export function initHeaderScroll() {
  const header = document.querySelector('.header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

// 数字のカウントアップアニメーション
export function animateNumbers() {
  const statNumbers = document.querySelectorAll('.stat-number');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target;
        // data-value属性から数値を取得（¥などのプレフィックスを含まない）
        const finalNumber = parseInt(target.dataset.value) || 0;
        if (finalNumber > 0) {
          animateNumber(target, finalNumber);
        }
        observer.unobserve(target);
      }
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(num => observer.observe(num));
}

function animateNumber(element, target) {
  const duration = 2000;
  const start = 0;
  const startTime = performance.now();
  // .stat-value 要素を取得（suffix/prefixを壊さないため）
  const valueElement = element.querySelector('.stat-value') || element;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (target - start) * easeProgress);

    valueElement.textContent = current.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

// 求人一覧を描画（注目の求人：新規作成順）
export async function renderJobs(containerId = 'jobs-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const locationFilter = params.get('location');

  container.innerHTML = LoadingSpinner({
    message: locationFilter ? `${locationFilter}の求人を読み込んでいます...` : '求人情報を読み込んでいます...'
  });

  if (locationFilter) {
    const filteredJobs = await JobsLoader.getJobsByLocation(locationFilter);

    if (!filteredJobs || filteredJobs.length === 0) {
      container.innerHTML = `
        <div class="jobs-error">
          <p>${escapeHtml(locationFilter)}の求人が見つかりませんでした。</p>
          <a href="/" class="btn-more">すべての求人を見る</a>
        </div>
      `;
      return;
    }

    const filterHeader = document.createElement('div');
    filterHeader.className = 'location-filter-header';
    filterHeader.innerHTML = `
      <div class="filter-info">
        <span class="filter-label">${escapeHtml(locationFilter)}の求人</span>
        <span class="filter-count">${filteredJobs.length}件</span>
      </div>
      <a href="/" class="btn-clear-filter">フィルターを解除</a>
    `;
    container.before(filterHeader);

    container.innerHTML = filteredJobs.map(job => JobCard({ job, showCompanyName: true })).join('');
    return;
  }

  // 全求人を取得して新規作成順にソート
  const allJobs = await JobsLoader.fetchAllJobs();

  if (!allJobs || allJobs.length === 0) {
    container.innerHTML = `
      <div class="jobs-error">
        <p>求人情報を取得できませんでした。</p>
        <button onclick="location.reload()">再読み込み</button>
      </div>
    `;
    return;
  }

  // 新規作成順にソート（createdAtまたはpublishStartで判定）
  const sortedJobs = allJobs.sort((a, b) => {
    const dateA = parseJobDate(a.createdAt || a.publishStart || '');
    const dateB = parseJobDate(b.createdAt || b.publishStart || '');
    return dateB - dateA; // 新しい順
  });

  // 表示件数: 6件（モバイルはCSSで3件に制限）
  const displayJobs = sortedJobs.slice(0, 6);

  // 横スクロール対応のためクラスを追加
  container.classList.add('jobs-grid-featured');
  container.innerHTML = displayJobs.map(job => JobCard({ job, showCompanyName: true })).join('');
}

// 日付をパース（Firestore Timestamp、Date、文字列に対応）
function parseJobDate(dateValue) {
  if (!dateValue) return new Date(0);

  // Firestore Timestamp（toDate()メソッドを持つ）
  if (dateValue.toDate && typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  }

  // Firestore Timestamp（secondsプロパティを持つ）
  if (dateValue.seconds) {
    return new Date(dateValue.seconds * 1000);
  }

  // すでにDateオブジェクト
  if (dateValue instanceof Date) {
    return dateValue;
  }

  // 文字列の場合
  if (typeof dateValue === 'string') {
    const normalized = dateValue.replace(/\//g, '-');
    const date = new Date(normalized);
    return isNaN(date.getTime()) ? new Date(0) : date;
  }

  return new Date(0);
}

// 実績を描画
export async function renderStats() {
  const statsContainer = document.querySelector('.hero-stats');
  if (!statsContainer) return;

  try {
    const stats = await JobsLoader.fetchJobStats();
    if (!stats) {
      console.warn('統計情報を取得できませんでした');
      return;
    }

    const items = [
      {
        value: stats.avgHourlyWage || 0,
        label: '平均時給',
        suffix: '円'
      },
      {
        value: stats.avgMonthlySalary || 0,
        label: '平均月収',
        suffix: '円'
      }
    ];

    statsContainer.innerHTML = items.map(item => `
      <div class="stat-item">
        <span class="stat-number" data-value="${item.value}">
          ${item.prefix ? `<span class="stat-prefix">${item.prefix}</span>` : ''}
          <span class="stat-value">${item.value.toLocaleString()}</span>
          ${item.suffix ? `<span class="stat-suffix">${item.suffix}</span>` : ''}
        </span>
        <span class="stat-label">${escapeHtml(item.label)}</span>
      </div>
    `).join('');
  } catch (error) {
    console.error('統計情報の取得エラー:', error);
  }
}

// フッターの勤務地リンクを更新
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

// フッターの職種名リンクを更新
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

// 動画モーダルを初期化
export function initJobVideoModal() {
  // イベント委譲で動画ボタンのクリックを処理
  document.addEventListener('click', (e) => {
    const videoBtn = e.target.closest('.btn-job-video');
    if (videoBtn) {
      e.preventDefault();
      const videoUrl = videoBtn.dataset.videoUrl;
      if (videoUrl) {
        showJobVideoModal(videoUrl);
      }
    }

    // モーダルを閉じる
    const closeBtn = e.target.closest('.job-video-modal-close');
    const overlay = e.target.closest('.job-video-modal-overlay');
    if (closeBtn || overlay) {
      closeJobVideoModal();
    }
  });

  // ESCキーでモーダルを閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeJobVideoModal();
    }
  });
}

// 動画モーダルを表示
function showJobVideoModal(videoUrl) {
  // YouTubeのURLを埋め込み形式に変換
  const embedUrl = getYouTubeEmbedUrl(videoUrl);
  if (!embedUrl) {
    console.error('[JobVideo] YouTube URLの解析に失敗:', videoUrl);
    return;
  }

  // 既存のモーダルがあれば削除
  const existingModal = document.querySelector('.job-video-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // モーダルを作成
  const modal = document.createElement('div');
  modal.className = 'job-video-modal';
  modal.innerHTML = `
    <div class="job-video-modal-overlay"></div>
    <div class="job-video-modal-content">
      <button class="job-video-modal-close">&times;</button>
      <iframe
        class="job-video-modal-iframe"
        src="${embedUrl}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    </div>
  `;

  document.body.appendChild(modal);

  // 少し遅延してからactiveクラスを追加（アニメーション用）
  requestAnimationFrame(() => {
    modal.classList.add('active');
  });

  // スクロールを無効化
  document.body.style.overflow = 'hidden';
}

// 動画モーダルを閉じる
function closeJobVideoModal() {
  const modal = document.querySelector('.job-video-modal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.remove();
      document.body.style.overflow = '';
    }, 300);
  }
}

// YouTubeのURLを埋め込み形式に変換
function getYouTubeEmbedUrl(url) {
  if (!url) return null;

  // 各種YouTube URL形式に対応
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`;
    }
  }

  return null;
}

// ページ初期化
export async function initHomePage() {
  // Firestoreを初期化
  await JobsLoader.initFirestoreLoader();

  initSearchTabs();
  initMobileMenu();
  initSmoothScroll();
  initHeaderScroll();
  initJobVideoModal();

  if (document.getElementById('jobs-container')) {
    renderJobs();
  }

  if (document.querySelector('.hero-stats')) {
    renderStats();
  }

  if (document.getElementById('footer-locations')) {
    renderFooterLocations();
  }

  if (document.getElementById('footer-job-types')) {
    renderFooterJobTypes();
  }

  window.addEventListener('load', animateNumbers);
}

export default {
  initHomePage,
  initSearchTabs,
  initMobileMenu,
  initSmoothScroll,
  initHeaderScroll,
  initJobVideoModal,
  animateNumbers,
  renderJobs,
  renderStats,
  renderFooterLocations,
  renderFooterJobTypes,
  showLocationModal,
  showOccupationModal,
  showConsultModal
};
