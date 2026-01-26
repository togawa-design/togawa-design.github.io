/**
 * 応募者管理機能モジュール
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
  // 詳細モーダルの担当者セレクト
  const detailSelect = document.getElementById('detail-assignee');
  if (detailSelect) {
    const currentValue = detailSelect.value;
    detailSelect.innerHTML = '<option value="">未割当</option>' +
      assigneesCache.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
    detailSelect.value = currentValue;
  }

  // フィルターの担当者セレクト
  const filterSelect = document.getElementById('filter-assignee');
  if (filterSelect) {
    const currentValue = filterSelect.value;
    filterSelect.innerHTML = '<option value="">すべて</option><option value="unassigned">未割当</option>' +
      assigneesCache.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
    filterSelect.value = currentValue;
  }
}

/**
 * 担当者を追加
 */
async function addAssignee() {
  const input = document.getElementById('new-assignee-name');
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

    // モーダルを閉じる
    closeAssigneeModal();

    // 追加した担当者を選択状態にする
    const detailSelect = document.getElementById('detail-assignee');
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
  const modal = document.getElementById('assignee-modal');
  const input = document.getElementById('new-assignee-name');
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
  const modal = document.getElementById('assignee-modal');
  if (modal) modal.style.display = 'none';
}

/**
 * 応募者データを読み込み
 */
async function loadApplicantsData() {
  const tbody = document.getElementById('applicants-tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">データを読み込み中...</td></tr>';
  }

  try {
    const db = initFirebase();

    // Firestoreから応募データを取得
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

    // フィルタリングと表示
    applyFilters();
    updateStats();

  } catch (error) {
    console.error('Failed to load applicants:', error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="error-cell">データの読み込みに失敗しました: ${escapeHtml(error.message)}</td></tr>`;
    }
  }
}

/**
 * フィルターを適用
 */
function applyFilters() {
  const statusFilter = document.getElementById('filter-status')?.value || '';
  const typeFilter = document.getElementById('filter-type')?.value || '';
  const assigneeFilter = document.getElementById('filter-assignee')?.value || '';
  const dateFrom = document.getElementById('filter-date-from')?.value || '';
  const dateTo = document.getElementById('filter-date-to')?.value || '';
  const searchText = document.getElementById('filter-search')?.value?.toLowerCase() || '';

  filteredApplicants = applicantsCache.filter(app => {
    // ステータスフィルター
    if (statusFilter && (app.status || 'new') !== statusFilter) {
      return false;
    }

    // 種別フィルター
    if (typeFilter && app.type !== typeFilter) {
      return false;
    }

    // 担当者フィルター
    if (assigneeFilter) {
      if (assigneeFilter === 'unassigned') {
        if (app.assignee) return false;
      } else {
        if (app.assignee !== assigneeFilter) return false;
      }
    }

    // 日付フィルター
    const appDate = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.timestamp || app.createdAt);
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (appDate < fromDate) return false;
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (appDate > toDate) return false;
    }

    // テキスト検索（求人タイトルまたは応募者名）
    if (searchText) {
      const jobTitle = (app.jobTitle || '').toLowerCase();
      const applicantName = (app.applicant?.name || '').toLowerCase();
      if (!jobTitle.includes(searchText) && !applicantName.includes(searchText)) {
        return false;
      }
    }

    return true;
  });

  currentPage = 1;
  renderApplicantsTable();
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

  const statTotal = document.getElementById('stat-total');
  const statNew = document.getElementById('stat-new');
  const statProgress = document.getElementById('stat-progress');
  const statComplete = document.getElementById('stat-complete');

  if (statTotal) statTotal.textContent = total;
  if (statNew) statNew.textContent = newCount;
  if (statProgress) statProgress.textContent = progressCount;
  if (statComplete) statComplete.textContent = completeCount;
}

/**
 * 応募者テーブルを描画
 */
function renderApplicantsTable() {
  const tbody = document.getElementById('applicants-tbody');
  if (!tbody) return;

  if (filteredApplicants.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">応募データがありません</td></tr>';
    return;
  }

  // ページネーション
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageApplicants = filteredApplicants.slice(startIndex, endIndex);

  tbody.innerHTML = pageApplicants.map(app => {
    const date = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.timestamp || app.createdAt);
    const dateStr = formatDate(date);
    const status = app.status || 'new';
    const typeLabel = typeLabels[app.type] || app.type || '-';
    const statusLabel = statusLabels[status] || status;
    const applicantName = app.applicant?.name || '-';
    const assignee = app.assignee || '-';

    return `
      <tr data-id="${escapeHtml(app.id)}">
        <td>${escapeHtml(dateStr)}</td>
        <td><span class="type-badge type-${escapeHtml(app.type || 'apply')}">${escapeHtml(typeLabel)}</span></td>
        <td class="applicant-name-cell">${escapeHtml(applicantName)}</td>
        <td>${escapeHtml(app.jobTitle || '-')}</td>
        <td><span class="status-badge status-${escapeHtml(status)}">${escapeHtml(statusLabel)}</span></td>
        <td class="assignee-cell">${escapeHtml(assignee)}</td>
        <td>
          <button class="btn-small btn-view" data-id="${escapeHtml(app.id)}">詳細</button>
        </td>
      </tr>
    `;
  }).join('');

  // 詳細ボタンのイベント
  tbody.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      showApplicantDetail(id);
    });
  });
}

/**
 * ページネーションを描画
 */
function renderPagination() {
  const pagination = document.getElementById('pagination');
  if (!pagination) return;

  const totalPages = Math.ceil(filteredApplicants.length / itemsPerPage);

  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';

  // 前へボタン
  html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">前へ</button>`;

  // ページ番号
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += '<span class="page-ellipsis">...</span>';
    }
  }

  // 次へボタン
  html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">次へ</button>`;

  pagination.innerHTML = html;

  // イベント
  pagination.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      currentPage = parseInt(btn.dataset.page);
      renderApplicantsTable();
      renderPagination();
    });
  });
}

/**
 * 応募者詳細を表示
 */
function showApplicantDetail(id) {
  const applicant = applicantsCache.find(a => a.id === id);
  if (!applicant) return;

  currentApplicantId = id;

  const modal = document.getElementById('applicant-modal');
  if (!modal) return;

  // 応募者情報を設定
  const applicantInfo = applicant.applicant || {};
  document.getElementById('detail-name').textContent = applicantInfo.name || '-';
  document.getElementById('detail-phone').textContent = applicantInfo.phone || '-';
  document.getElementById('detail-email').textContent = applicantInfo.email || '-';
  document.getElementById('detail-age').textContent = applicantInfo.age || '-';
  document.getElementById('detail-address').textContent = applicantInfo.address || '-';
  document.getElementById('detail-start-date').textContent = startDateLabels[applicantInfo.startDate] || applicantInfo.startDate || '-';

  // 応募情報を設定
  const date = applicant.createdAt?.toDate ? applicant.createdAt.toDate() : new Date(applicant.timestamp || applicant.createdAt);

  document.getElementById('detail-datetime').textContent = formatDate(date, true);
  document.getElementById('detail-type').textContent = typeLabels[applicant.type] || applicant.type || '-';
  document.getElementById('detail-job-title').textContent = applicant.jobTitle || '-';
  document.getElementById('detail-source').textContent = formatSource(applicant.source);

  // ステータスを設定
  const status = applicant.status || 'new';
  document.querySelectorAll('input[name="status"]').forEach(radio => {
    radio.checked = radio.value === status;
  });

  // 担当者を設定
  const assigneeSelect = document.getElementById('detail-assignee');
  if (assigneeSelect) {
    assigneeSelect.value = applicant.assignee || '';
  }

  // メモを設定
  document.getElementById('detail-notes').value = applicant.notes || '';

  // 対応履歴を設定
  renderHistory(applicant.history || []);

  // メッセージを読み込み
  loadMessages(id);

  modal.style.display = 'flex';
}

/**
 * メッセージを読み込んで表示
 */
async function loadMessages(applicationId) {
  const container = document.getElementById('messages-container');
  if (!container) return;

  container.innerHTML = '<p class="loading-messages">メッセージを読み込み中...</p>';

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
    container.innerHTML = '<p class="error-messages">メッセージの読み込みに失敗しました</p>';
  }
}

/**
 * メッセージを描画
 */
function renderMessages(messages) {
  const container = document.getElementById('messages-container');
  if (!container) return;

  if (!messages || messages.length === 0) {
    container.innerHTML = '<p class="no-messages">メッセージはありません</p>';
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

  // スクロールを最下部へ
  container.scrollTop = container.scrollHeight;
}

/**
 * テンプレートを適用
 */
function applyMessageTemplate(templateKey) {
  if (!templateKey) return;

  const template = messageTemplates[templateKey];
  if (!template) return;

  // 現在の応募者情報を取得
  const applicant = applicantsCache.find(a => a.id === currentApplicantId);
  if (!applicant) return;

  const applicantName = applicant.applicant?.name || 'お客様';
  const jobTitle = applicant.jobTitle || '求人';

  // プレースホルダーを置換
  let message = template.body
    .replace(/{applicantName}/g, applicantName)
    .replace(/{jobTitle}/g, jobTitle);

  // テキストエリアに設定
  const textarea = document.getElementById('new-message-text');
  if (textarea) {
    textarea.value = message;
    textarea.focus();
  }

  // セレクトボックスをリセット
  const select = document.getElementById('message-template-select');
  if (select) {
    select.value = '';
  }
}

/**
 * メッセージを送信
 */
async function sendMessage() {
  if (!currentApplicantId) return;

  const input = document.getElementById('new-message-text');
  const content = input?.value?.trim();

  if (!content) {
    alert('メッセージを入力してください');
    return;
  }

  const sendBtn = document.getElementById('btn-send-message');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = '送信中...';
  }

  try {
    const db = initFirebase();

    // 応募者情報を取得
    const applicant = applicantsCache.find(a => a.id === currentApplicantId);

    // メッセージを保存
    await db.collection('messages').add({
      applicationId: currentApplicantId,
      companyDomain: applicant?.companyDomain || companyDomain,
      from: 'company',
      content,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 入力をクリア
    input.value = '';

    // メッセージを再読み込み
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
  const container = document.getElementById('detail-history');
  if (!container) return;

  if (!history || history.length === 0) {
    container.innerHTML = '<p class="no-history">対応履歴はありません</p>';
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
 * 応募者詳細モーダルを閉じる
 */
function closeApplicantModal() {
  const modal = document.getElementById('applicant-modal');
  if (modal) modal.style.display = 'none';
  currentApplicantId = null;
}

/**
 * 応募者データを保存
 */
async function saveApplicantData() {
  if (!currentApplicantId) return;

  const saveBtn = document.getElementById('applicant-modal-save');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';
  }

  try {
    const db = initFirebase();

    // ステータスを取得
    const statusRadio = document.querySelector('input[name="status"]:checked');
    const status = statusRadio ? statusRadio.value : 'new';

    // 担当者を取得
    const assignee = document.getElementById('detail-assignee')?.value || '';

    // メモを取得
    const notes = document.getElementById('detail-notes')?.value || '';

    // 更新データ
    const updateData = {
      status,
      assignee,
      notes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Firestoreを更新
    await db.collection('applications').doc(currentApplicantId).update(updateData);

    // キャッシュを更新
    const index = applicantsCache.findIndex(a => a.id === currentApplicantId);
    if (index !== -1) {
      applicantsCache[index] = { ...applicantsCache[index], ...updateData };
    }

    // 表示を更新
    applyFilters();
    updateStats();

    alert('保存しました');
    closeApplicantModal();

  } catch (error) {
    console.error('Failed to save applicant:', error);
    alert('保存に失敗しました: ' + error.message);
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

  const input = document.getElementById('new-history-text');
  const text = input?.value?.trim();

  if (!text) {
    alert('対応内容を入力してください');
    return;
  }

  try {
    const db = initFirebase();

    // 現在の履歴を取得
    const applicant = applicantsCache.find(a => a.id === currentApplicantId);
    const history = applicant?.history || [];

    // 新しい履歴を追加
    history.push({
      date: new Date(),
      text
    });

    // Firestoreを更新
    await db.collection('applications').doc(currentApplicantId).update({
      history,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // キャッシュを更新
    const index = applicantsCache.findIndex(a => a.id === currentApplicantId);
    if (index !== -1) {
      applicantsCache[index].history = history;
    }

    // 表示を更新
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
    const applicant = app.applicant || {};
    return [
      formatDate(date, true),
      typeLabels[app.type] || app.type || '',
      applicant.name || '',
      applicant.phone || '',
      applicant.email || '',
      applicant.age || '',
      applicant.address || '',
      startDateLabels[applicant.startDate] || applicant.startDate || '',
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

  // BOMを追加してExcelで文字化けしないようにする
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
  // 更新ボタン
  document.getElementById('btn-refresh')?.addEventListener('click', loadApplicantsData);

  // CSVエクスポート
  document.getElementById('btn-export-csv')?.addEventListener('click', exportCsv);

  // 求人一覧へのナビゲーション
  document.getElementById('nav-jobs')?.addEventListener('click', (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (companyDomain) params.set('domain', companyDomain);
    if (companyName) params.set('company', companyName);
    window.location.href = `job-manage.html?${params.toString()}`;
  });

  // フィルター
  document.getElementById('filter-status')?.addEventListener('change', applyFilters);
  document.getElementById('filter-type')?.addEventListener('change', applyFilters);
  document.getElementById('filter-assignee')?.addEventListener('change', applyFilters);
  document.getElementById('filter-date-from')?.addEventListener('change', applyFilters);
  document.getElementById('filter-date-to')?.addEventListener('change', applyFilters);

  // 検索（デバウンス付き）
  let searchTimeout;
  document.getElementById('filter-search')?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, 300);
  });

  // モーダル
  document.getElementById('applicant-modal-close')?.addEventListener('click', closeApplicantModal);
  document.getElementById('applicant-modal-cancel')?.addEventListener('click', closeApplicantModal);
  document.getElementById('applicant-modal-save')?.addEventListener('click', saveApplicantData);
  document.getElementById('btn-add-history')?.addEventListener('click', addHistory);

  // モーダル外クリックで閉じる
  document.getElementById('applicant-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeApplicantModal();
    }
  });

  // Enterキーで履歴追加
  document.getElementById('new-history-text')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addHistory();
    }
  });

  // メッセージ送信
  document.getElementById('btn-send-message')?.addEventListener('click', sendMessage);

  // Ctrl+Enterでメッセージ送信
  document.getElementById('new-message-text')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendMessage();
    }
  });

  // テンプレート選択
  document.getElementById('message-template-select')?.addEventListener('change', (e) => {
    applyMessageTemplate(e.target.value);
  });

  // 担当者追加モーダル
  document.getElementById('btn-add-assignee')?.addEventListener('click', showAssigneeModal);
  document.getElementById('assignee-modal-close')?.addEventListener('click', closeAssigneeModal);
  document.getElementById('assignee-modal-cancel')?.addEventListener('click', closeAssigneeModal);
  document.getElementById('assignee-modal-save')?.addEventListener('click', addAssignee);

  // モーダル外クリックで閉じる
  document.getElementById('assignee-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeAssigneeModal();
    }
  });

  // Enterキーで担当者追加
  document.getElementById('new-assignee-name')?.addEventListener('keypress', (e) => {
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
  // URLパラメータから会社情報を取得
  const params = new URLSearchParams(window.location.search);
  companyDomain = params.get('domain');
  companyName = params.get('company') ? decodeURIComponent(params.get('company')) : null;

  // 会社名を表示
  const companyNameEl = document.getElementById('company-name');
  if (companyNameEl) {
    companyNameEl.textContent = companyName || (companyDomain ? companyDomain : '全会社');
  }

  // イベントリスナー設定
  setupEventListeners();

  // 担当者リストを読み込み
  await loadAssignees();

  // データ読み込み
  await loadApplicantsData();

  // グローバルにエクスポート（デバッグ用）
  if (typeof window !== 'undefined') {
    window.ApplicantsManager = {
      loadApplicantsData,
      applyFilters,
      exportCsv
    };
  }
}

export default {
  initApplicantsManager
};
