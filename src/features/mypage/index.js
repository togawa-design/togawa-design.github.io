/**
 * マイページ メインモジュール
 */

import {
  onAuthStateChange,
  getCurrentUser,
  getUserProfile,
  updateUserProfile,
  updatePassword,
  getFirestore
} from '@features/user-auth/auth-service.js';
import { showAuthModal } from '@features/user-auth/auth-modal.js';

let currentSection = 'profile';
let userProfile = null;
let currentApplicationId = null;
let applicationsCache = [];

// 年齢ラベル
const ageLabels = {
  '18-24': '18〜24歳',
  '25-29': '25〜29歳',
  '30-34': '30〜34歳',
  '35-39': '35〜39歳',
  '40-44': '40〜44歳',
  '45-49': '45〜49歳',
  '50+': '50歳以上'
};

// ステータスラベル
const statusLabels = {
  new: '新規',
  contacted: '連絡済み',
  interviewing: '面接調整中',
  interviewed: '面接済み',
  hired: '採用',
  rejected: '不採用',
  withdrawn: '辞退'
};

/**
 * マイページを初期化
 */
export function initMyPage() {
  // URLハッシュからセクションを取得
  const hash = window.location.hash.slice(1);
  if (hash && ['profile', 'applications', 'messages', 'favorites', 'settings'].includes(hash)) {
    currentSection = hash;
  }

  // 認証状態を監視
  onAuthStateChange(async (user) => {
    hideLoading();

    if (user) {
      // ログイン済み
      showContent();
      userProfile = await getUserProfile();
      updateUserInfo(user, userProfile);
      switchSection(currentSection);
    } else {
      // 未ログイン
      showNotLoggedIn();
    }
  });

  // イベントリスナーを設定
  setupEventListeners();
}

/**
 * ローディングを非表示
 */
function hideLoading() {
  const loading = document.getElementById('mypage-loading');
  if (loading) loading.style.display = 'none';
}

/**
 * コンテンツを表示
 */
function showContent() {
  document.getElementById('mypage-not-logged-in').style.display = 'none';
  document.querySelectorAll('.mypage-section').forEach(section => {
    section.style.display = 'none';
  });
}

/**
 * 未ログイン画面を表示
 */
function showNotLoggedIn() {
  document.getElementById('mypage-not-logged-in').style.display = 'flex';
  document.querySelectorAll('.mypage-section').forEach(section => {
    section.style.display = 'none';
  });
}

/**
 * ユーザー情報を更新
 */
function updateUserInfo(user, profile) {
  const displayName = profile?.displayName || profile?.profile?.name || user.displayName || 'ユーザー';
  const email = user.email;
  const photoURL = user.photoURL;

  // サイドバーのユーザー情報
  const avatarEl = document.getElementById('mypage-user-avatar');
  const nameEl = document.getElementById('mypage-user-name');
  const emailEl = document.getElementById('mypage-user-email');

  if (avatarEl) {
    if (photoURL) {
      avatarEl.innerHTML = `<img src="${photoURL}" alt="">`;
    } else {
      avatarEl.innerHTML = `<span class="mypage-user-avatar-placeholder">${displayName.charAt(0)}</span>`;
    }
  }

  if (nameEl) nameEl.textContent = displayName;
  if (emailEl) emailEl.textContent = email;
}

/**
 * セクションを切り替え
 */
function switchSection(sectionId) {
  currentSection = sectionId;

  // ナビゲーションの状態を更新
  document.querySelectorAll('.mypage-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === sectionId);
  });

  // セクションの表示を切り替え
  document.querySelectorAll('.mypage-section').forEach(section => {
    section.style.display = 'none';
  });

  const targetSection = document.getElementById(`section-${sectionId}`);
  if (targetSection) {
    targetSection.style.display = 'block';
  }

  // URLハッシュを更新
  history.replaceState(null, '', `#${sectionId}`);

  // セクション固有のデータを読み込み
  if (sectionId === 'profile') {
    renderProfile();
  } else if (sectionId === 'applications') {
    loadApplications();
  } else if (sectionId === 'messages') {
    loadMessageThreads();
  } else if (sectionId === 'favorites') {
    loadFavorites();
  }
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // ナビゲーション
  document.querySelectorAll('.mypage-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      if (section) {
        switchSection(section);
      }
    });
  });

  // 未ログイン時のログインボタン
  document.getElementById('mypage-login-btn')?.addEventListener('click', () => {
    showAuthModal('login');
  });

  // プロフィール編集
  document.getElementById('btn-edit-profile')?.addEventListener('click', showProfileEditForm);
  document.getElementById('btn-cancel-profile')?.addEventListener('click', hideProfileEditForm);
  document.getElementById('profile-edit-form')?.addEventListener('submit', handleProfileSave);

  // パスワード変更
  document.getElementById('password-form')?.addEventListener('submit', handlePasswordChange);

  // アカウント削除
  document.getElementById('btn-delete-account')?.addEventListener('click', handleDeleteAccount);
}

/**
 * プロフィールを表示
 */
function renderProfile() {
  const user = getCurrentUser();
  if (!user || !userProfile) return;

  const profile = userProfile.profile || {};

  document.getElementById('profile-name').textContent = profile.name || userProfile.displayName || '-';
  document.getElementById('profile-email').textContent = user.email || '-';
  document.getElementById('profile-phone').textContent = profile.phone || '-';
  document.getElementById('profile-age').textContent = ageLabels[profile.age] || profile.age || '-';
  document.getElementById('profile-address').textContent = profile.address || '-';
}

/**
 * プロフィール編集フォームを表示
 */
function showProfileEditForm() {
  const profile = userProfile?.profile || {};

  document.getElementById('edit-name').value = profile.name || userProfile?.displayName || '';
  document.getElementById('edit-phone').value = profile.phone || '';
  document.getElementById('edit-age').value = profile.age || '';
  document.getElementById('edit-address').value = profile.address || '';

  document.getElementById('profile-view').style.display = 'none';
  document.getElementById('profile-edit-form').style.display = 'block';
  document.getElementById('btn-edit-profile').style.display = 'none';
}

/**
 * プロフィール編集フォームを非表示
 */
function hideProfileEditForm() {
  document.getElementById('profile-view').style.display = 'block';
  document.getElementById('profile-edit-form').style.display = 'none';
  document.getElementById('btn-edit-profile').style.display = 'inline-flex';
}

/**
 * プロフィール保存
 */
async function handleProfileSave(e) {
  e.preventDefault();

  const name = document.getElementById('edit-name')?.value?.trim() || '';
  const phone = document.getElementById('edit-phone')?.value?.trim() || '';
  const age = document.getElementById('edit-age')?.value || '';
  const address = document.getElementById('edit-address')?.value?.trim() || '';

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = '保存中...';

  try {
    const result = await updateUserProfile({
      displayName: name,
      profile: {
        name,
        phone,
        age,
        address
      }
    });

    if (result.success) {
      // プロフィールを再取得
      userProfile = await getUserProfile();
      renderProfile();
      hideProfileEditForm();
      updateUserInfo(getCurrentUser(), userProfile);
    } else {
      alert('保存に失敗しました: ' + result.error);
    }
  } catch (error) {
    alert('保存に失敗しました');
    console.error('[MyPage] Profile save error:', error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '保存';
  }
}

/**
 * パスワード変更
 */
async function handlePasswordChange(e) {
  e.preventDefault();

  const newPassword = document.getElementById('new-password')?.value;
  const confirmPassword = document.getElementById('confirm-password')?.value;
  const errorEl = document.getElementById('password-error');
  const successEl = document.getElementById('password-success');

  errorEl.textContent = '';
  successEl.textContent = '';

  if (!newPassword || !confirmPassword) {
    errorEl.textContent = 'すべての項目を入力してください';
    return;
  }

  if (newPassword !== confirmPassword) {
    errorEl.textContent = 'パスワードが一致しません';
    return;
  }

  if (newPassword.length < 6) {
    errorEl.textContent = 'パスワードは6文字以上で設定してください';
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = '変更中...';

  try {
    const result = await updatePassword(newPassword);

    if (result.success) {
      successEl.textContent = result.message;
      e.target.reset();
    } else {
      errorEl.textContent = result.error;
    }
  } catch (error) {
    errorEl.textContent = 'パスワードの変更に失敗しました';
    console.error('[MyPage] Password change error:', error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'パスワードを変更';
  }
}

/**
 * アカウント削除
 */
async function handleDeleteAccount() {
  const confirmed = confirm(
    'アカウントを削除すると、すべてのデータが削除されます。\nこの操作は取り消せません。\n\n本当に削除しますか？'
  );

  if (!confirmed) return;

  const doubleConfirmed = confirm('本当に削除してよろしいですか？');
  if (!doubleConfirmed) return;

  try {
    const user = getCurrentUser();
    if (user) {
      // Firestoreからユーザーデータを削除
      const db = getFirestore();
      if (db) {
        await db.collection('users').doc(user.uid).delete();
      }

      // Firebase Authからユーザーを削除
      await user.delete();

      alert('アカウントを削除しました');
      window.location.href = '/';
    }
  } catch (error) {
    if (error.code === 'auth/requires-recent-login') {
      alert('セキュリティのため、再度ログインしてからお試しください');
    } else {
      alert('アカウントの削除に失敗しました');
    }
    console.error('[MyPage] Delete account error:', error);
  }
}

/**
 * メッセージスレッド一覧を読み込み
 */
async function loadMessageThreads() {
  const user = getCurrentUser();
  if (!user) return;

  const container = document.getElementById('message-threads-list');
  if (!container) return;

  container.innerHTML = '<div class="mypage-loading"><div class="loading-spinner"></div><p>読み込み中...</p></div>';

  try {
    const db = getFirestore();
    if (!db) {
      showMessageThreadsEmpty(container);
      return;
    }

    // メールアドレスで応募履歴を検索
    const snapshot = await db.collection('applications')
      .where('applicant.email', '==', user.email)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    if (snapshot.empty) {
      showMessageThreadsEmpty(container);
      return;
    }

    applicationsCache = [];
    snapshot.forEach(doc => {
      applicationsCache.push({ id: doc.id, ...doc.data() });
    });

    // 各応募の未読メッセージ数を取得
    await loadUnreadCounts();

    renderMessageThreads(container);
  } catch (error) {
    console.error('[MyPage] Load message threads error:', error);
    if (error.code === 'failed-precondition') {
      showMessageThreadsEmpty(container);
    } else {
      container.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 40px;">読み込みに失敗しました</p>';
    }
  }
}

/**
 * 未読メッセージ数を取得
 */
async function loadUnreadCounts() {
  const db = getFirestore();
  if (!db) return;

  let totalUnread = 0;

  for (const app of applicationsCache) {
    try {
      const snapshot = await db.collection('messages')
        .where('applicationId', '==', app.id)
        .where('from', '==', 'company')
        .where('read', '==', false)
        .get();

      app.unreadCount = snapshot.size;
      totalUnread += snapshot.size;
    } catch (error) {
      app.unreadCount = 0;
    }
  }

  // 未読バッジを更新
  const badge = document.getElementById('unread-badge');
  if (badge) {
    if (totalUnread > 0) {
      badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

/**
 * メッセージスレッド一覧の空状態を表示
 */
function showMessageThreadsEmpty(container) {
  container.innerHTML = `
    <div class="mypage-empty-state" style="padding: 40px 20px;">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M43.2 0H4.8C2.16 0 0 2.16 0 4.8V33.6C0 36.24 2.16 38.4 4.8 38.4H38.4L48 48V4.8C48 2.16 45.84 0 43.2 0Z" fill="#e2e8f0"/>
      </svg>
      <h3>メッセージはありません</h3>
      <p>応募すると企業からのメッセージがここに届きます</p>
    </div>
  `;

  // 右側も空状態を表示
  const detail = document.getElementById('message-detail');
  if (detail) {
    detail.innerHTML = `
      <div class="message-detail-empty">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M43.2 0H4.8C2.16 0 0 2.16 0 4.8V33.6C0 36.24 2.16 38.4 4.8 38.4H38.4L48 48V4.8C48 2.16 45.84 0 43.2 0ZM38.4 28.8H9.6V24H38.4V28.8ZM38.4 21.6H9.6V16.8H38.4V21.6ZM38.4 14.4H9.6V9.6H38.4V14.4Z" fill="#e2e8f0"/>
        </svg>
        <p>応募すると企業とメッセージのやり取りができます</p>
      </div>
    `;
  }
}

/**
 * メッセージスレッド一覧を描画
 */
function renderMessageThreads(container) {
  container.innerHTML = applicationsCache.map(app => {
    const date = app.createdAt?.toDate
      ? app.createdAt.toDate()
      : new Date(app.timestamp || app.createdAt);
    const dateStr = formatDate(date);
    const isActive = currentApplicationId === app.id;

    return `
      <div class="message-thread-item ${isActive ? 'active' : ''}" data-application-id="${escapeHtml(app.id)}">
        <div class="message-thread-content">
          <div class="message-thread-title">${escapeHtml(app.jobTitle || '-')}</div>
          <div class="message-thread-company">${escapeHtml(app.companyName || '-')}</div>
          <div class="message-thread-date">応募日: ${escapeHtml(dateStr)}</div>
        </div>
        ${app.unreadCount > 0 ? `<span class="message-thread-unread">${app.unreadCount}</span>` : ''}
      </div>
    `;
  }).join('');

  // クリックイベント
  container.querySelectorAll('.message-thread-item').forEach(item => {
    item.addEventListener('click', () => {
      const applicationId = item.dataset.applicationId;
      selectMessageThread(applicationId);
    });
  });
}

/**
 * メッセージスレッドを選択
 */
async function selectMessageThread(applicationId) {
  currentApplicationId = applicationId;

  // アクティブ状態を更新
  document.querySelectorAll('.message-thread-item').forEach(item => {
    item.classList.toggle('active', item.dataset.applicationId === applicationId);
  });

  // メッセージを読み込み
  await loadMessages(applicationId);
}

/**
 * メッセージを読み込み
 */
async function loadMessages(applicationId) {
  const detail = document.getElementById('message-detail');
  if (!detail) return;

  const app = applicationsCache.find(a => a.id === applicationId);
  if (!app) return;

  detail.innerHTML = '<div class="mypage-loading"><div class="loading-spinner"></div><p>読み込み中...</p></div>';

  try {
    const db = getFirestore();
    if (!db) {
      detail.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 40px;">読み込みに失敗しました</p>';
      return;
    }

    const snapshot = await db.collection('messages')
      .where('applicationId', '==', applicationId)
      .orderBy('createdAt', 'asc')
      .get();

    const messages = [];
    snapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data() });
    });

    // 未読メッセージを既読に更新
    await markMessagesAsRead(messages, db);

    renderMessageDetail(detail, app, messages);
  } catch (error) {
    console.error('[MyPage] Load messages error:', error);
    detail.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 40px;">メッセージの読み込みに失敗しました</p>';
  }
}

/**
 * 未読メッセージを既読に更新
 */
async function markMessagesAsRead(messages, db) {
  const unreadMessages = messages.filter(m => m.from === 'company' && !m.read);

  for (const msg of unreadMessages) {
    try {
      await db.collection('messages').doc(msg.id).update({ read: true });
    } catch (error) {
      console.error('[MyPage] Mark as read error:', error);
    }
  }

  // 未読カウントを更新
  const app = applicationsCache.find(a => a.id === currentApplicationId);
  if (app) {
    app.unreadCount = 0;
    // スレッド一覧を再描画
    const container = document.getElementById('message-threads-list');
    if (container) {
      renderMessageThreads(container);
    }
    // 未読バッジを更新
    await loadUnreadCounts();
  }
}

/**
 * メッセージ詳細を描画
 */
function renderMessageDetail(container, app, messages) {
  const statusLabel = statusLabels[app.status] || app.status || '新規';

  container.innerHTML = `
    <div class="message-detail-header">
      <div class="message-detail-title">${escapeHtml(app.jobTitle || '-')}</div>
      <div class="message-detail-meta">
        <span>${escapeHtml(app.companyName || '-')}</span>
        <span class="status-badge status-${app.status || 'new'}">${escapeHtml(statusLabel)}</span>
      </div>
    </div>
    <div class="message-list" id="message-list">
      ${messages.length === 0 ? `
        <div class="message-empty">
          <p>まだメッセージはありません</p>
        </div>
      ` : messages.map(msg => {
        const date = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
        const isCompany = msg.from === 'company';
        const senderLabel = isCompany ? app.companyName || '企業' : 'あなた';

        return `
          <div class="message-bubble ${isCompany ? 'message-from-company' : 'message-from-user'}">
            <div class="message-bubble-header">
              <span class="message-sender">${escapeHtml(senderLabel)}</span>
              <span class="message-time">${formatDateTime(date)}</span>
            </div>
            <div class="message-bubble-content">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }).join('')}
    </div>
    <div class="message-input-area">
      <textarea id="reply-message-text" rows="3" placeholder="メッセージを入力..."></textarea>
      <button id="btn-send-reply" class="btn-primary">送信</button>
    </div>
  `;

  // スクロールを最下部へ
  const messageList = document.getElementById('message-list');
  if (messageList) {
    messageList.scrollTop = messageList.scrollHeight;
  }

  // 送信ボタンのイベント
  document.getElementById('btn-send-reply')?.addEventListener('click', sendReplyMessage);

  // Ctrl+Enterで送信
  document.getElementById('reply-message-text')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendReplyMessage();
    }
  });
}

/**
 * 返信メッセージを送信
 */
async function sendReplyMessage() {
  if (!currentApplicationId) return;

  const input = document.getElementById('reply-message-text');
  const content = input?.value?.trim();

  if (!content) {
    alert('メッセージを入力してください');
    return;
  }

  const sendBtn = document.getElementById('btn-send-reply');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = '送信中...';
  }

  try {
    const db = getFirestore();
    if (!db) throw new Error('Firestore not available');

    const app = applicationsCache.find(a => a.id === currentApplicationId);

    await db.collection('messages').add({
      applicationId: currentApplicationId,
      companyDomain: app?.companyDomain || '',
      from: 'applicant',
      content,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 入力をクリア
    input.value = '';

    // メッセージを再読み込み
    await loadMessages(currentApplicationId);

  } catch (error) {
    console.error('[MyPage] Send message error:', error);
    alert('メッセージの送信に失敗しました');
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = '送信';
    }
  }
}

/**
 * 日時をフォーマット
 */
function formatDateTime(date) {
  if (!date) return '-';
  const d = new Date(date);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

/**
 * 応募履歴を読み込み
 */
async function loadApplications() {
  const user = getCurrentUser();
  if (!user) return;

  const container = document.getElementById('applications-list');
  if (!container) return;

  container.innerHTML = '<div class="mypage-loading"><div class="loading-spinner"></div><p>読み込み中...</p></div>';

  try {
    const db = getFirestore();
    if (!db) {
      showApplicationsEmpty(container);
      return;
    }

    // メールアドレスで応募履歴を検索
    const snapshot = await db.collection('applications')
      .where('applicant.email', '==', user.email)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    if (snapshot.empty) {
      showApplicationsEmpty(container);
      return;
    }

    const applications = [];
    snapshot.forEach(doc => {
      applications.push({ id: doc.id, ...doc.data() });
    });

    renderApplications(container, applications);
  } catch (error) {
    console.error('[MyPage] Load applications error:', error);
    // インデックスエラーの場合は空を表示
    if (error.code === 'failed-precondition') {
      showApplicationsEmpty(container);
    } else {
      container.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 40px;">応募履歴の読み込みに失敗しました</p>';
    }
  }
}

/**
 * 応募履歴の空状態を表示
 */
function showApplicationsEmpty(container) {
  container.innerHTML = `
    <div class="mypage-empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M42 6H30.33C29.45 3.15 26.79 1 23.67 1C20.55 1 17.89 3.15 17.01 6H6C3.79 6 2 7.79 2 10V42C2 44.21 3.79 46 6 46H42C44.21 46 46 44.21 46 42V10C46 7.79 44.21 6 42 6ZM24 6C25.1 6 26 6.9 26 8C26 9.1 25.1 10 24 10C22.9 10 22 9.1 22 8C22 6.9 22.9 6 24 6Z" fill="#e2e8f0"/>
      </svg>
      <h3>応募履歴がありません</h3>
      <p>求人に応募すると、ここに履歴が表示されます</p>
      <a href="jobs.html" class="btn-primary">求人を探す</a>
    </div>
  `;
}

/**
 * 応募履歴を描画
 */
function renderApplications(container, applications) {
  container.innerHTML = applications.map(app => {
    const date = app.createdAt?.toDate
      ? app.createdAt.toDate()
      : new Date(app.timestamp || app.createdAt);
    const dateStr = formatDate(date);
    const status = app.status || 'new';
    const statusLabel = statusLabels[status] || status;

    return `
      <div class="application-card">
        <div class="application-card-body">
          <h3 class="application-card-title">${escapeHtml(app.jobTitle || '-')}</h3>
          <p class="application-card-company">${escapeHtml(app.companyName || '-')}</p>
          <div class="application-card-meta">
            <span>応募日: ${escapeHtml(dateStr)}</span>
          </div>
        </div>
        <div class="application-card-status">
          <span class="status-badge status-${status}">${escapeHtml(statusLabel)}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * お気に入りを読み込み
 */
async function loadFavorites() {
  const user = getCurrentUser();
  if (!user) return;

  const container = document.getElementById('favorites-list');
  if (!container) return;

  container.innerHTML = '<div class="mypage-loading"><div class="loading-spinner"></div><p>読み込み中...</p></div>';

  try {
    const db = getFirestore();
    if (!db) {
      showFavoritesEmpty(container);
      return;
    }

    const snapshot = await db.collection('favorites')
      .where('userId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    if (snapshot.empty) {
      showFavoritesEmpty(container);
      return;
    }

    const favorites = [];
    snapshot.forEach(doc => {
      favorites.push({ id: doc.id, ...doc.data() });
    });

    renderFavorites(container, favorites);
  } catch (error) {
    console.error('[MyPage] Load favorites error:', error);
    // インデックスエラーの場合は空を表示
    if (error.code === 'failed-precondition') {
      showFavoritesEmpty(container);
    } else {
      container.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 40px;">お気に入りの読み込みに失敗しました</p>';
    }
  }
}

/**
 * お気に入りの空状態を表示
 */
function showFavoritesEmpty(container) {
  container.innerHTML = `
    <div class="mypage-empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M24 42L20.55 38.925C8.4 27.9 0 20.4 0 11.4C0 3.9 5.85 -2 13.2 -2C17.4 -2 21.42 -0.02 24 3.18C26.58 -0.02 30.6 -2 34.8 -2C42.15 -2 48 3.9 48 11.4C48 20.4 39.6 27.9 27.45 38.925L24 42Z" fill="#e2e8f0" transform="translate(0, 5)"/>
      </svg>
      <h3>お気に入りがありません</h3>
      <p>気になる求人をお気に入りに追加すると、ここに表示されます</p>
      <a href="jobs.html" class="btn-primary">求人を探す</a>
    </div>
  `;
}

/**
 * お気に入りを描画
 */
function renderFavorites(container, favorites) {
  container.innerHTML = favorites.map(fav => {
    const jobUrl = `job-detail.html?company=${encodeURIComponent(fav.companyDomain)}&job=${encodeURIComponent(fav.jobId)}`;

    return `
      <div class="favorite-card" data-favorite-id="${escapeHtml(fav.id)}">
        <div class="favorite-card-body">
          <a href="${jobUrl}" class="favorite-card-title">${escapeHtml(fav.jobTitle || '-')}</a>
          <p class="favorite-card-company">${escapeHtml(fav.companyName || '-')}</p>
          <div class="favorite-card-meta">
            ${fav.location ? `<span>${escapeHtml(fav.location)}</span>` : ''}
            ${fav.monthlySalary ? `<span>${escapeHtml(fav.monthlySalary)}</span>` : ''}
          </div>
        </div>
        <div class="favorite-card-actions">
          <a href="${jobUrl}" class="btn-secondary-small">詳細を見る</a>
          <button class="btn-remove-favorite" data-favorite-id="${escapeHtml(fav.id)}" title="お気に入りから削除">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // 削除ボタンのイベント
  container.querySelectorAll('.btn-remove-favorite').forEach(btn => {
    btn.addEventListener('click', async () => {
      const favoriteId = btn.dataset.favoriteId;
      if (confirm('お気に入りから削除しますか？')) {
        await removeFavorite(favoriteId);
      }
    });
  });
}

/**
 * お気に入りを削除
 */
async function removeFavorite(favoriteId) {
  try {
    const db = getFirestore();
    if (!db) return;

    await db.collection('favorites').doc(favoriteId).delete();

    // UIから削除
    const card = document.querySelector(`[data-favorite-id="${favoriteId}"]`);
    if (card) {
      card.remove();
    }

    // 空になったら空状態を表示
    const container = document.getElementById('favorites-list');
    if (container && container.children.length === 0) {
      showFavoritesEmpty(container);
    }
  } catch (error) {
    console.error('[MyPage] Remove favorite error:', error);
    alert('削除に失敗しました');
  }
}

/**
 * 日付をフォーマット
 */
function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

/**
 * HTMLエスケープ
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export default {
  initMyPage
};
