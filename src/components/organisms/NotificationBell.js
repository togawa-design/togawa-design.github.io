/**
 * NotificationBell コンポーネント
 *
 * ベルアイコン + 未読数バッジ + ドロップダウン
 * セグメントタブで「お知らせ」と「応募者」を切り替え
 */

import { escapeHtml } from '@shared/utils.js';
import {
  getActiveAnnouncements,
  getApplicationNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToApplicationNotifications
} from '@features/notifications/notification-service.js';

// localStorage キー
const READ_ANNOUNCEMENTS_KEY = 'read_announcements';

/**
 * NotificationBell クラス
 */
export class NotificationBell {
  /**
   * @param {Object} options
   * @param {string} options.containerId - ベルアイコンを配置するコンテナのID
   * @param {string} options.targetAudience - 'job_seekers' | 'company_users' | 'admin'
   * @param {string|null} options.companyDomain - 会社ユーザーの場合の会社ドメイン
   * @param {boolean} options.showApplications - 応募通知を表示するか
   */
  constructor(options = {}) {
    this.containerId = options.containerId;
    this.targetAudience = options.targetAudience || 'job_seekers';
    this.companyDomain = options.companyDomain || null;
    this.showApplications = options.showApplications || false;

    this.announcements = [];
    this.applicationNotifications = [];
    this.readAnnouncementIds = this.getReadAnnouncementIds();
    this.activeTab = 'announcements'; // 'announcements' | 'applications'
    this.isDropdownOpen = false;
    this.unsubscribe = null; // リアルタイムリスナー解除用
  }

  /**
   * 初期化
   */
  async init() {
    try {
      // お知らせを取得
      this.announcements = await getActiveAnnouncements(this.targetAudience);

      // 応募者通知を取得（表示する場合のみ）
      if (this.showApplications) {
        this.applicationNotifications = await getApplicationNotifications(this.companyDomain);

        // リアルタイムリスナーを設定
        this.unsubscribe = await subscribeToApplicationNotifications(
          this.companyDomain,
          (notifications) => {
            this.applicationNotifications = notifications;
            this.updateBadge();
            if (this.isDropdownOpen && this.activeTab === 'applications') {
              this.renderDropdownContent();
            }
          }
        );
      }

      this.render();
      this.bindEvents();
    } catch (error) {
      console.error('[NotificationBell] Init error:', error);
    }
  }

  /**
   * クリーンアップ
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * 既読お知らせIDを取得
   */
  getReadAnnouncementIds() {
    const stored = localStorage.getItem(READ_ANNOUNCEMENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * 既読お知らせIDを保存
   */
  saveReadAnnouncementIds() {
    localStorage.setItem(READ_ANNOUNCEMENTS_KEY, JSON.stringify(this.readAnnouncementIds));
  }

  /**
   * お知らせの未読数を取得
   */
  getUnreadAnnouncementsCount() {
    return this.announcements.filter(a => !this.readAnnouncementIds.includes(a.id)).length;
  }

  /**
   * 応募者通知の未読数を取得
   */
  getUnreadApplicationsCount() {
    return this.applicationNotifications.filter(n => !n.isRead).length;
  }

  /**
   * 合計未読数を取得
   */
  getTotalUnreadCount() {
    let count = this.getUnreadAnnouncementsCount();
    if (this.showApplications) {
      count += this.getUnreadApplicationsCount();
    }
    return count;
  }

  /**
   * お知らせを既読にする
   */
  markAnnouncementAsRead(id) {
    if (!this.readAnnouncementIds.includes(id)) {
      this.readAnnouncementIds.push(id);
      this.saveReadAnnouncementIds();
      this.updateBadge();
    }
  }

  /**
   * 全お知らせを既読にする
   */
  markAllAnnouncementsAsRead() {
    this.readAnnouncementIds = this.announcements.map(a => a.id);
    this.saveReadAnnouncementIds();
    this.updateBadge();
    this.renderDropdownContent();
  }

  /**
   * 応募者通知を既読にする
   */
  async markApplicationAsRead(id) {
    try {
      await markNotificationAsRead(id);
      const notification = this.applicationNotifications.find(n => n.id === id);
      if (notification) {
        notification.isRead = true;
      }
      this.updateBadge();
    } catch (error) {
      console.error('[NotificationBell] Mark read error:', error);
    }
  }

  /**
   * 全応募者通知を既読にする
   */
  async markAllApplicationsAsRead() {
    if (!this.companyDomain) return;

    try {
      await markAllNotificationsAsRead(this.companyDomain);
      this.applicationNotifications.forEach(n => {
        n.isRead = true;
      });
      this.updateBadge();
      this.renderDropdownContent();
    } catch (error) {
      console.error('[NotificationBell] Mark all read error:', error);
    }
  }

  /**
   * メインレンダリング
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const totalUnread = this.getTotalUnreadCount();

    container.innerHTML = `
      <div class="notification-bell" id="${this.containerId}-bell">
        <button class="notification-bell-btn" aria-label="お知らせ" aria-expanded="false">
          <svg class="notification-bell-icon" viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
          </svg>
          ${totalUnread > 0 ? `<span class="notification-badge">${totalUnread > 99 ? '99+' : totalUnread}</span>` : ''}
        </button>
        <div class="notification-dropdown" style="display: none;">
          ${this.renderDropdownHeader()}
          <div class="notification-dropdown-content">
            ${this.renderDropdownContent()}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ドロップダウンヘッダーをレンダリング
   */
  renderDropdownHeader() {
    if (!this.showApplications) {
      // お知らせのみの場合（求職者向け）
      const unreadCount = this.getUnreadAnnouncementsCount();
      return `
        <div class="notification-dropdown-header">
          <h4>お知らせ</h4>
          ${unreadCount > 0 ? '<button class="mark-all-read-btn" data-action="mark-all-announcements">すべて既読</button>' : ''}
        </div>
      `;
    }

    // セグメントタブ付き（管理画面向け）
    const announcementUnread = this.getUnreadAnnouncementsCount();
    const applicationUnread = this.getUnreadApplicationsCount();

    return `
      <div class="notification-dropdown-header notification-tabs">
        <button class="notification-tab ${this.activeTab === 'announcements' ? 'active' : ''}" data-tab="announcements">
          <span class="tab-icon">📢</span>
          <span class="tab-label">お知らせ</span>
          ${announcementUnread > 0 ? `<span class="tab-badge">${announcementUnread}</span>` : ''}
        </button>
        <button class="notification-tab ${this.activeTab === 'applications' ? 'active' : ''}" data-tab="applications">
          <span class="tab-icon">📩</span>
          <span class="tab-label">応募者</span>
          ${applicationUnread > 0 ? `<span class="tab-badge">${applicationUnread}</span>` : ''}
        </button>
      </div>
    `;
  }

  /**
   * ドロップダウンコンテンツをレンダリング
   */
  renderDropdownContent() {
    if (!this.showApplications || this.activeTab === 'announcements') {
      return this.renderAnnouncementsList();
    } else {
      return this.renderApplicationsList();
    }
  }

  /**
   * お知らせリストをレンダリング
   */
  renderAnnouncementsList() {
    if (this.announcements.length === 0) {
      return '<div class="notification-empty">お知らせはありません</div>';
    }

    const unreadCount = this.getUnreadAnnouncementsCount();

    let html = '';
    if (unreadCount > 0) {
      html += '<button class="mark-all-read-link" data-action="mark-all-announcements">すべて既読にする</button>';
    }

    html += '<div class="notification-list">';
    html += this.announcements.map(a => {
      const isRead = this.readAnnouncementIds.includes(a.id);
      return `
        <div class="notification-item ${isRead ? 'read' : 'unread'}" data-type="announcement" data-id="${a.id}">
          <div class="notification-item-indicator"></div>
          <div class="notification-item-content">
            <div class="notification-item-title">${escapeHtml(a.title)}</div>
            <div class="notification-item-date">${this.formatDate(a.createdAt)}</div>
          </div>
        </div>
      `;
    }).join('');
    html += '</div>';

    return html;
  }

  /**
   * 応募者リストをレンダリング
   */
  renderApplicationsList() {
    if (this.applicationNotifications.length === 0) {
      return '<div class="notification-empty">応募者通知はありません</div>';
    }

    const unreadCount = this.getUnreadApplicationsCount();

    let html = '';
    if (unreadCount > 0) {
      html += '<button class="mark-all-read-link" data-action="mark-all-applications">すべて既読にする</button>';
    }

    html += '<div class="notification-list">';
    html += this.applicationNotifications.map(n => {
      return `
        <div class="notification-item ${n.isRead ? 'read' : 'unread'}" data-type="application" data-id="${n.id}">
          <div class="notification-item-indicator"></div>
          <div class="notification-item-content">
            <div class="notification-item-title">${escapeHtml(n.applicantName || '応募者')}さんが応募しました</div>
            <div class="notification-item-meta">${escapeHtml(n.jobTitle || '')}</div>
            <div class="notification-item-date">${this.formatDateTime(n.createdAt)}</div>
          </div>
        </div>
      `;
    }).join('');
    html += '</div>';

    return html;
  }

  /**
   * バッジを更新
   */
  updateBadge() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const btn = container.querySelector('.notification-bell-btn');
    if (!btn) return;

    const existingBadge = btn.querySelector('.notification-badge');
    const totalUnread = this.getTotalUnreadCount();

    if (totalUnread > 0) {
      if (existingBadge) {
        existingBadge.textContent = totalUnread > 99 ? '99+' : totalUnread;
      } else {
        const badge = document.createElement('span');
        badge.className = 'notification-badge';
        badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
        btn.appendChild(badge);
      }
    } else {
      if (existingBadge) {
        existingBadge.remove();
      }
    }
  }

  /**
   * イベントバインド
   */
  bindEvents() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const bellContainer = container.querySelector('.notification-bell');
    const btn = container.querySelector('.notification-bell-btn');
    const dropdown = container.querySelector('.notification-dropdown');

    if (!btn || !dropdown) return;

    // ベルボタンクリック
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    // ドロップダウン内クリック
    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();

      // タブ切り替え
      const tab = e.target.closest('.notification-tab');
      if (tab) {
        this.activeTab = tab.dataset.tab;
        this.renderDropdownTabs();
        this.renderDropdownContentArea();
        return;
      }

      // すべて既読
      const markAllBtn = e.target.closest('[data-action]');
      if (markAllBtn) {
        const action = markAllBtn.dataset.action;
        if (action === 'mark-all-announcements') {
          this.markAllAnnouncementsAsRead();
        } else if (action === 'mark-all-applications') {
          this.markAllApplicationsAsRead();
        }
        return;
      }

      // 個別アイテムクリック
      const item = e.target.closest('.notification-item');
      if (item) {
        const type = item.dataset.type;
        const id = item.dataset.id;

        if (type === 'announcement') {
          this.markAnnouncementAsRead(id);
          item.classList.remove('unread');
          item.classList.add('read');
          // お知らせ詳細表示（将来的にモーダルで表示可能）
          this.showAnnouncementDetail(id);
        } else if (type === 'application') {
          this.markApplicationAsRead(id);
          item.classList.remove('unread');
          item.classList.add('read');
          // 応募者詳細ページへ遷移
          this.navigateToApplicant(id);
        }
      }
    });

    // 外側クリックで閉じる
    document.addEventListener('click', (e) => {
      if (!bellContainer.contains(e.target)) {
        this.closeDropdown();
      }
    });

    // Escキーで閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isDropdownOpen) {
        this.closeDropdown();
      }
    });
  }

  /**
   * ドロップダウンを開閉
   */
  toggleDropdown() {
    if (this.isDropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  /**
   * ドロップダウンを開く
   */
  openDropdown() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const dropdown = container.querySelector('.notification-dropdown');
    const btn = container.querySelector('.notification-bell-btn');

    if (dropdown) {
      dropdown.style.display = 'block';
      this.isDropdownOpen = true;
      btn?.setAttribute('aria-expanded', 'true');
    }
  }

  /**
   * ドロップダウンを閉じる
   */
  closeDropdown() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const dropdown = container.querySelector('.notification-dropdown');
    const btn = container.querySelector('.notification-bell-btn');

    if (dropdown) {
      dropdown.style.display = 'none';
      this.isDropdownOpen = false;
      btn?.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * タブ部分を再レンダリング
   */
  renderDropdownTabs() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const header = container.querySelector('.notification-dropdown-header');
    if (header && this.showApplications) {
      header.outerHTML = this.renderDropdownHeader();
    }
  }

  /**
   * コンテンツエリアを再レンダリング
   */
  renderDropdownContentArea() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const contentArea = container.querySelector('.notification-dropdown-content');
    if (contentArea) {
      contentArea.innerHTML = this.renderDropdownContent();
    }
  }

  /**
   * お知らせ詳細を表示
   */
  showAnnouncementDetail(id) {
    const announcement = this.announcements.find(a => a.id === id);
    if (!announcement) return;

    // 簡易的なアラート表示（将来的にモーダルに変更可能）
    const content = announcement.content || '';
    if (content) {
      // コンテンツがある場合は詳細モーダルを表示
      this.showDetailModal(announcement);
    }
  }

  /**
   * 詳細モーダルを表示
   */
  showDetailModal(announcement) {
    // 既存のモーダルを削除
    const existingModal = document.getElementById('notification-detail-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'notification-detail-modal';
    modal.className = 'notification-detail-modal';
    modal.innerHTML = `
      <div class="notification-detail-overlay"></div>
      <div class="notification-detail-content">
        <div class="notification-detail-header">
          <h4>${escapeHtml(announcement.title)}</h4>
          <button class="notification-detail-close">&times;</button>
        </div>
        <div class="notification-detail-body">
          <div class="notification-detail-date">${this.formatDate(announcement.createdAt)}</div>
          <div class="notification-detail-text">${escapeHtml(announcement.content).replace(/\n/g, '<br>')}</div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 閉じるボタン
    modal.querySelector('.notification-detail-close').addEventListener('click', () => {
      modal.remove();
    });

    // オーバーレイクリックで閉じる
    modal.querySelector('.notification-detail-overlay').addEventListener('click', () => {
      modal.remove();
    });
  }

  /**
   * 応募者詳細ページへ遷移（admin.html内のjob-manageセクション）
   */
  navigateToApplicant(notificationId) {
    const notification = this.applicationNotifications.find(n => n.id === notificationId);
    if (!notification) return;

    // カスタムイベントを発火してadmin.html内でSPA遷移
    const event = new CustomEvent('navigateToApplicant', {
      detail: {
        applicationId: notification.applicationId,
        companyDomain: notification.companyDomain
      }
    });
    document.dispatchEvent(event);
    this.closeDropdown();
  }

  /**
   * 日付をフォーマット
   */
  formatDate(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * 日時をフォーマット
   */
  formatDateTime(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

export default NotificationBell;
