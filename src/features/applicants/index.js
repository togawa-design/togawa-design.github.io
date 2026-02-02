/**
 * 応募者管理機能モジュール（サイドパネル版）
 */
import { escapeHtml } from '@shared/utils.js';

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyB3eXZoFkXOwnHxPvaHiWO7csmZK4KGqAQ",
  authDomain: "generated-area-484613-e3-90bd4.firebaseapp.com",
  projectId: "generated-area-484613-e3-90bd4"
};

// 状態
let companyDomain = null;
let companyName = null;
let applicantsCache = [];
let filteredApplicants = [];
let currentPage = 1;
const itemsPerPage = 20;
let currentApplicantId = null;
let assigneesCache = [];

// IDプレフィックス（admin.html埋め込み時は 'jm-'）
let idPrefix = '';

/**
 * IDプレフィックスを適用してDOM要素を取得
 */
function getEl(id) {
  return document.getElementById(idPrefix + id);
}

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

// 種別ラベル
const typeLabels = {
  apply: '応募',
  line: 'LINE相談',
  consult: 'お問い合わせ'
};

// 希望勤務開始日ラベル
const startDateLabels = {
  immediate: 'すぐにでも',
  'within-week': '1週間以内',
  'within-month': '1ヶ月以内',
  'within-2months': '2ヶ月以内',
  undecided: '未定・相談したい'
};

// メッセージテンプレート
const messageTemplates = {
  first_contact: {
    subject: '初回連絡',
    body: `{applicantName}様

この度は「{jobTitle}」にご応募いただき、誠にありがとうございます。

ご応募内容を確認させていただきました。
つきましては、一度お電話にてお話をさせていただければと思います。

ご都合の良い日時をいくつかお知らせいただけますでしょうか。
（平日10:00〜18:00の間でお願いできますと幸いです）

ご不明な点がございましたら、お気軽にお問い合わせください。
何卒よろしくお願いいたします。`
  },
  schedule_interview: {
    subject: '面接日程調整',
    body: `{applicantName}様

お世話になっております。

面接の日程調整についてご連絡いたします。

下記の日程でご都合の良い日時はございますでしょうか。

【候補日】
・◯月◯日（◯）◯◯:00〜
・◯月◯日（◯）◯◯:00〜
・◯月◯日（◯）◯◯:00〜

上記以外でもご調整可能ですので、ご希望の日時がございましたらお知らせください。

何卒よろしくお願いいたします。`
  },
  interview_reminder: {
    subject: '面接リマインダー',
    body: `{applicantName}様

お世話になっております。

面接日程のリマインドをお送りいたします。

【面接日時】◯月◯日（◯）◯◯:00〜
【場所】〒◯◯◯-◯◯◯◯ ◯◯県◯◯市◯◯
【持ち物】履歴書、筆記用具

ご不明な点がございましたら、お気軽にお問い合わせください。
当日お会いできることを楽しみにしております。`
  },
  document_request: {
    subject: '書類提出依頼',
    body: `{applicantName}様

お世話になっております。

選考を進めるにあたり、下記の書類をご提出いただけますでしょうか。

【提出書類】
・履歴書（写真貼付）
・職務経歴書

【提出方法】
マイページからアップロード、またはメールにてご送付ください。

【提出期限】
◯月◯日（◯）まで

ご不明な点がございましたら、お気軽にお問い合わせください。
何卒よろしくお願いいたします。`
  },
  result_pending: {
    subject: '選考結果待ち',
    body: `{applicantName}様

お世話になっております。

先日は面接にお越しいただき、誠にありがとうございました。

現在、社内にて選考を進めております。
結果につきましては、◯月◯日頃までにご連絡させていただく予定です。

今しばらくお待ちいただけますようお願い申し上げます。`
  },
  offer: {
    subject: '内定通知',
    body: `{applicantName}様

お世話になっております。

この度は「{jobTitle}」の選考にご参加いただき、誠にありがとうございました。

慎重に検討させていただいた結果、{applicantName}様を採用させていただくことになりました。

つきましては、入社に関する詳細についてご説明させていただきたく、
お電話にてご連絡させていただきます。

ご不明な点がございましたら、お気軽にお問い合わせください。
{applicantName}様と一緒に働けることを楽しみにしております。`
  },
  rejection: {
    subject: '不採用通知',
    body: `{applicantName}様

お世話になっております。

この度は「{jobTitle}」にご応募いただき、誠にありがとうございました。

慎重に検討させていただきましたが、誠に残念ながら今回はご期待に沿えない結果となりました。

ご応募いただいたことに心より感謝申し上げますとともに、
{applicantName}様の今後のご活躍をお祈り申し上げます。`
  }
};

/**
 * Firebase初期化
 */
function initFirebase() {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  return firebase.firestore();
}

/**
 * 担当者リストを読み込み
 */
async function loadAssignees() {
  try {
    const db = initFirebase();
    const docRef = db.collection('settings').doc(companyDomain || 'global');
    const doc = await docRef.get();

    if (doc.exists && doc.data().assignees) {
      assigneesCache = doc.data().assignees;
    } else {
      assigneesCache = [];
    }

    updateAssigneeSelects();
  } catch (error) {
    console.error('Failed to load assignees:', error);
    assigneesCache = [];
  }
}

/**
 * 担当者セレクトボックスを更新
 */
function updateAssigneeSelects() {
  const detailSelect = getEl('detail-assignee');
  if (detailSelect) {
    const currentValue = detailSelect.value;
    detailSelect.innerHTML = '<option value="">未割当</option>' +
      assigneesCache.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
    detailSelect.value = currentValue;
  }
}

/**
 * 担当者を追加
 */
async function addAssignee() {
  const input = getEl('new-assignee-name');
  const name = input?.value?.trim();

  if (!name) {
    alert('担当者名を入力してください');
    return;
  }

  if (assigneesCache.includes(name)) {
    alert('この担当者は既に登録されています');
    return;
  }

  try {
    const db = initFirebase();
    const docRef = db.collection('settings').doc(companyDomain || 'global');

    assigneesCache.push(name);

    await docRef.set({
      assignees: assigneesCache,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    updateAssigneeSelects();
    closeAssigneeModal();

    const detailSelect = getEl('detail-assignee');
    if (detailSelect) {
      detailSelect.value = name;
    }

  } catch (error) {
    console.error('Failed to add assignee:', error);
    alert('担当者の追加に失敗しました: ' + error.message);
  }
}

/**
 * 担当者追加モーダルを表示
 */
function showAssigneeModal() {
  const modal = getEl('assignee-modal');
  const input = getEl('new-assignee-name');
  if (modal) modal.style.display = 'flex';
  if (input) {
    input.value = '';
    input.focus();
  }
}

/**
 * 担当者追加モーダルを閉じる
 */
function closeAssigneeModal() {
  const modal = getEl('assignee-modal');
  if (modal) modal.style.display = 'none';
}

/**
 * 応募者データを読み込み
 */
async function loadApplicantsData() {
  const listContainer = getEl('applicants-list');
  if (listContainer) {
    listContainer.innerHTML = '<div class="loading-message">データを読み込み中...</div>';
  }

  try {
    const db = initFirebase();

    let query = db.collection('applications');

    if (companyDomain) {
      query = query.where('companyDomain', '==', companyDomain);
    }

    query = query.orderBy('createdAt', 'desc');

    const snapshot = await query.get();

    applicantsCache = [];
    snapshot.forEach(doc => {
      applicantsCache.push({
        id: doc.id,
        ...doc.data()
      });
    });

    applyFilters();
    updateStats();

  } catch (error) {
    console.error('Failed to load applicants:', error);
    if (listContainer) {
      listContainer.innerHTML = `<div class="empty-message">データの読み込みに失敗しました</div>`;
    }
  }
}

/**
 * フィルターを適用
 */
function applyFilters() {
  const statusFilter = getEl('filter-status')?.value || '';
  const typeFilter = getEl('filter-type')?.value || '';
  const searchText = getEl('filter-search')?.value?.toLowerCase() || '';

  filteredApplicants = applicantsCache.filter(app => {
    if (statusFilter && (app.status || 'new') !== statusFilter) {
      return false;
    }

    if (typeFilter && app.type !== typeFilter) {
      return false;
    }

    if (searchText) {
      const jobTitle = (app.jobTitle || '').toLowerCase();
      const applicantName = (app.applicantName || app.applicant?.name || '').toLowerCase();
      if (!jobTitle.includes(searchText) && !applicantName.includes(searchText)) {
        return false;
      }
    }

    return true;
  });

  currentPage = 1;
  renderApplicantsList();
  renderPagination();
}

/**
 * 統計を更新
 */
function updateStats() {
  const total = applicantsCache.length;
  const newCount = applicantsCache.filter(a => !a.status || a.status === 'new').length;
  const progressCount = applicantsCache.filter(a =>
    ['contacted', 'interviewing', 'interviewed'].includes(a.status)
  ).length;
  const completeCount = applicantsCache.filter(a =>
    ['hired', 'rejected', 'withdrawn'].includes(a.status)
  ).length;

  const statTotal = getEl('stat-total');
  const statNew = getEl('stat-new');
  const statProgress = getEl('stat-progress');
  const statComplete = getEl('stat-complete');

  if (statTotal) statTotal.textContent = total;
  if (statNew) statNew.textContent = newCount;
  if (statProgress) statProgress.textContent = progressCount;
  if (statComplete) statComplete.textContent = completeCount;
}

/**
 * 応募者リストを描画（カード形式）
 */
function renderApplicantsList() {
  const listContainer = getEl('applicants-list');
  if (!listContainer) return;

  if (filteredApplicants.length === 0) {
    listContainer.innerHTML = '<div class="empty-message">応募データがありません</div>';
    return;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageApplicants = filteredApplicants.slice(startIndex, endIndex);

  listContainer.innerHTML = pageApplicants.map(app => {
    const date = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.timestamp || app.createdAt);
    const dateStr = formatDate(date);
    const status = app.status || 'new';
    const typeLabel = typeLabels[app.type] || app.type || '-';
    const statusLabel = statusLabels[status] || status;
    const applicantName = app.applicantName || app.applicant?.name || '-';
    const isSelected = currentApplicantId === app.id;

    let typeClass = 'type-apply';
    if (app.type === 'line') typeClass = 'type-line';
    if (app.type === 'consult') typeClass = 'type-consult';

    return `
      <div class="applicant-card ${isSelected ? 'selected' : ''}" data-id="${escapeHtml(app.id)}">
        <div class="applicant-card-main">
          <div class="applicant-card-header">
            <span class="applicant-card-name">${escapeHtml(applicantName)}</span>
            <span class="applicant-card-type ${typeClass}">${escapeHtml(typeLabel)}</span>
          </div>
          <div class="applicant-card-job">${escapeHtml(app.jobTitle || '-')}</div>
          <div class="applicant-card-meta">
            <span>${escapeHtml(dateStr)}</span>
            ${app.assignee ? `<span>担当: ${escapeHtml(app.assignee)}</span>` : ''}
          </div>
        </div>
        <div class="applicant-card-status">
          <span class="status-badge status-${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
        </div>
      </div>
    `;
  }).join('');

  // カードクリックイベント
  listContainer.querySelectorAll('.applicant-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      showApplicantDetail(id);
    });
  });
}

/**
 * ページネーションを描画
 */
function renderPagination() {
  const pagination = getEl('pagination');
  if (!pagination) return;

  const totalPages = Math.ceil(filteredApplicants.length / itemsPerPage);

  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">前へ</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += '<span class="page-ellipsis">...</span>';
    }
  }

  html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">次へ</button>`;

  pagination.innerHTML = html;

  pagination.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      currentPage = parseInt(btn.dataset.page);
      renderApplicantsList();
      renderPagination();
    });
  });
}

/**
 * 応募者詳細を表示（サイドパネル）
 */
function showApplicantDetail(id) {
  const applicant = applicantsCache.find(a => a.id === id);
  if (!applicant) return;

  currentApplicantId = id;

  // 選択状態を更新
  document.querySelectorAll('.applicant-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.id === id);
  });

  // パネル表示を切り替え
  const emptyState = getEl('detail-empty');
  const detailContent = getEl('detail-content');

  if (emptyState) emptyState.style.display = 'none';
  if (detailContent) detailContent.style.display = 'flex';

  // 応募者情報を設定
  const applicantName = applicant.applicantName || applicant.applicant?.name || '-';
  const applicantPhone = applicant.applicantPhone || applicant.applicant?.phone || '-';
  const applicantEmail = applicant.applicantEmail || applicant.applicant?.email || '-';
  const applicantAge = applicant.applicant?.age || '-';
  const applicantAddress = applicant.applicant?.address || '-';
  const startDate = applicant.applicant?.startDate || '-';

  getEl('detail-name').textContent = applicantName;
  getEl('detail-job-title').textContent = applicant.jobTitle || '-';
  getEl('detail-phone').textContent = applicantPhone;
  getEl('detail-email').textContent = applicantEmail;
  getEl('detail-age').textContent = applicantAge;
  getEl('detail-address').textContent = applicantAddress;
  getEl('detail-start-date').textContent = startDateLabels[startDate] || startDate;

  // 応募情報
  const date = applicant.createdAt?.toDate ? applicant.createdAt.toDate() : new Date(applicant.timestamp || applicant.createdAt);
  getEl('detail-datetime').textContent = formatDate(date, true);
  getEl('detail-type').textContent = typeLabels[applicant.type] || applicant.type || '-';
  getEl('detail-source').textContent = formatSource(applicant.source);

  // ステータスボタンを設定
  const status = applicant.status || 'new';
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });

  // 担当者を設定
  const assigneeSelect = getEl('detail-assignee');
  if (assigneeSelect) {
    assigneeSelect.value = applicant.assignee || '';
  }

  // メモを設定
  const notesTextarea = getEl('detail-notes');
  if (notesTextarea) {
    notesTextarea.value = applicant.notes || '';
  }

  // 対応履歴を設定
  renderHistory(applicant.history || []);

  // メッセージを読み込み
  loadMessages(id);
}

/**
 * 詳細パネルを閉じる
 */
function closeDetailPanel() {
  currentApplicantId = null;

  document.querySelectorAll('.applicant-card').forEach(card => {
    card.classList.remove('selected');
  });

  const emptyState = getEl('detail-empty');
  const detailContent = getEl('detail-content');

  if (emptyState) emptyState.style.display = 'flex';
  if (detailContent) detailContent.style.display = 'none';
}

/**
 * メッセージを読み込んで表示
 */
async function loadMessages(applicationId) {
  const container = getEl('messages-container');
  if (!container) return;

  container.innerHTML = '<p class="no-data">読み込み中...</p>';

  try {
    const db = initFirebase();
    const snapshot = await db.collection('messages')
      .where('applicationId', '==', applicationId)
      .orderBy('createdAt', 'asc')
      .get();

    const messages = [];
    snapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data() });
    });

    renderMessages(messages);
  } catch (error) {
    console.error('Failed to load messages:', error);
    container.innerHTML = '<p class="no-data">メッセージの読み込みに失敗しました</p>';
  }
}

/**
 * メッセージを描画
 */
function renderMessages(messages) {
  const container = getEl('messages-container');
  if (!container) return;

  if (!messages || messages.length === 0) {
    container.innerHTML = '<p class="no-data">メッセージはありません</p>';
    return;
  }

  container.innerHTML = messages.map(msg => {
    const date = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
    const isCompany = msg.from === 'company';
    const senderLabel = isCompany ? '会社' : '応募者';

    return `
      <div class="message-item ${isCompany ? 'message-company' : 'message-applicant'}">
        <div class="message-header">
          <span class="message-sender">${escapeHtml(senderLabel)}</span>
          <span class="message-date">${formatDate(date, true)}</span>
        </div>
        <div class="message-content">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

/**
 * テンプレートを適用
 */
function applyMessageTemplate(templateKey) {
  if (!templateKey) return;

  const template = messageTemplates[templateKey];
  if (!template) return;

  const applicant = applicantsCache.find(a => a.id === currentApplicantId);
  if (!applicant) return;

  const applicantName = applicant.applicantName || applicant.applicant?.name || 'お客様';
  const jobTitle = applicant.jobTitle || '求人';

  let message = template.body
    .replace(/{applicantName}/g, applicantName)
    .replace(/{jobTitle}/g, jobTitle);

  const textarea = getEl('new-message-text');
  if (textarea) {
    textarea.value = message;
    textarea.focus();
  }

  const select = getEl('message-template-select');
  if (select) {
    select.value = '';
  }
}

/**
 * メッセージを送信
 */
async function sendMessage() {
  if (!currentApplicantId) return;

  const input = getEl('new-message-text');
  const content = input?.value?.trim();

  if (!content) {
    alert('メッセージを入力してください');
    return;
  }

  const sendBtn = getEl('btn-send-message');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = '送信中...';
  }

  try {
    const db = initFirebase();
    const applicant = applicantsCache.find(a => a.id === currentApplicantId);

    await db.collection('messages').add({
      applicationId: currentApplicantId,
      companyDomain: applicant?.companyDomain || companyDomain,
      from: 'company',
      content,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    input.value = '';
    await loadMessages(currentApplicantId);

  } catch (error) {
    console.error('Failed to send message:', error);
    alert('メッセージの送信に失敗しました: ' + error.message);
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = '送信';
    }
  }
}

/**
 * 対応履歴を描画
 */
function renderHistory(history) {
  const container = getEl('detail-history');
  if (!container) return;

  if (!history || history.length === 0) {
    container.innerHTML = '<p class="no-data">対応履歴はありません</p>';
    return;
  }

  container.innerHTML = history.map(item => {
    const date = item.date?.toDate ? item.date.toDate() : new Date(item.date);
    return `
      <div class="history-item">
        <div class="history-date">${formatDate(date, true)}</div>
        <div class="history-text">${escapeHtml(item.text)}</div>
      </div>
    `;
  }).join('');
}

/**
 * ステータスを変更
 */
async function changeStatus(newStatus) {
  if (!currentApplicantId) return;

  try {
    const db = initFirebase();

    await db.collection('applications').doc(currentApplicantId).update({
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // キャッシュを更新
    const index = applicantsCache.findIndex(a => a.id === currentApplicantId);
    if (index !== -1) {
      applicantsCache[index].status = newStatus;
    }

    // ボタンの状態を更新
    document.querySelectorAll('.status-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.status === newStatus);
    });

    // リストを更新
    applyFilters();
    updateStats();

  } catch (error) {
    console.error('Failed to update status:', error);
    alert('ステータスの更新に失敗しました');
  }
}

/**
 * メモを保存
 */
async function saveNotes() {
  if (!currentApplicantId) return;

  const notes = getEl('detail-notes')?.value || '';
  const assignee = getEl('detail-assignee')?.value || '';

  const saveBtn = getEl('btn-save-notes');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';
  }

  try {
    const db = initFirebase();

    await db.collection('applications').doc(currentApplicantId).update({
      notes,
      assignee,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // キャッシュを更新
    const index = applicantsCache.findIndex(a => a.id === currentApplicantId);
    if (index !== -1) {
      applicantsCache[index].notes = notes;
      applicantsCache[index].assignee = assignee;
    }

    // リストを更新
    renderApplicantsList();

  } catch (error) {
    console.error('Failed to save notes:', error);
    alert('保存に失敗しました');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '保存';
    }
  }
}

/**
 * 対応履歴を追加
 */
async function addHistory() {
  if (!currentApplicantId) return;

  const input = getEl('new-history-text');
  const text = input?.value?.trim();

  if (!text) {
    alert('対応内容を入力してください');
    return;
  }

  try {
    const db = initFirebase();

    const applicant = applicantsCache.find(a => a.id === currentApplicantId);
    const history = applicant?.history || [];

    history.push({
      date: new Date(),
      text
    });

    await db.collection('applications').doc(currentApplicantId).update({
      history,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // キャッシュを更新
    const index = applicantsCache.findIndex(a => a.id === currentApplicantId);
    if (index !== -1) {
      applicantsCache[index].history = history;
    }

    renderHistory(history);
    input.value = '';

  } catch (error) {
    console.error('Failed to add history:', error);
    alert('履歴の追加に失敗しました: ' + error.message);
  }
}

/**
 * CSVエクスポート
 */
function exportCsv() {
  if (filteredApplicants.length === 0) {
    alert('エクスポートするデータがありません');
    return;
  }

  const headers = ['日時', '種別', '応募者名', '電話番号', 'メール', '年齢', '現住所', '希望勤務開始日', '求人タイトル', '流入元', 'ステータス', '担当者', 'メモ'];

  const rows = filteredApplicants.map(app => {
    const date = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.timestamp || app.createdAt);
    const applicantName = app.applicantName || app.applicant?.name || '';
    const applicantPhone = app.applicantPhone || app.applicant?.phone || '';
    const applicantEmail = app.applicantEmail || app.applicant?.email || '';
    const applicantAge = app.applicant?.age || '';
    const applicantAddress = app.applicant?.address || '';
    const startDate = app.applicant?.startDate || '';

    return [
      formatDate(date, true),
      typeLabels[app.type] || app.type || '',
      applicantName,
      applicantPhone,
      applicantEmail,
      applicantAge,
      applicantAddress,
      startDateLabels[startDate] || startDate,
      app.jobTitle || '',
      formatSource(app.source),
      statusLabels[app.status || 'new'],
      app.assignee || '',
      (app.notes || '').replace(/"/g, '""')
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `applicants-${companyDomain || 'all'}-${formatDateForFilename(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 日付フォーマット
 */
function formatDate(date, withTime = false) {
  if (!date || isNaN(date.getTime())) return '-';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (!withTime) {
    return `${year}/${month}/${day}`;
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

/**
 * ファイル名用日付フォーマット
 */
function formatDateForFilename(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 流入元フォーマット
 */
function formatSource(source) {
  if (!source || source === 'direct') return '直接アクセス';

  try {
    const url = new URL(source);
    const host = url.hostname;

    if (host.includes('google')) return 'Google検索';
    if (host.includes('yahoo')) return 'Yahoo!検索';
    if (host.includes('tiktok')) return 'TikTok広告';
    if (host.includes('instagram') || host.includes('fb') || host.includes('facebook')) return 'Meta広告';
    if (host.includes('twitter') || host.includes('x.com')) return 'X(Twitter)';
    if (host.includes('line')) return 'LINE';

    return host;
  } catch {
    return source || '不明';
  }
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
  // 更新ボタン（job-manage.html内では btn-refresh-applicants）
  getEl('btn-refresh')?.addEventListener('click', loadApplicantsData);
  getEl('btn-refresh-applicants')?.addEventListener('click', loadApplicantsData);

  // CSVエクスポート
  getEl('btn-export-csv')?.addEventListener('click', exportCsv);

  // フィルター
  getEl('filter-status')?.addEventListener('change', applyFilters);
  getEl('filter-type')?.addEventListener('change', applyFilters);

  // 検索（デバウンス付き）
  let searchTimeout;
  getEl('filter-search')?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, 300);
  });

  // 詳細パネルを閉じる
  getEl('btn-close-detail')?.addEventListener('click', closeDetailPanel);

  // ステータスボタン
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.dataset.status;
      if (status) changeStatus(status);
    });
  });

  // メモ保存
  getEl('btn-save-notes')?.addEventListener('click', saveNotes);

  // 履歴追加
  getEl('btn-add-history')?.addEventListener('click', addHistory);
  getEl('new-history-text')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addHistory();
    }
  });

  // メッセージ送信
  getEl('btn-send-message')?.addEventListener('click', sendMessage);
  getEl('new-message-text')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendMessage();
    }
  });

  // テンプレート選択
  getEl('message-template-select')?.addEventListener('change', (e) => {
    applyMessageTemplate(e.target.value);
  });

  // 担当者追加モーダル
  getEl('btn-add-assignee')?.addEventListener('click', showAssigneeModal);
  getEl('assignee-modal-close')?.addEventListener('click', closeAssigneeModal);
  getEl('assignee-modal-cancel')?.addEventListener('click', closeAssigneeModal);
  getEl('assignee-modal-save')?.addEventListener('click', addAssignee);

  getEl('assignee-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeAssigneeModal();
    }
  });

  getEl('new-assignee-name')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAssignee();
    }
  });
}

/**
 * 初期化
 */
export async function initApplicantsManager() {
  const params = new URLSearchParams(window.location.search);
  companyDomain = params.get('domain');
  companyName = params.get('company') ? decodeURIComponent(params.get('company')) : null;

  const companyNameEl = getEl('company-name');
  if (companyNameEl) {
    companyNameEl.textContent = companyName || (companyDomain ? companyDomain : '全会社');
  }

  setupEventListeners();
  await loadAssignees();
  await loadApplicantsData();

  if (typeof window !== 'undefined') {
    window.ApplicantsManager = {
      loadApplicantsData,
      applyFilters,
      exportCsv
    };
  }
}

/**
 * 外部から会社ドメインを設定して初期化
 * @param {string} domain - 会社ドメイン
 * @param {string} name - 会社名
 * @param {string} [prefix=''] - DOM要素IDのプレフィックス（admin.html埋め込み時は 'jm-'）
 */
export async function initApplicantsSection(domain, name, prefix = '') {
  companyDomain = domain;
  companyName = name;
  idPrefix = prefix;

  setupEventListeners();
  await loadAssignees();
  await loadApplicantsData();
}

/**
 * 応募者データを再読み込み
 */
export { loadApplicantsData };

export default {
  initApplicantsManager,
  initApplicantsSection,
  loadApplicantsData
};
