/**
 * 応募者管理機能モジュール（サイドパネル版）
 */
import { escapeHtml } from '@shared/utils.js';
import * as CalendarService from '@features/calendar/calendar-service.js';

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
let duplicateMap = {}; // 重複検出用マップ

// カレンダー連携関連の状態
let companyUsersCache = [];
let calendarIntegrationsCache = {};
let currentWeekStart = null;
let selectedSlot = null;
let currentSection = 'applicants'; // 'applicants' or 'settings'

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
  joined: '入社',
  pending: '保留',
  ng: 'NG',
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

// ========================================
// カレンダー連携機能
// ========================================

/**
 * 会社ユーザー（担当者）一覧を読み込み
 */
async function loadCompanyUsers() {
  try {
    const db = initFirebase();
    const snapshot = await db.collection('company_users')
      .where('companyDomain', '==', companyDomain)
      .where('isActive', '==', true)
      .get();

    companyUsersCache = [];
    snapshot.forEach(doc => {
      companyUsersCache.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // カレンダー連携状態も取得
    await loadCalendarIntegrations();

    return companyUsersCache;
  } catch (error) {
    console.error('Failed to load company users:', error);
    return [];
  }
}

/**
 * カレンダー連携状態を読み込み
 */
async function loadCalendarIntegrations() {
  calendarIntegrationsCache = {};

  for (const user of companyUsersCache) {
    try {
      const result = await CalendarService.getCalendarIntegration(companyDomain, user.id);
      if (result.integration) {
        calendarIntegrationsCache[user.id] = result.integration;
      }
    } catch (error) {
      console.log(`No calendar integration for user ${user.id}`);
    }
  }
}

/**
 * セクションを切り替え
 */
function showSection(section) {
  currentSection = section;

  const applicantsContent = document.querySelector('.applicants-content');
  const settingsSection = getEl('settings-section');
  const pageTitle = getEl('page-title');
  const headerActions = document.querySelector('.header-actions');

  if (section === 'settings') {
    if (applicantsContent) applicantsContent.style.display = 'none';
    if (settingsSection) settingsSection.style.display = 'block';
    if (pageTitle) pageTitle.textContent = '設定';
    if (headerActions) headerActions.style.display = 'none';

    // サイドバーのアクティブ状態を更新
    document.querySelectorAll('.sidebar-nav li').forEach(li => {
      li.classList.remove('active');
    });
    const settingsNav = document.getElementById('nav-settings');
    if (settingsNav) settingsNav.closest('li').classList.add('active');

    renderCalendarIntegrationsList();
  } else {
    if (applicantsContent) applicantsContent.style.display = 'flex';
    if (settingsSection) settingsSection.style.display = 'none';
    if (pageTitle) pageTitle.textContent = '応募者一覧';
    if (headerActions) headerActions.style.display = 'flex';

    // サイドバーのアクティブ状態を更新
    document.querySelectorAll('.sidebar-nav li').forEach(li => {
      li.classList.remove('active');
    });
    const applicantsNav = document.querySelector('[data-section="applicants"]');
    if (applicantsNav) applicantsNav.closest('li').classList.add('active');
  }
}

/**
 * カレンダー連携リストを描画
 */
function renderCalendarIntegrationsList() {
  const container = getEl('calendar-integrations-list');
  if (!container) return;

  if (companyUsersCache.length === 0) {
    container.innerHTML = '<p class="no-data">担当者が登録されていません。<br>管理画面から担当者を追加してください。</p>';
    return;
  }

  container.innerHTML = companyUsersCache.map(user => {
    const integration = calendarIntegrationsCache[user.id];
    const isConnected = integration && integration.isActive;

    return `
      <div class="calendar-integration-item" data-user-id="${escapeHtml(user.id)}">
        <div class="calendar-integration-info">
          <div class="calendar-integration-icon">👤</div>
          <div class="calendar-integration-details">
            <h4>${escapeHtml(user.name || user.username)}</h4>
            <p>${isConnected ? escapeHtml(integration.googleEmail) : '未連携'}</p>
          </div>
        </div>
        <div class="calendar-integration-actions">
          ${isConnected
            ? `<span class="calendar-status connected">連携中</span>
               <button class="btn-disconnect-calendar" data-user-id="${escapeHtml(user.id)}">解除</button>`
            : `<button class="btn-connect-calendar" data-user-id="${escapeHtml(user.id)}" data-user-name="${escapeHtml(user.name || user.username)}">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
                 Googleカレンダーに連携
               </button>`
          }
        </div>
      </div>
    `;
  }).join('');

  // イベントリスナーを設定
  container.querySelectorAll('.btn-connect-calendar').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.userId;
      const userName = btn.dataset.userName;
      connectCalendar(userId, userName);
    });
  });

  container.querySelectorAll('.btn-disconnect-calendar').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.userId;
      disconnectCalendar(userId);
    });
  });
}

/**
 * カレンダー連携を開始
 */
async function connectCalendar(userId, userName) {
  try {
    const result = await CalendarService.initiateCalendarAuth(companyDomain, userId, userName);
    // 新しいウィンドウでOAuth認証を開く
    window.open(result.authUrl, 'calendar-auth', 'width=600,height=700');

    // ポーリングで連携状態を確認（30秒間、3秒ごと）
    let attempts = 0;
    const maxAttempts = 10;
    const checkInterval = setInterval(async () => {
      attempts++;
      try {
        const checkResult = await CalendarService.getCalendarIntegration(companyDomain, userId);
        if (checkResult.integration && checkResult.integration.isActive) {
          clearInterval(checkInterval);
          calendarIntegrationsCache[userId] = checkResult.integration;
          renderCalendarIntegrationsList();
          alert('カレンダー連携が完了しました');
        }
      } catch (e) {
        // 連携未完了、続行
      }

      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
      }
    }, 3000);

  } catch (error) {
    console.error('Failed to initiate calendar auth:', error);
    alert('カレンダー連携の開始に失敗しました: ' + error.message);
  }
}

/**
 * カレンダー連携を解除
 */
async function disconnectCalendar(userId) {
  if (!confirm('カレンダー連携を解除しますか？')) return;

  try {
    await CalendarService.revokeCalendarAuth(companyDomain, userId);
    delete calendarIntegrationsCache[userId];
    renderCalendarIntegrationsList();
    alert('カレンダー連携を解除しました');
  } catch (error) {
    console.error('Failed to revoke calendar auth:', error);
    alert('連携解除に失敗しました: ' + error.message);
  }
}

// ========================================
// 面談設定機能
// ========================================

/**
 * 面談設定モーダルを表示
 */
async function showInterviewModal() {
  if (!currentApplicantId) return;

  const modal = getEl('interview-modal');
  if (!modal) return;

  // 担当者リストを更新
  const staffSelect = getEl('interview-staff');
  if (staffSelect) {
    staffSelect.innerHTML = '<option value="">担当者を選択...</option>' +
      companyUsersCache.map(user => {
        const integration = calendarIntegrationsCache[user.id];
        const suffix = integration?.isActive ? ' (カレンダー連携済)' : '';
        return `<option value="${escapeHtml(user.id)}" data-has-calendar="${integration?.isActive ? 'true' : 'false'}">${escapeHtml(user.name || user.username)}${suffix}</option>`;
      }).join('');
  }

  // リセット
  selectedSlot = null;
  currentWeekStart = CalendarService.getWeekStart(new Date());

  getEl('availability-section').style.display = 'none';
  getEl('selected-slot-section').style.display = 'none';
  getEl('manual-datetime-section').style.display = 'block';
  getEl('calendar-status-hint').textContent = '';

  modal.style.display = 'flex';
}

/**
 * 面談設定モーダルを閉じる
 */
function closeInterviewModal() {
  const modal = getEl('interview-modal');
  if (modal) modal.style.display = 'none';
}

/**
 * 担当者変更時の処理
 */
async function onStaffChange() {
  const staffSelect = getEl('interview-staff');
  const selectedOption = staffSelect.options[staffSelect.selectedIndex];
  const hasCalendar = selectedOption?.dataset?.hasCalendar === 'true';
  const userId = staffSelect.value;

  const availabilitySection = getEl('availability-section');
  const manualSection = getEl('manual-datetime-section');
  const hint = getEl('calendar-status-hint');

  if (!userId) {
    availabilitySection.style.display = 'none';
    manualSection.style.display = 'block';
    hint.textContent = '';
    return;
  }

  if (hasCalendar) {
    availabilitySection.style.display = 'block';
    manualSection.style.display = 'none';
    hint.textContent = '担当者のカレンダーから空き時間を取得します';
    hint.style.color = '#10b981';
    await loadAvailability(userId);
  } else {
    availabilitySection.style.display = 'none';
    manualSection.style.display = 'block';
    hint.textContent = 'この担当者はカレンダー未連携です。手動で日時を入力してください。';
    hint.style.color = '#f59e0b';
  }
}

/**
 * 空き時間を読み込み
 */
async function loadAvailability(userId) {
  const grid = getEl('availability-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading-message">空き時間を取得中...</div>';

  try {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const startDate = CalendarService.formatDateISO(currentWeekStart);
    const endDate = CalendarService.formatDateISO(weekEnd);

    const result = await CalendarService.getCalendarAvailability(companyDomain, userId, startDate, endDate);

    renderAvailabilityGrid(result.availableSlots || []);
    updateWeekLabel();

  } catch (error) {
    console.error('Failed to load availability:', error);
    grid.innerHTML = '<div class="empty-message">空き時間の取得に失敗しました</div>';
  }
}

/**
 * 週ラベルを更新
 */
function updateWeekLabel() {
  const label = getEl('week-label');
  if (!label || !currentWeekStart) return;

  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const startStr = `${currentWeekStart.getMonth() + 1}/${currentWeekStart.getDate()}`;
  const endStr = `${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;

  label.textContent = `${currentWeekStart.getFullYear()}年 ${startStr} - ${endStr}`;
}

/**
 * 空き時間グリッドを描画
 */
function renderAvailabilityGrid(slots) {
  const grid = getEl('availability-grid');
  if (!grid) return;

  // 日付ごとにグループ化
  const slotsByDate = {};
  const days = [];

  for (let i = 0; i < 5; i++) { // 月〜金
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + i);
    const dateStr = CalendarService.formatDateISO(date);
    days.push({ date, dateStr });
    slotsByDate[dateStr] = [];
  }

  slots.forEach(slot => {
    const dateStr = slot.start.split('T')[0];
    if (slotsByDate[dateStr]) {
      slotsByDate[dateStr].push(slot);
    }
  });

  grid.innerHTML = days.map(({ date, dateStr }) => {
    const daySlots = slotsByDate[dateStr] || [];
    const dayName = CalendarService.getDayOfWeek(date);
    const dayDate = `${date.getMonth() + 1}/${date.getDate()}`;

    return `
      <div class="availability-day">
        <div class="availability-day-header">
          <span class="day-name">${dayName}</span>
          <span class="day-date">${dayDate}</span>
        </div>
        <div class="availability-slots">
          ${daySlots.length > 0
            ? daySlots.map(slot => {
                const startTime = new Date(slot.start);
                const timeStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
                const slotId = slot.start;
                const isSelected = selectedSlot === slotId;
                return `<button class="slot-btn ${isSelected ? 'selected' : ''}" data-slot="${escapeHtml(slotId)}">${timeStr}</button>`;
              }).join('')
            : '<p class="no-slots">空きなし</p>'
          }
        </div>
      </div>
    `;
  }).join('');

  // スロットボタンのイベントリスナー
  grid.querySelectorAll('.slot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectSlot(btn.dataset.slot);
    });
  });
}

/**
 * スロットを選択
 */
function selectSlot(slotId) {
  selectedSlot = slotId;

  // ボタンの選択状態を更新
  document.querySelectorAll('.slot-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.slot === slotId);
  });

  // 選択された日時を表示
  const slotSection = getEl('selected-slot-section');
  const slotDisplay = getEl('selected-slot');

  if (slotSection && slotDisplay) {
    const slotDate = new Date(slotId);
    const dayName = CalendarService.getDayOfWeek(slotDate);
    const dateStr = `${slotDate.getFullYear()}年${slotDate.getMonth() + 1}月${slotDate.getDate()}日(${dayName})`;
    const timeStr = `${String(slotDate.getHours()).padStart(2, '0')}:${String(slotDate.getMinutes()).padStart(2, '0')}`;

    slotDisplay.textContent = `${dateStr} ${timeStr}`;
    slotSection.style.display = 'block';
  }
}

/**
 * 前の週へ
 */
function prevWeek() {
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  const staffSelect = getEl('interview-staff');
  if (staffSelect?.value) {
    loadAvailability(staffSelect.value);
  }
}

/**
 * 次の週へ
 */
function nextWeek() {
  currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  const staffSelect = getEl('interview-staff');
  if (staffSelect?.value) {
    loadAvailability(staffSelect.value);
  }
}

/**
 * 面談を登録
 */
async function saveInterview() {
  const staffSelect = getEl('interview-staff');
  const staffId = staffSelect?.value;

  if (!staffId) {
    alert('担当者を選択してください');
    return;
  }

  const selectedOption = staffSelect.options[staffSelect.selectedIndex];
  const hasCalendar = selectedOption?.dataset?.hasCalendar === 'true';

  let scheduledAt;

  if (hasCalendar && selectedSlot) {
    scheduledAt = new Date(selectedSlot);
  } else {
    const datetimeInput = getEl('interview-datetime');
    if (!datetimeInput?.value) {
      alert('面談日時を選択してください');
      return;
    }
    scheduledAt = new Date(datetimeInput.value);
  }

  const duration = parseInt(getEl('interview-duration')?.value || '60');
  const meetingType = document.querySelector('input[name="meeting-type"]:checked')?.value || 'in_person';
  const location = getEl('interview-location')?.value || '';

  const reminders = [];
  if (getEl('send-reminder-1day')?.checked) {
    reminders.push({ offsetMinutes: 24 * 60, sendTime: '10:00' });
  }
  if (getEl('send-reminder-1hour')?.checked) {
    reminders.push({ offsetMinutes: 60 });
  }

  const applicant = applicantsCache.find(a => a.id === currentApplicantId);
  if (!applicant) return;

  const staff = companyUsersCache.find(u => u.id === staffId);

  const saveBtn = getEl('interview-modal-save');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '登録中...';
  }

  try {
    // カレンダーイベントを作成
    const result = await CalendarService.createCalendarEvent({
      companyDomain,
      companyUserId: staffId,
      applicationId: currentApplicantId,
      applicantName: applicant.applicantName || applicant.applicant?.name || '応募者',
      applicantEmail: applicant.applicantEmail || applicant.applicant?.email || '',
      staffName: staff?.name || staff?.username || '担当者',
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: duration,
      meetingType,
      location,
      reminders
    });

    // 応募者のステータスを「面接調整中」に更新
    const db = initFirebase();
    await db.collection('applications').doc(currentApplicantId).update({
      status: 'interviewing',
      interviewId: result.interviewId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // キャッシュを更新
    const index = applicantsCache.findIndex(a => a.id === currentApplicantId);
    if (index !== -1) {
      applicantsCache[index].status = 'interviewing';
      applicantsCache[index].interviewId = result.interviewId;
    }

    closeInterviewModal();
    showApplicantDetail(currentApplicantId);
    applyFilters();
    updateStats();

    alert('面談を登録しました。担当者のGoogleカレンダーに予定が追加されました。');

  } catch (error) {
    console.error('Failed to save interview:', error);
    alert('面談の登録に失敗しました: ' + error.message);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '面談を登録';
    }
  }
}

/**
 * 面談情報を表示
 */
async function loadInterviewInfo(applicationId) {
  const container = getEl('interview-info');
  if (!container) return;

  const applicant = applicantsCache.find(a => a.id === applicationId);
  if (!applicant?.interviewId) {
    container.innerHTML = '<p class="no-data">面談は設定されていません</p>';
    return;
  }

  try {
    const db = initFirebase();
    const doc = await db.collection('interviews').doc(applicant.interviewId).get();

    if (!doc.exists) {
      container.innerHTML = '<p class="no-data">面談は設定されていません</p>';
      return;
    }

    const interview = doc.data();
    const scheduledAt = interview.scheduledAt?.toDate ? interview.scheduledAt.toDate() : new Date(interview.scheduledAt);
    const dayName = CalendarService.getDayOfWeek(scheduledAt);

    const meetingTypeLabels = {
      in_person: '対面',
      online: 'オンライン',
      phone: '電話'
    };

    container.innerHTML = `
      <div class="interview-scheduled">
        <h4>面談予定</h4>
        <p><strong>日時:</strong> ${scheduledAt.getFullYear()}年${scheduledAt.getMonth() + 1}月${scheduledAt.getDate()}日(${dayName}) ${String(scheduledAt.getHours()).padStart(2, '0')}:${String(scheduledAt.getMinutes()).padStart(2, '0')}</p>
        <p><strong>担当者:</strong> ${escapeHtml(interview.staffName || '-')}</p>
        <p><strong>形式:</strong> ${meetingTypeLabels[interview.meetingType] || interview.meetingType}</p>
        ${interview.location ? `<p><strong>場所:</strong> ${escapeHtml(interview.location)}</p>` : ''}
      </div>
    `;

  } catch (error) {
    console.error('Failed to load interview info:', error);
    container.innerHTML = '<p class="no-data">面談情報の取得に失敗しました</p>';
  }
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
 * 重複検出用マップを構築
 * 電話番号・メールアドレスをキーに、応募履歴をグループ化
 */
function buildDuplicateMap() {
  duplicateMap = {};

  applicantsCache.forEach(app => {
    const phone = app.applicantPhone || app.applicant?.phone;
    const email = app.applicantEmail || app.applicant?.email;

    // 電話番号でグループ化
    if (phone) {
      const normalizedPhone = phone.replace(/[-\s]/g, ''); // ハイフン・スペースを除去
      if (!duplicateMap[normalizedPhone]) {
        duplicateMap[normalizedPhone] = [];
      }
      duplicateMap[normalizedPhone].push(app);
    }

    // メールアドレスでグループ化
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      if (!duplicateMap[normalizedEmail]) {
        duplicateMap[normalizedEmail] = [];
      }
      duplicateMap[normalizedEmail].push(app);
    }
  });
}

/**
 * 応募者の重複情報を取得
 * @param {Object} app - 応募者データ
 * @returns {Object} { isReapply: boolean, hasNgHistory: boolean, previousApps: Array }
 */
function getDuplicateInfo(app) {
  const phone = app.applicantPhone || app.applicant?.phone;
  const email = app.applicantEmail || app.applicant?.email;

  let relatedApps = [];

  // 電話番号で関連応募を検索
  if (phone) {
    const normalizedPhone = phone.replace(/[-\s]/g, '');
    const phoneMatches = duplicateMap[normalizedPhone] || [];
    relatedApps = relatedApps.concat(phoneMatches);
  }

  // メールアドレスで関連応募を検索
  if (email) {
    const normalizedEmail = email.toLowerCase().trim();
    const emailMatches = duplicateMap[normalizedEmail] || [];
    relatedApps = relatedApps.concat(emailMatches);
  }

  // 重複を除去し、自分自身を除外
  const uniqueApps = [...new Map(relatedApps.map(a => [a.id, a])).values()]
    .filter(a => a.id !== app.id);

  // 過去の応募（自分より前の日付）のみを対象
  const appDate = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.timestamp || app.createdAt);
  const previousApps = uniqueApps.filter(a => {
    const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.timestamp || a.createdAt);
    return aDate < appDate;
  });

  const isReapply = previousApps.length > 0;
  const hasNgHistory = previousApps.some(a => a.status === 'ng' || a.status === 'rejected');

  return { isReapply, hasNgHistory, previousApps };
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

    buildDuplicateMap();
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
    ['contacted', 'interviewing', 'interviewed', 'pending'].includes(a.status)
  ).length;
  const completeCount = applicantsCache.filter(a =>
    ['hired', 'joined', 'ng', 'rejected', 'withdrawn'].includes(a.status)
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

    // 重複情報を取得
    const duplicateInfo = getDuplicateInfo(app);
    let duplicateBadges = '';
    if (duplicateInfo.hasNgHistory) {
      duplicateBadges += '<span class="duplicate-badge badge-ng-history">NG履歴</span>';
    } else if (duplicateInfo.isReapply) {
      duplicateBadges += '<span class="duplicate-badge badge-reapply">再応募</span>';
    }

    return `
      <div class="applicant-card ${isSelected ? 'selected' : ''}" data-id="${escapeHtml(app.id)}">
        <div class="applicant-card-main">
          <div class="applicant-card-header">
            <span class="applicant-card-name">${escapeHtml(applicantName)}</span>
            <span class="applicant-card-type ${typeClass}">${escapeHtml(typeLabel)}</span>
            ${duplicateBadges}
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

  // 面談情報を読み込み
  loadInterviewInfo(id);
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

  // ========================================
  // カレンダー連携・面談設定イベント
  // ========================================

  // 設定ナビゲーション
  document.getElementById('nav-settings')?.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('settings');
  });

  // 応募者一覧に戻る
  getEl('btn-back-to-applicants')?.addEventListener('click', () => {
    showSection('applicants');
  });

  // 面談設定モーダル
  getEl('btn-schedule-interview')?.addEventListener('click', showInterviewModal);
  getEl('interview-modal-close')?.addEventListener('click', closeInterviewModal);
  getEl('interview-modal-cancel')?.addEventListener('click', closeInterviewModal);
  getEl('interview-modal-save')?.addEventListener('click', saveInterview);

  getEl('interview-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeInterviewModal();
    }
  });

  // 担当者選択時
  getEl('interview-staff')?.addEventListener('change', onStaffChange);

  // 週ナビゲーション
  getEl('btn-prev-week')?.addEventListener('click', prevWeek);
  getEl('btn-next-week')?.addEventListener('click', nextWeek);

  // リマインダー設定保存
  getEl('btn-save-reminder-settings')?.addEventListener('click', saveReminderSettings);
}

/**
 * リマインダー設定を保存
 */
async function saveReminderSettings() {
  try {
    const db = initFirebase();
    const settings = {
      reminder1Day: getEl('reminder-1day')?.checked || false,
      reminder1DayTime: getEl('reminder-1day-time')?.value || '10:00',
      reminder1Hour: getEl('reminder-1hour')?.checked || false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('settings').doc(companyDomain || 'global').set({
      reminderSettings: settings
    }, { merge: true });

    alert('リマインダー設定を保存しました');
  } catch (error) {
    console.error('Failed to save reminder settings:', error);
    alert('設定の保存に失敗しました: ' + error.message);
  }
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
  await loadCompanyUsers(); // 会社ユーザー（担当者）を読み込み
  await loadApplicantsData();

  if (typeof window !== 'undefined') {
    window.ApplicantsManager = {
      loadApplicantsData,
      applyFilters,
      exportCsv,
      showSection
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
  await loadCompanyUsers(); // 会社ユーザー（担当者）を読み込み
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
