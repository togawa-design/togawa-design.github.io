/**
 * カレンダー連携サービス
 * Google Calendar APIとの連携を行う
 */

// Cloud Functions のベースURL
const FUNCTIONS_BASE_URL = 'https://asia-northeast1-generated-area-484613-e3-90bd4.cloudfunctions.net';

/**
 * Firebase IDトークンを取得
 * @returns {Promise<string|null>}
 */
async function getIdToken() {
  try {
    const user = firebase.auth().currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch (error) {
    console.warn('Failed to get ID token:', error);
  }
  return null;
}

/**
 * 認証ヘッダーを取得
 * @returns {Promise<Object>}
 */
async function getAuthHeaders() {
  const token = await getIdToken();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * カレンダー認証を開始（OAuth URLを取得）
 * @param {string} companyDomain - 会社ドメイン
 * @param {string} companyUserId - 会社ユーザーID
 * @param {string} staffName - 担当者名
 * @returns {Promise<{authUrl: string}>}
 */
export async function initiateCalendarAuth(companyDomain, companyUserId, staffName) {
  // ローカル開発時はスキップ
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    throw new Error('ローカル開発環境ではカレンダー連携は利用できません。本番環境でお試しください。');
  }

  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/initiateCalendarAuth`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      companyDomain,
      companyUserId,
      staffName
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '認証URLの取得に失敗しました');
  }

  return response.json();
}

/**
 * カレンダー連携情報を取得
 * @param {string} companyDomain - 会社ドメイン
 * @param {string} companyUserId - 会社ユーザーID
 * @returns {Promise<{integration: Object|null}>}
 */
export async function getCalendarIntegration(companyDomain, companyUserId) {
  // ローカル開発時はスキップ（組織ポリシーでallUsersが禁止されているため）
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('[Calendar] ローカル開発環境ではカレンダー連携は利用できません');
    return { success: true, integration: null };
  }

  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ companyDomain, companyUserId });
  const response = await fetch(`${FUNCTIONS_BASE_URL}/getCalendarIntegration?${params}`, { headers });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '連携情報の取得に失敗しました');
  }

  return response.json();
}

/**
 * カレンダー連携を解除
 * @param {string} companyDomain - 会社ドメイン
 * @param {string} companyUserId - 会社ユーザーID
 * @returns {Promise<{success: boolean}>}
 */
export async function revokeCalendarAuth(companyDomain, companyUserId) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/revokeCalendarAuth`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      companyDomain,
      companyUserId
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '連携解除に失敗しました');
  }

  return response.json();
}

/**
 * 空き時間を取得
 * @param {string} companyDomain - 会社ドメイン
 * @param {string} companyUserId - 会社ユーザーID
 * @param {string} startDate - 開始日 (YYYY-MM-DD)
 * @param {string} endDate - 終了日 (YYYY-MM-DD)
 * @returns {Promise<{availableSlots: Array}>}
 */
export async function getCalendarAvailability(companyDomain, companyUserId, startDate, endDate) {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({
    companyDomain,
    companyUserId,
    startDate,
    endDate
  });

  const response = await fetch(`${FUNCTIONS_BASE_URL}/getCalendarAvailability?${params}`, { headers });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '空き時間の取得に失敗しました');
  }

  return response.json();
}

/**
 * カレンダーイベントを作成（面談を登録）
 * @param {Object} params
 * @param {string} params.companyDomain - 会社ドメイン
 * @param {string} params.companyUserId - 会社ユーザーID
 * @param {string} params.applicationId - 応募ID
 * @param {string} params.applicantName - 応募者名
 * @param {string} params.applicantEmail - 応募者メール
 * @param {string} params.staffName - 担当者名
 * @param {Date|string} params.scheduledAt - 面談日時
 * @param {number} params.durationMinutes - 面談時間（分）
 * @param {string} params.meetingType - 面談形式 ('in_person'|'online'|'phone')
 * @param {string} params.location - 場所/URL
 * @param {Array} params.reminders - リマインダー設定 [{offsetMinutes: number, sendTime: string}]
 * @returns {Promise<{interviewId: string, googleEventId: string}>}
 */
export async function createCalendarEvent(params) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/createCalendarEvent`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'イベントの作成に失敗しました');
  }

  return response.json();
}

/**
 * 週の開始日を取得（月曜日）
 * @param {Date} date
 * @returns {Date}
 */
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 週の終了日を取得（日曜日）
 * @param {Date} date
 * @returns {Date}
 */
export function getWeekEnd(date) {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 * @param {Date} date
 * @returns {string}
 */
export function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 曜日を取得
 * @param {Date} date
 * @returns {string}
 */
export function getDayOfWeek(date) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
}

export default {
  initiateCalendarAuth,
  getCalendarIntegration,
  revokeCalendarAuth,
  getCalendarAvailability,
  createCalendarEvent,
  getWeekStart,
  getWeekEnd,
  formatDateISO,
  getDayOfWeek
};
