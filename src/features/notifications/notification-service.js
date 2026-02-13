/**
 * 通知サービスモジュール
 *
 * お知らせ配信と応募者通知のCRUD操作を提供
 */

import { initFirestoreAsync, getFirestoreAsync } from '@shared/firestore-service.js';

// コレクション名
const ANNOUNCEMENTS_COLLECTION = 'announcements';
const NOTIFICATIONS_COLLECTION = 'notifications';

// ========================================
// お知らせ（Announcements）
// ========================================

/**
 * 公開中のお知らせを取得（対象者でフィルタ）
 * @param {string} targetAudience - 'job_seekers' | 'company_users' | 'all'
 * @returns {Promise<Array>}
 */
export async function getActiveAnnouncements(targetAudience = 'all') {
  const db = await getFirestoreAsync();
  const now = new Date();

  try {
    // status: published のみ取得（インデックス不要）
    const snapshot = await db.collection(ANNOUNCEMENTS_COLLECTION)
      .where('status', '==', 'published')
      .get();

    const announcements = [];

    snapshot.forEach(doc => {
      const data = doc.data();

      // 日付をパース（文字列でも Timestamp でも対応）
      const startDate = toDate(data.publishStartDate);
      const endDate = toDate(data.publishEndDate);

      // 期間チェック（クライアント側でフィルタ）
      if (startDate && startDate <= now && endDate && endDate >= now) {
        // 対象者フィルタ
        if (targetAudience === 'all' ||
            data.targetAudience === 'all' ||
            data.targetAudience === targetAudience) {
          announcements.push({
            id: doc.id,
            ...data,
            publishStartDate: startDate,
            publishEndDate: endDate,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt)
          });
        }
      }
    });

    // 優先度順にソート
    announcements.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    return announcements;
  } catch (error) {
    console.error('[NotificationService] Error:', error);
    return [];
  }
}

/**
 * 全てのお知らせを取得（管理用）
 * @returns {Promise<Array>}
 */
export async function getAllAnnouncements() {
  const db = await getFirestoreAsync();

  const snapshot = await db.collection(ANNOUNCEMENTS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      publishStartDate: data.publishStartDate?.toDate ? data.publishStartDate.toDate() : data.publishStartDate,
      publishEndDate: data.publishEndDate?.toDate ? data.publishEndDate.toDate() : data.publishEndDate,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
    };
  });
}

/**
 * お知らせを取得（ID指定）
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getAnnouncementById(id) {
  const db = await getFirestoreAsync();
  const doc = await db.collection(ANNOUNCEMENTS_COLLECTION).doc(id).get();

  if (!doc.exists) return null;

  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    publishStartDate: data.publishStartDate?.toDate ? data.publishStartDate.toDate() : data.publishStartDate,
    publishEndDate: data.publishEndDate?.toDate ? data.publishEndDate.toDate() : data.publishEndDate,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
  };
}

/**
 * 日付文字列または Date を Date オブジェクトに変換
 */
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (value.toDate) return value.toDate(); // Firestore Timestamp
  return new Date(value);
}

/**
 * お知らせを作成
 * @param {Object} data
 * @returns {Promise<string>} 作成されたドキュメントID
 */
export async function createAnnouncement(data) {
  const db = await getFirestoreAsync();
  const now = new Date();

  const docData = {
    title: data.title || '',
    content: data.content || '',
    targetAudience: data.targetAudience || 'all',
    publishStartDate: toDate(data.publishStartDate) || now,
    publishEndDate: toDate(data.publishEndDate) || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    status: data.status || 'draft',
    priority: data.priority || 0,
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy || ''
  };

  const docRef = await db.collection(ANNOUNCEMENTS_COLLECTION).add(docData);
  return docRef.id;
}

/**
 * お知らせを更新
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<void>}
 */
export async function updateAnnouncement(id, data) {
  const db = await getFirestoreAsync();

  const updateData = {
    ...data,
    updatedAt: new Date()
  };

  // 日付フィールドが文字列の場合はDateオブジェクトに変換
  if (typeof updateData.publishStartDate === 'string') {
    updateData.publishStartDate = new Date(updateData.publishStartDate);
  }
  if (typeof updateData.publishEndDate === 'string') {
    updateData.publishEndDate = new Date(updateData.publishEndDate);
  }

  await db.collection(ANNOUNCEMENTS_COLLECTION).doc(id).update(updateData);
}

/**
 * お知らせを削除
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteAnnouncement(id) {
  const db = await getFirestoreAsync();
  await db.collection(ANNOUNCEMENTS_COLLECTION).doc(id).delete();
}

// ========================================
// 応募者通知（Notifications）
// ========================================

/**
 * 応募者通知を取得（会社ドメインでフィルタ）
 * @param {string|null} companyDomain - null の場合は全件取得（Admin用）
 * @returns {Promise<Array>}
 */
export async function getApplicationNotifications(companyDomain = null) {
  const db = await getFirestoreAsync();

  let query = db.collection(NOTIFICATIONS_COLLECTION)
    .where('type', '==', 'application')
    .orderBy('createdAt', 'desc')
    .limit(50); // 最新50件

  if (companyDomain) {
    query = db.collection(NOTIFICATIONS_COLLECTION)
      .where('type', '==', 'application')
      .where('companyDomain', '==', companyDomain)
      .orderBy('createdAt', 'desc')
      .limit(50);
  }

  const snapshot = await query.get();

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
    };
  });
}

/**
 * 応募者通知を作成
 * @param {Object} data
 * @returns {Promise<string>}
 */
export async function createApplicationNotification(data) {
  const db = await getFirestoreAsync();

  const docData = {
    type: 'application',
    companyDomain: data.companyDomain || '',
    applicationId: data.applicationId || '',
    jobId: data.jobId || '',
    jobTitle: data.jobTitle || '',
    applicantName: data.applicantName || '',
    applicantEmail: data.applicantEmail || '',
    createdAt: new Date(),
    isRead: false
  };

  const docRef = await db.collection(NOTIFICATIONS_COLLECTION).add(docData);
  return docRef.id;
}

/**
 * 通知を既読にする
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function markNotificationAsRead(id) {
  const db = await getFirestoreAsync();
  await db.collection(NOTIFICATIONS_COLLECTION).doc(id).update({
    isRead: true
  });
}

/**
 * 指定会社の全通知を既読にする
 * @param {string} companyDomain
 * @returns {Promise<void>}
 */
export async function markAllNotificationsAsRead(companyDomain) {
  const db = await getFirestoreAsync();
  const batch = db.batch();

  const snapshot = await db.collection(NOTIFICATIONS_COLLECTION)
    .where('type', '==', 'application')
    .where('companyDomain', '==', companyDomain)
    .where('isRead', '==', false)
    .get();

  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { isRead: true });
  });

  await batch.commit();
}

/**
 * 未読通知数を取得
 * @param {string|null} companyDomain
 * @returns {Promise<number>}
 */
export async function getUnreadNotificationCount(companyDomain = null) {
  const db = await getFirestoreAsync();

  let query = db.collection(NOTIFICATIONS_COLLECTION)
    .where('type', '==', 'application')
    .where('isRead', '==', false);

  if (companyDomain) {
    query = query.where('companyDomain', '==', companyDomain);
  }

  const snapshot = await query.get();
  return snapshot.size;
}

// ========================================
// リアルタイムリスナー
// ========================================

/**
 * 応募者通知のリアルタイムリスナーを設定
 * @param {string|null} companyDomain
 * @param {Function} callback - (notifications) => void
 * @returns {Function} unsubscribe関数
 */
export async function subscribeToApplicationNotifications(companyDomain, callback) {
  const db = await getFirestoreAsync();

  let query = db.collection(NOTIFICATIONS_COLLECTION)
    .where('type', '==', 'application')
    .orderBy('createdAt', 'desc')
    .limit(50);

  if (companyDomain) {
    query = db.collection(NOTIFICATIONS_COLLECTION)
      .where('type', '==', 'application')
      .where('companyDomain', '==', companyDomain)
      .orderBy('createdAt', 'desc')
      .limit(50);
  }

  const unsubscribe = query.onSnapshot(snapshot => {
    const notifications = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
      };
    });
    callback(notifications);
  }, error => {
    console.error('[NotificationService] Listener error:', error);
  });

  return unsubscribe;
}

export default {
  // お知らせ
  getActiveAnnouncements,
  getAllAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  // 応募者通知
  getApplicationNotifications,
  createApplicationNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  subscribeToApplicationNotifications
};
