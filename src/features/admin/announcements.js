/**
 * Admin Dashboard - お知らせ管理
 *
 * Admin権限のみが使用可能なお知らせCRUD機能
 */

import { isAdmin, getCurrentUserEmail } from './auth.js';
import {
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} from '@features/notifications/notification-service.js';
import { escapeHtml, showToast } from '@shared/utils.js';

// キャッシュ
let announcementsCache = [];
let currentEditingId = null;
let deleteTargetId = null;

// フィルター状態
let currentStatusFilter = 'all';
let currentTargetFilter = 'all';

/**
 * お知らせ管理セクションを初期化
 */
export async function initAnnouncementsSection() {
  // Admin権限チェック
  if (!isAdmin()) {
    console.warn('[Announcements] Admin permission required');
    const tbody = document.getElementById('announcements-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="error-cell">この機能は管理者のみ利用できます</td></tr>';
    }
    return;
  }

  await loadAnnouncementsData();
  bindEvents();
}

/**
 * お知らせデータを読み込み
 */
async function loadAnnouncementsData() {
  const tbody = document.getElementById('announcements-tbody');
  const emptyState = document.getElementById('announcements-empty');
  const table = document.getElementById('announcements-table');

  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データを読み込み中...</td></tr>';
  }

  try {
    announcementsCache = await getAllAnnouncements();
    renderAnnouncementsTable();
  } catch (error) {
    console.error('[Announcements] Load error:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="error-cell">データの読み込みに失敗しました</td></tr>';
    }
    showToast('お知らせの読み込みに失敗しました', 'error');
  }
}

/**
 * テーブルを描画
 */
function renderAnnouncementsTable() {
  const tbody = document.getElementById('announcements-tbody');
  const emptyState = document.getElementById('announcements-empty');
  const table = document.getElementById('announcements-table');

  if (!tbody) return;

  // フィルタリング
  let filtered = announcementsCache;

  if (currentStatusFilter !== 'all') {
    filtered = filtered.filter(a => a.status === currentStatusFilter);
  }

  if (currentTargetFilter !== 'all') {
    filtered = filtered.filter(a => a.targetAudience === currentTargetFilter || a.targetAudience === 'all');
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (table) table.style.display = '';
  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = filtered.map(announcement => {
    const targetLabel = getTargetLabel(announcement.targetAudience);
    const statusLabel = getStatusLabel(announcement.status);
    const statusClass = announcement.status === 'published' ? 'status-active' : 'status-inactive';
    const periodStr = formatPeriod(announcement.publishStartDate, announcement.publishEndDate);
    const createdStr = formatDate(announcement.createdAt);

    return `
      <tr data-id="${announcement.id}">
        <td>
          <strong>${escapeHtml(announcement.title)}</strong>
          <div class="text-muted text-small">${escapeHtml(truncate(announcement.content, 50))}</div>
        </td>
        <td><span class="badge badge-${getBadgeClass(announcement.targetAudience)}">${targetLabel}</span></td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td>${periodStr}</td>
        <td>${createdStr}</td>
        <td class="actions-cell">
          <button class="btn-icon btn-edit" data-id="${announcement.id}" title="編集">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-icon btn-delete" data-id="${announcement.id}" title="削除">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * イベントをバインド
 */
function bindEvents() {
  // 新規作成ボタン
  const addBtn = document.getElementById('btn-add-announcement');
  if (addBtn && !addBtn.hasAttribute('data-listener-attached')) {
    addBtn.addEventListener('click', () => showAnnouncementModal());
    addBtn.setAttribute('data-listener-attached', 'true');
  }

  // フィルター
  const statusFilter = document.getElementById('announcement-status-filter');
  if (statusFilter && !statusFilter.hasAttribute('data-listener-attached')) {
    statusFilter.addEventListener('change', (e) => {
      currentStatusFilter = e.target.value;
      renderAnnouncementsTable();
    });
    statusFilter.setAttribute('data-listener-attached', 'true');
  }

  const targetFilter = document.getElementById('announcement-target-filter');
  if (targetFilter && !targetFilter.hasAttribute('data-listener-attached')) {
    targetFilter.addEventListener('change', (e) => {
      currentTargetFilter = e.target.value;
      renderAnnouncementsTable();
    });
    targetFilter.setAttribute('data-listener-attached', 'true');
  }

  // フォーム送信
  const form = document.getElementById('announcement-form');
  if (form && !form.hasAttribute('data-listener-attached')) {
    form.addEventListener('submit', handleFormSubmit);
    form.setAttribute('data-listener-attached', 'true');
  }

  // テーブル内のボタン（イベント委譲）
  const tbody = document.getElementById('announcements-tbody');
  if (tbody && !tbody.hasAttribute('data-listener-attached')) {
    tbody.addEventListener('click', handleTableClick);
    tbody.setAttribute('data-listener-attached', 'true');
  }

  // 削除確認ボタン
  const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
  if (confirmDeleteBtn && !confirmDeleteBtn.hasAttribute('data-listener-attached')) {
    confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    confirmDeleteBtn.setAttribute('data-listener-attached', 'true');
  }
}

/**
 * テーブルクリックハンドラ（イベント委譲）
 */
function handleTableClick(e) {
  const editBtn = e.target.closest('.btn-edit');
  const deleteBtn = e.target.closest('.btn-delete');

  if (editBtn) {
    const id = editBtn.dataset.id;
    const announcement = announcementsCache.find(a => a.id === id);
    if (announcement) {
      showAnnouncementModal(announcement);
    }
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    const announcement = announcementsCache.find(a => a.id === id);
    if (announcement) {
      showDeleteModal(announcement);
    }
  }
}

/**
 * お知らせモーダルを表示
 */
function showAnnouncementModal(announcement = null) {
  const modal = document.getElementById('announcement-modal');
  const title = document.getElementById('announcement-modal-title');
  const form = document.getElementById('announcement-form');

  if (!modal || !form) return;

  // フォームをリセット
  form.reset();

  if (announcement) {
    // 編集モード
    currentEditingId = announcement.id;
    title.textContent = 'お知らせを編集';

    document.getElementById('announcement-id').value = announcement.id;
    document.getElementById('announcement-title').value = announcement.title || '';
    document.getElementById('announcement-content').value = announcement.content || '';
    document.getElementById('announcement-target').value = announcement.targetAudience || 'all';
    document.getElementById('announcement-status').value = announcement.status || 'draft';
    document.getElementById('announcement-priority').value = announcement.priority || 0;

    // 日付フィールド
    if (announcement.publishStartDate) {
      document.getElementById('announcement-start-date').value = formatDateForInput(announcement.publishStartDate);
    }
    if (announcement.publishEndDate) {
      document.getElementById('announcement-end-date').value = formatDateForInput(announcement.publishEndDate);
    }
  } else {
    // 新規作成モード
    currentEditingId = null;
    title.textContent = '新規お知らせ';

    // デフォルト日付を設定
    const today = new Date();
    const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    document.getElementById('announcement-start-date').value = formatDateForInput(today);
    document.getElementById('announcement-end-date').value = formatDateForInput(nextMonth);
  }

  modal.style.display = 'flex';
}

/**
 * お知らせモーダルを閉じる
 */
window.closeAnnouncementModal = function() {
  const modal = document.getElementById('announcement-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  currentEditingId = null;
};

/**
 * 削除モーダルを表示
 */
function showDeleteModal(announcement) {
  const modal = document.getElementById('announcement-delete-modal');
  const titleEl = document.getElementById('delete-announcement-title');

  if (!modal) return;

  deleteTargetId = announcement.id;
  if (titleEl) {
    titleEl.textContent = announcement.title;
  }

  modal.style.display = 'flex';
}

/**
 * 削除モーダルを閉じる
 */
window.closeDeleteModal = function() {
  const modal = document.getElementById('announcement-delete-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  deleteTargetId = null;
};

/**
 * フォーム送信ハンドラ
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const saveBtn = document.getElementById('btn-save-announcement');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';
  }

  try {
    const data = {
      title: document.getElementById('announcement-title').value.trim(),
      content: document.getElementById('announcement-content').value.trim(),
      targetAudience: document.getElementById('announcement-target').value,
      status: document.getElementById('announcement-status').value,
      priority: parseInt(document.getElementById('announcement-priority').value, 10) || 0,
      publishStartDate: document.getElementById('announcement-start-date').value,
      publishEndDate: document.getElementById('announcement-end-date').value,
      createdBy: getCurrentUserEmail() || ''
    };

    if (currentEditingId) {
      // 更新
      await updateAnnouncement(currentEditingId, data);
      showToast('お知らせを更新しました', 'success');
    } else {
      // 新規作成
      await createAnnouncement(data);
      showToast('お知らせを作成しました', 'success');
    }

    closeAnnouncementModal();
    await loadAnnouncementsData();

  } catch (error) {
    console.error('[Announcements] Save error:', error);
    showToast('保存に失敗しました: ' + error.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存';
    }
  }
}

/**
 * 削除確認ハンドラ
 */
async function handleConfirmDelete() {
  if (!deleteTargetId) return;

  const confirmBtn = document.getElementById('btn-confirm-delete');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '削除中...';
  }

  try {
    await deleteAnnouncement(deleteTargetId);
    showToast('お知らせを削除しました', 'success');
    closeDeleteModal();
    await loadAnnouncementsData();

  } catch (error) {
    console.error('[Announcements] Delete error:', error);
    showToast('削除に失敗しました: ' + error.message, 'error');
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = '削除';
    }
  }
}

// ========================================
// ヘルパー関数
// ========================================

function getTargetLabel(target) {
  const labels = {
    'all': '全員',
    'job_seekers': '求職者',
    'company_users': '会社ユーザー'
  };
  return labels[target] || target;
}

function getStatusLabel(status) {
  const labels = {
    'published': '公開中',
    'draft': '下書き'
  };
  return labels[status] || status;
}

function getBadgeClass(target) {
  const classes = {
    'all': 'info',
    'job_seekers': 'primary',
    'company_users': 'secondary'
  };
  return classes[target] || 'default';
}

function formatDate(date) {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateForInput(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatPeriod(start, end) {
  const startStr = formatDate(start);
  const endStr = formatDate(end);
  return `${startStr} 〜 ${endStr}`;
}

function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

export default {
  initAnnouncementsSection
};
