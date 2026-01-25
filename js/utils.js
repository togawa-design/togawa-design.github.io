/**
 * リクエコ求人ナビ - 共通ユーティリティ
 *
 * 各JSファイルで共通して使用する処理をまとめたクラス
 */

const RikuekoUtils = {
  // ========================================
  // HTML処理
  // ========================================

  /**
   * HTMLエスケープ
   * @param {string} str - エスケープする文字列
   * @returns {string} エスケープ済み文字列
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * HTMLサニタイズ（許可するタグのみ残す）
   * @param {string} html - サニタイズするHTML
   * @param {string[]} allowedTags - 許可するタグ名の配列
   * @returns {string} サニタイズ済みHTML
   */
  sanitizeHtml(html, allowedTags = ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'div', 'p']) {
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
  },

  /**
   * 改行を<br>に変換
   * @param {string} str - 変換する文字列
   * @returns {string} 変換済み文字列
   */
  nl2br(str) {
    if (!str) return '';
    return this.escapeHtml(str).replace(/\n/g, '<br>');
  },

  // ========================================
  // URLパラメータ
  // ========================================

  /**
   * URLパラメータを取得
   * @param {string} key - パラメータ名
   * @param {string} defaultValue - デフォルト値
   * @returns {string|null} パラメータ値
   */
  getUrlParam(key, defaultValue = null) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key) ?? defaultValue;
  },

  /**
   * URLパラメータを設定（履歴に追加）
   * @param {string} key - パラメータ名
   * @param {string} value - 値
   */
  setUrlParam(key, value) {
    const url = new URL(window.location.href);
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
    window.history.pushState({}, '', url.toString());
  },

  /**
   * URLパラメータを削除（履歴に追加）
   * @param {string} key - パラメータ名
   */
  removeUrlParam(key) {
    this.setUrlParam(key, null);
  },

  /**
   * URLパラメータが存在するか確認
   * @param {string} key - パラメータ名
   * @returns {boolean}
   */
  hasUrlParam(key) {
    const params = new URLSearchParams(window.location.search);
    return params.has(key);
  },

  // ========================================
  // 依存関係待機
  // ========================================

  /**
   * グローバル変数が定義されるまで待機
   * @param {string} varName - 待機するグローバル変数名
   * @param {number} timeout - タイムアウト（ミリ秒）
   * @param {number} interval - チェック間隔（ミリ秒）
   * @returns {Promise<any>} 変数の値
   */
  waitForGlobal(varName, timeout = 5000, interval = 50) {
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
  },

  /**
   * JobsLoaderが読み込まれるまで待機
   * @param {number} timeout - タイムアウト（ミリ秒）
   * @returns {Promise<object>} JobsLoaderオブジェクト
   */
  async waitForJobsLoader(timeout = 10000) {
    // JobsLoaderが既に定義されているか確認
    if (typeof window.JobsLoader !== 'undefined') {
      return window.JobsLoader;
    }
    return this.waitForGlobal('JobsLoader', timeout, 100);
  },

  /**
   * 条件が真になるまで待機
   * @param {Function} condition - 条件関数
   * @param {number} timeout - タイムアウト（ミリ秒）
   * @param {number} interval - チェック間隔（ミリ秒）
   * @returns {Promise<void>}
   */
  waitUntil(condition, timeout = 5000, interval = 50) {
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
  },

  // ========================================
  // ローディング表示
  // ========================================

  /**
   * ローディング表示を生成
   * @param {string} message - メッセージ
   * @param {string} subMessage - サブメッセージ
   * @returns {string} HTML文字列
   */
  createLoadingHtml(message = '読み込んでいます...', subMessage = 'しばらくお待ちください') {
    return `
      <div class="loading-container">
        <div class="loading-inner">
          <div class="loading-spinner large"></div>
          <p class="loading-text">${this.escapeHtml(message)}</p>
          ${subMessage ? `<p class="loading-subtext">${this.escapeHtml(subMessage)}</p>` : ''}
        </div>
      </div>
    `;
  },

  /**
   * コンテナにローディングを表示
   * @param {string|HTMLElement} container - コンテナ要素またはID
   * @param {string} message - メッセージ
   * @param {string} subMessage - サブメッセージ
   */
  showLoading(container, message, subMessage) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (el) {
      el.innerHTML = this.createLoadingHtml(message, subMessage);
    }
  },

  /**
   * エラー表示を生成
   * @param {string} message - エラーメッセージ
   * @param {string} buttonText - ボタンテキスト
   * @param {string} buttonHref - ボタンリンク先
   * @returns {string} HTML文字列
   */
  createErrorHtml(message, buttonText = 'トップページへ戻る', buttonHref = '/') {
    return `
      <div class="error-container">
        <p class="error-message">${this.escapeHtml(message)}</p>
        <a href="${this.escapeHtml(buttonHref)}" class="btn-back">${this.escapeHtml(buttonText)}</a>
      </div>
    `;
  },

  /**
   * コンテナにエラーを表示
   * @param {string|HTMLElement} container - コンテナ要素またはID
   * @param {string} message - エラーメッセージ
   * @param {string} buttonText - ボタンテキスト
   * @param {string} buttonHref - ボタンリンク先
   */
  showError(container, message, buttonText, buttonHref) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (el) {
      el.innerHTML = this.createErrorHtml(message, buttonText, buttonHref);
    }
  },

  // ========================================
  // モーダル
  // ========================================

  /**
   * モーダルを表示
   * @param {object} options - オプション
   * @param {string} options.className - モーダルのクラス名
   * @param {string} options.title - タイトル
   * @param {string} options.content - コンテンツHTML
   * @param {Function} options.onClose - 閉じた時のコールバック
   * @returns {HTMLElement} モーダル要素
   */
  showModal({ className = 'modal', title = '', content = '', onClose = null }) {
    // 既存のモーダルを削除
    this.closeModal(className);

    const modal = document.createElement('div');
    modal.className = className;
    modal.innerHTML = `
      <div class="${className}-overlay"></div>
      <div class="${className}-content">
        <button class="${className}-close">&times;</button>
        ${title ? `<h3>${this.escapeHtml(title)}</h3>` : ''}
        <div class="${className}-body">${content}</div>
      </div>
    `;

    document.body.appendChild(modal);

    // アニメーション用に少し遅延
    requestAnimationFrame(() => {
      modal.classList.add('active');
    });

    // 閉じる機能
    const closeModalFn = () => {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.remove();
        if (onClose) onClose();
      }, 300);
    };

    modal.querySelector(`.${className}-close`).addEventListener('click', closeModalFn);
    modal.querySelector(`.${className}-overlay`).addEventListener('click', closeModalFn);

    // ESCキーで閉じる
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModalFn();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    return modal;
  },

  /**
   * モーダルを閉じる
   * @param {string} className - モーダルのクラス名
   */
  closeModal(className = 'modal') {
    const existingModal = document.querySelector(`.${className}`);
    if (existingModal) {
      existingModal.classList.remove('active');
      setTimeout(() => existingModal.remove(), 300);
    }
  },

  // ========================================
  // 日付処理
  // ========================================

  /**
   * 日付文字列をDateオブジェクトに変換
   * @param {string} dateStr - 日付文字列（YYYY/MM/DD または YYYY-MM-DD）
   * @returns {Date|null} Dateオブジェクト
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    const normalized = dateStr.trim().replace(/\//g, '-');
    const date = new Date(normalized);
    if (isNaN(date.getTime())) {
      return null;
    }
    date.setHours(0, 0, 0, 0);
    return date;
  },

  /**
   * 日付をフォーマット
   * @param {Date|string} date - 日付
   * @param {string} format - フォーマット（YYYY-MM-DD, YYYY/MM/DD など）
   * @returns {string} フォーマット済み日付
   */
  formatDate(date, format = 'YYYY-MM-DD') {
    const d = typeof date === 'string' ? this.parseDate(date) : date;
    if (!d) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day);
  },

  /**
   * 今日の日付を取得（時刻なし）
   * @returns {Date}
   */
  getToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  },

  // ========================================
  // アナリティクス
  // ========================================

  /**
   * Google Analyticsイベント送信
   * @param {string} eventName - イベント名
   * @param {object} eventParams - イベントパラメータ
   */
  trackEvent(eventName, eventParams = {}) {
    const isDebug = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    this.hasUrlParam('debug_mode');

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
  },

  /**
   * ページビューをトラッキング
   * @param {string} pageName - ページ名
   * @param {object} additionalParams - 追加パラメータ
   */
  trackPageView(pageName, additionalParams = {}) {
    this.trackEvent('page_view', {
      page_name: pageName,
      page_location: window.location.href,
      page_title: document.title,
      ...additionalParams
    });
  },

  // ========================================
  // ストレージ
  // ========================================

  /**
   * ローカルストレージから取得
   * @param {string} key - キー
   * @param {any} defaultValue - デフォルト値
   * @returns {any} 値
   */
  getStorage(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },

  /**
   * ローカルストレージに保存
   * @param {string} key - キー
   * @param {any} value - 値
   */
  setStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  },

  /**
   * セッションストレージから取得
   * @param {string} key - キー
   * @param {any} defaultValue - デフォルト値
   * @returns {any} 値
   */
  getSession(key, defaultValue = null) {
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },

  /**
   * セッションストレージに保存
   * @param {string} key - キー
   * @param {any} value - 値
   */
  setSession(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Failed to save to sessionStorage:', e);
    }
  },

  // ========================================
  // 数値処理
  // ========================================

  /**
   * 数字をカンマ区切りにフォーマット
   * @param {number|string} num - 数値
   * @returns {string} フォーマット済み文字列
   */
  formatNumber(num) {
    if (!num && num !== 0) return '';
    return Number(num).toLocaleString();
  },

  /**
   * 金額文字列から数値を抽出
   * @param {string} salaryStr - 金額文字列（例: "35万円", "350,000円"）
   * @returns {number} 数値
   */
  parseSalary(salaryStr) {
    if (!salaryStr) return 0;

    // 「万円」の前の数字を取得
    const manMatch = salaryStr.match(/(\d+(?:\.\d+)?)\s*万/);
    if (manMatch) {
      return parseFloat(manMatch[1]) * 10000;
    }

    // 「円」の前の数字を取得
    const yenMatch = salaryStr.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
    if (yenMatch) {
      return parseInt(yenMatch[1].replace(/,/g, ''));
    }

    // ¥マーク形式
    const yenSymbolMatch = salaryStr.match(/[¥￥]\s*(\d{1,3}(?:,\d{3})*|\d+)/);
    if (yenSymbolMatch) {
      return parseInt(yenSymbolMatch[1].replace(/,/g, ''));
    }

    // 数字のみ
    const numMatch = salaryStr.match(/(\d{1,3}(?:,\d{3})*|\d+)/);
    if (numMatch) {
      return parseInt(numMatch[1].replace(/,/g, ''));
    }

    return 0;
  },

  // ========================================
  // 文字列処理
  // ========================================

  /**
   * 文字列を指定文字数で切り詰め
   * @param {string} str - 文字列
   * @param {number} maxLength - 最大文字数
   * @param {string} suffix - 末尾に追加する文字列
   * @returns {string} 切り詰めた文字列
   */
  truncate(str, maxLength = 100, suffix = '...') {
    if (!str || str.length <= maxLength) return str || '';
    return str.substring(0, maxLength) + suffix;
  },

  /**
   * 配列から重複を除去
   * @param {any[]} array - 配列
   * @param {string} key - オブジェクト配列の場合のキー
   * @returns {any[]} 重複除去した配列
   */
  unique(array, key = null) {
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
  },

  // ========================================
  // デバウンス・スロットル
  // ========================================

  /**
   * デバウンス
   * @param {Function} func - 実行する関数
   * @param {number} wait - 待機時間（ミリ秒）
   * @returns {Function} デバウンスされた関数
   */
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * スロットル
   * @param {Function} func - 実行する関数
   * @param {number} limit - 制限時間（ミリ秒）
   * @returns {Function} スロットルされた関数
   */
  throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // ========================================
  // スムーススクロール
  // ========================================

  /**
   * 要素までスムーススクロール
   * @param {string|HTMLElement} target - ターゲット要素またはセレクタ
   * @param {number} offset - オフセット（ヘッダー高さなど）
   */
  scrollTo(target, offset = 0) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;

    const targetPosition = el.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({
      top: targetPosition,
      behavior: 'smooth'
    });
  },

  /**
   * ページ内アンカーリンクにスムーススクロールを設定
   * @param {number} offset - オフセット（ヘッダー高さなど）
   */
  initSmoothScroll(offset = 0) {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href === '#') return;

        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          this.scrollTo(target, offset);
        }
      });
    });
  }
};

// グローバルにエクスポート
window.RikuekoUtils = RikuekoUtils;

// 短縮エイリアス
window.Utils = RikuekoUtils;
