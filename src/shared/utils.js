/**
 * L-SET - 共通ユーティリティ
 * ES Module版
 */

// HTML処理
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function sanitizeHtml(html, allowedTags = ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'div', 'p']) {
  if (!html || html === '<br>' || html === '<div><br></div>') {
    return '';
  }
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    if (!allowedTags.includes(el.tagName.toLowerCase())) {
      el.replaceWith(...el.childNodes);
    } else {
      while (el.attributes.length > 0) {
        el.removeAttribute(el.attributes[0].name);
      }
    }
  });
  return temp.innerHTML;
}

export function nl2br(str) {
  if (!str) return '';
  return escapeHtml(str).replace(/\n/g, '<br>');
}

// URLパラメータ
export function getUrlParam(key, defaultValue = null) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key) ?? defaultValue;
}

export function setUrlParam(key, value) {
  const url = new URL(window.location.href);
  if (value) {
    url.searchParams.set(key, value);
  } else {
    url.searchParams.delete(key);
  }
  window.history.pushState({}, '', url.toString());
}

export function removeUrlParam(key) {
  setUrlParam(key, null);
}

export function hasUrlParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.has(key);
}

// 依存関係待機
export function waitForGlobal(varName, timeout = 5000, interval = 50) {
  return new Promise((resolve, reject) => {
    if (typeof window[varName] !== 'undefined') {
      resolve(window[varName]);
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (typeof window[varName] !== 'undefined') {
        clearInterval(checkInterval);
        resolve(window[varName]);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error(`Timeout waiting for ${varName}`));
      }
    }, interval);
  });
}

export async function waitForJobsLoader(timeout = 10000) {
  if (typeof window.JobsLoader !== 'undefined') {
    return window.JobsLoader;
  }
  return waitForGlobal('JobsLoader', timeout, 100);
}

export function waitUntil(condition, timeout = 5000, interval = 50) {
  return new Promise((resolve, reject) => {
    if (condition()) {
      resolve();
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (condition()) {
        clearInterval(checkInterval);
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for condition'));
      }
    }, interval);
  });
}

// ローディング表示
export function createLoadingHtml(message = '読み込んでいます...', subMessage = 'しばらくお待ちください') {
  return `
    <div class="loading-container">
      <div class="loading-inner">
        <div class="loading-spinner large"></div>
        <p class="loading-text">${escapeHtml(message)}</p>
        ${subMessage ? `<p class="loading-subtext">${escapeHtml(subMessage)}</p>` : ''}
      </div>
    </div>
  `;
}

export function showLoading(container, message, subMessage) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (el) {
    el.innerHTML = createLoadingHtml(message, subMessage);
  }
}

export function createErrorHtml(message, buttonText = 'トップページへ戻る', buttonHref = '/') {
  return `
    <div class="error-container">
      <p class="error-message">${escapeHtml(message)}</p>
      <a href="${escapeHtml(buttonHref)}" class="btn-back">${escapeHtml(buttonText)}</a>
    </div>
  `;
}

export function showError(container, message, buttonText, buttonHref) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (el) {
    el.innerHTML = createErrorHtml(message, buttonText, buttonHref);
  }
}

// モーダル
export function showModal({ className = 'modal', title = '', content = '', onClose = null }) {
  closeModal(className);

  const modal = document.createElement('div');
  modal.className = className;
  modal.innerHTML = `
    <div class="${className}-overlay"></div>
    <div class="${className}-content">
      <button class="${className}-close">&times;</button>
      ${title ? `<h3>${escapeHtml(title)}</h3>` : ''}
      <div class="${className}-body">${content}</div>
    </div>
  `;

  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    modal.classList.add('active');
  });

  const closeModalFn = () => {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.remove();
      if (onClose) onClose();
    }, 300);
  };

  modal.querySelector(`.${className}-close`).addEventListener('click', closeModalFn);
  modal.querySelector(`.${className}-overlay`).addEventListener('click', closeModalFn);

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModalFn();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  return modal;
}

export function closeModal(className = 'modal') {
  const existingModal = document.querySelector(`.${className}`);
  if (existingModal) {
    existingModal.classList.remove('active');
    setTimeout(() => existingModal.remove(), 300);
  }
}

// トースト通知
export function showToast(message, type = 'info') {
  // 既存のトーストを削除
  const existingToast = document.querySelector('.utils-toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `utils-toast utils-toast-${type}`;
  toast.innerHTML = `
    <span class="utils-toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span class="utils-toast-message">${escapeHtml(message)}</span>
  `;

  // スタイルを動的に追加（まだない場合）
  if (!document.getElementById('utils-toast-style')) {
    const style = document.createElement('style');
    style.id = 'utils-toast-style';
    style.textContent = `
      .utils-toast {
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        background: #333;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        z-index: 10000;
        animation: utils-toast-in 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      .utils-toast-success { background: #10b981; }
      .utils-toast-error { background: #ef4444; }
      .utils-toast-info { background: #3b82f6; }
      .utils-toast-hide { animation: utils-toast-out 0.3s ease forwards; }
      @keyframes utils-toast-in { from { opacity: 0; transform: translateX(-50%) translateY(1rem); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      @keyframes utils-toast-out { from { opacity: 1; } to { opacity: 0; } }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('utils-toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 確認ダイアログ
export function showConfirm(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'utils-confirm-overlay';
    overlay.innerHTML = `
      <div class="utils-confirm-dialog">
        <h3 class="utils-confirm-title">${escapeHtml(title)}</h3>
        <p class="utils-confirm-message">${escapeHtml(message)}</p>
        <div class="utils-confirm-buttons">
          <button type="button" class="utils-confirm-cancel">キャンセル</button>
          <button type="button" class="utils-confirm-ok">OK</button>
        </div>
      </div>
    `;

    // スタイルを動的に追加（まだない場合）
    if (!document.getElementById('utils-confirm-style')) {
      const style = document.createElement('style');
      style.id = 'utils-confirm-style';
      style.textContent = `
        .utils-confirm-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); display: flex; align-items: center;
          justify-content: center; z-index: 10001;
        }
        .utils-confirm-dialog {
          background: #fff; border-radius: 0.5rem; padding: 1.5rem;
          max-width: 400px; width: 90%;
        }
        .utils-confirm-title { margin: 0 0 0.5rem; font-size: 1.1rem; }
        .utils-confirm-message { margin: 0 0 1.5rem; color: #666; }
        .utils-confirm-buttons { display: flex; gap: 0.5rem; justify-content: flex-end; }
        .utils-confirm-cancel, .utils-confirm-ok {
          padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer;
          border: none; font-size: 0.9rem;
        }
        .utils-confirm-cancel { background: #e5e7eb; color: #374151; }
        .utils-confirm-ok { background: #6366f1; color: #fff; }
      `;
      document.head.appendChild(style);
    }

    overlay.querySelector('.utils-confirm-cancel').addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });

    overlay.querySelector('.utils-confirm-ok').addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });

    document.body.appendChild(overlay);
  });
}

// 日付処理
export function parseDate(dateStr) {
  if (!dateStr) return null;
  const normalized = dateStr.trim().replace(/\//g, '-');
  const date = new Date(normalized);
  if (isNaN(date.getTime())) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatDate(date, format = 'YYYY-MM-DD') {
  const d = typeof date === 'string' ? parseDate(date) : date;
  if (!d) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day);
}

export function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// アナリティクス
export function trackEvent(eventName, eventParams = {}) {
  const isDebug = window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' ||
                  hasUrlParam('debug_mode');

  if (isDebug) {
    console.log('[Analytics]', eventName, eventParams);
  }

  if (typeof gtag === 'function') {
    gtag('event', eventName, eventParams);
    if (isDebug) {
      console.log('[Analytics] gtag sent successfully');
    }
  } else {
    if (isDebug) {
      console.warn('[Analytics] gtag is not defined, event not sent:', eventName);
    }
  }
}

export function trackPageView(pageName, additionalParams = {}) {
  trackEvent('page_view', {
    page_name: pageName,
    page_location: window.location.href,
    page_title: document.title,
    ...additionalParams
  });
}

// ストレージ
export function getStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export function setStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

export function getSession(key, defaultValue = null) {
  try {
    const item = sessionStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export function setSession(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to sessionStorage:', e);
  }
}

// 数値処理
export function formatNumber(num) {
  if (!num && num !== 0) return '';
  return Number(num).toLocaleString();
}

export function parseSalary(salaryStr) {
  if (!salaryStr) return 0;

  const manMatch = salaryStr.match(/(\d+(?:\.\d+)?)\s*万/);
  if (manMatch) {
    return parseFloat(manMatch[1]) * 10000;
  }

  const yenMatch = salaryStr.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
  if (yenMatch) {
    return parseInt(yenMatch[1].replace(/,/g, ''));
  }

  const yenSymbolMatch = salaryStr.match(/[¥￥]\s*(\d{1,3}(?:,\d{3})*|\d+)/);
  if (yenSymbolMatch) {
    return parseInt(yenSymbolMatch[1].replace(/,/g, ''));
  }

  const numMatch = salaryStr.match(/(\d{1,3}(?:,\d{3})*|\d+)/);
  if (numMatch) {
    return parseInt(numMatch[1].replace(/,/g, ''));
  }

  return 0;
}

// 文字列処理
export function truncate(str, maxLength = 100, suffix = '...') {
  if (!str || str.length <= maxLength) return str || '';
  return str.substring(0, maxLength) + suffix;
}

export function unique(array, key = null) {
  if (key) {
    const seen = new Set();
    return array.filter(item => {
      const val = item[key];
      if (seen.has(val)) return false;
      seen.add(val);
      return true;
    });
  }
  return [...new Set(array)];
}

// デバウンス・スロットル
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// スムーススクロール
export function scrollTo(target, offset = 0) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;

  const targetPosition = el.getBoundingClientRect().top + window.pageYOffset - offset;
  window.scrollTo({
    top: targetPosition,
    behavior: 'smooth'
  });
}

export function initSmoothScroll(offset = 0) {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        scrollTo(target, offset);
      }
    });
  });
}

// デフォルトエクスポート（後方互換性のため）
const Utils = {
  escapeHtml,
  sanitizeHtml,
  nl2br,
  getUrlParam,
  setUrlParam,
  removeUrlParam,
  hasUrlParam,
  waitForGlobal,
  waitForJobsLoader,
  waitUntil,
  createLoadingHtml,
  showLoading,
  createErrorHtml,
  showError,
  showModal,
  closeModal,
  parseDate,
  formatDate,
  getToday,
  trackEvent,
  trackPageView,
  getStorage,
  setStorage,
  getSession,
  setSession,
  formatNumber,
  parseSalary,
  truncate,
  unique,
  debounce,
  throttle,
  scrollTo,
  initSmoothScroll
};

export default Utils;

// グローバルにもエクスポート（既存コードとの互換性）
if (typeof window !== 'undefined') {
  window.RikuekoUtils = Utils;
  window.Utils = Utils;
}
