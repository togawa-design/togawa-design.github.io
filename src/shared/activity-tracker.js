/**
 * 管理画面アクティビティトラッカー
 * 管理画面の利用状況を記録する
 */

let firebaseDb = null;
let currentUserInfo = null;
let authExpiredNotified = false; // 認証切れ通知済みフラグ
let authInitialized = false; // Firebase Auth 初期化完了フラグ
let initTime = null; // 初期化時刻

/**
 * トラッカーを初期化
 * @param {object} db - Firestore インスタンス
 * @param {object} userInfo - { userId, userName, companyDomain, companyName }
 */
export function initActivityTracker(db, userInfo) {
  firebaseDb = db;
  currentUserInfo = userInfo;
  authExpiredNotified = false;
  initTime = Date.now();

  // Firebase Auth の初期化状態を監視
  if (typeof firebase !== 'undefined' && firebase.auth) {
    // 既に認証済みならフラグを立てる
    if (firebase.auth().currentUser) {
      authInitialized = true;
    }
    // onAuthStateChanged で初期化完了を検知
    firebase.auth().onAuthStateChanged(() => {
      authInitialized = true;
    });
  }
}

/**
 * Firebase Auth が有効かチェック
 * @returns {boolean}
 */
function isFirebaseAuthValid() {
  // グローバルのfirebaseオブジェクトを確認
  if (typeof firebase === 'undefined' || !firebase.auth) {
    return false;
  }
  return !!firebase.auth().currentUser;
}

/**
 * 認証切れを処理
 */
function handleAuthExpired() {
  if (authExpiredNotified) return;
  authExpiredNotified = true;

  // カスタムイベントを発火して再認証を促す
  const event = new CustomEvent('firebaseAuthExpired', {
    detail: { message: 'Firebase認証が切れています' }
  });
  window.dispatchEvent(event);
}

/**
 * ユーザー情報を更新
 */
export function updateUserInfo(userInfo) {
  currentUserInfo = userInfo;
}

/**
 * アクティビティを記録
 * @param {string} action - 'login' | 'view' | 'create' | 'update' | 'delete'
 * @param {string} section - セクション名
 * @param {object} details - 追加情報 { jobId?, applicationId?, targetId? }
 */
export async function trackActivity(action, section, details = {}) {
  if (!firebaseDb || !currentUserInfo) {
    console.warn('[ActivityTracker] Not initialized');
    return;
  }

  // Firebase Auth が無効の場合
  if (!isFirebaseAuthValid()) {
    // 初期化から5秒以内、または Auth がまだ初期化されていない場合はスキップ（認証切れ扱いしない）
    const gracePeriod = 5000; // 5秒
    if (!authInitialized || (initTime && Date.now() - initTime < gracePeriod)) {
      console.log('[ActivityTracker] Skipping - auth not ready yet');
      return;
    }
    // 初期化完了後に認証切れの場合のみハンドル
    handleAuthExpired();
    return;
  }

  try {
    await firebaseDb.collection('admin_activity').add({
      userId: currentUserInfo.userId,
      userName: currentUserInfo.userName || '',
      companyDomain: currentUserInfo.companyDomain,
      companyName: currentUserInfo.companyName || '',
      action,
      section,
      details,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    // 認証エラーの場合は再認証を促す
    if (error.code === 'permission-denied') {
      handleAuthExpired();
    } else {
      console.error('[ActivityTracker] Failed to track activity:', error);
    }
  }
}

/**
 * ログインを記録（company_users の統計も更新）
 */
export async function trackLogin(userDocId) {
  if (!firebaseDb || !currentUserInfo) return;

  try {
    // admin_activity に記録
    await trackActivity('login', 'auth');

    // company_users のログイン統計を更新
    if (userDocId) {
      const userRef = firebaseDb.collection('company_users').doc(userDocId);
      await userRef.update({
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        loginCount: firebase.firestore.FieldValue.increment(1)
      });
    }
  } catch (error) {
    console.error('[ActivityTracker] Failed to track login:', error);
  }
}

/**
 * セクション表示を記録
 */
export function trackSectionView(section) {
  trackActivity('view', section);
}

/**
 * 作成アクションを記録
 */
export function trackCreate(section, details = {}) {
  trackActivity('create', section, details);
}

/**
 * 更新アクションを記録
 */
export function trackUpdate(section, details = {}) {
  trackActivity('update', section, details);
}

/**
 * 削除アクションを記録
 */
export function trackDelete(section, details = {}) {
  trackActivity('delete', section, details);
}

/**
 * lastActiveAt を更新（定期的に呼び出し）
 */
export async function updateLastActive(userDocId) {
  if (!firebaseDb || !userDocId) return;

  try {
    await firebaseDb.collection('company_users').doc(userDocId).update({
      lastActiveAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    // エラーは無視（バックグラウンド更新のため）
  }
}

// ============================================
// データ取得（管理者用）
// ============================================

/**
 * 全社の利用状況サマリーを取得
 * @param {number} days - 過去N日間
 */
export async function getUsageSummary(days = 30) {
  if (!firebaseDb) return null;

  // Firebase Auth が無効の場合
  if (!isFirebaseAuthValid()) {
    // 初期化から5秒以内、または Auth がまだ初期化されていない場合はスキップ
    const gracePeriod = 5000;
    if (!authInitialized || (initTime && Date.now() - initTime < gracePeriod)) {
      console.log('[ActivityTracker] getUsageSummary - auth not ready yet');
      return null;
    }
    handleAuthExpired();
    return null;
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    // アクティビティを取得
    const activitySnapshot = await firebaseDb.collection('admin_activity')
      .where('timestamp', '>=', since)
      .get();

    // 会社ユーザーを取得
    const usersSnapshot = await firebaseDb.collection('company_users').get();

    const activities = activitySnapshot.docs.map(doc => doc.data());
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 集計
    const companyStats = {};
    const sectionStats = {};
    let totalLogins = 0;

    activities.forEach(act => {
      const domain = act.companyDomain;
      if (!companyStats[domain]) {
        companyStats[domain] = {
          companyDomain: domain,
          companyName: act.companyName || domain,
          logins: 0,
          actions: 0,
          sections: {}
        };
      }
      companyStats[domain].actions++;
      if (act.action === 'login') {
        companyStats[domain].logins++;
        totalLogins++;
      }
      if (act.section) {
        companyStats[domain].sections[act.section] = (companyStats[domain].sections[act.section] || 0) + 1;
        sectionStats[act.section] = (sectionStats[act.section] || 0) + 1;
      }
    });

    // アクティブ/休眠企業数
    const now = new Date();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    let activeCompanies = 0;
    let dormantCompanies = 0;

    // 会社ごとの最終ログインを確認
    const companyLastLogin = {};
    users.forEach(user => {
      const domain = user.companyDomain;
      const lastLogin = user.lastLoginAt?.toDate?.() || null;
      if (lastLogin && (!companyLastLogin[domain] || lastLogin > companyLastLogin[domain])) {
        companyLastLogin[domain] = lastLogin;
      }
    });

    Object.entries(companyLastLogin).forEach(([domain, lastLogin]) => {
      if (lastLogin >= sevenDaysAgo) {
        activeCompanies++;
      } else if (lastLogin < thirtyDaysAgo) {
        dormantCompanies++;
      }
    });

    return {
      totalCompanies: Object.keys(companyLastLogin).length,
      activeCompanies,
      dormantCompanies,
      totalLogins,
      totalActions: activities.length,
      companyStats: Object.values(companyStats),
      sectionStats
    };
  } catch (error) {
    console.error('[ActivityTracker] Failed to get usage summary:', error);
    return null;
  }
}

/**
 * 会社別の詳細利用状況を取得
 * @param {string} companyDomain
 * @param {number} days
 */
export async function getCompanyUsageDetail(companyDomain, days = 30) {
  if (!firebaseDb) return null;

  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    // アクティビティを取得
    const activitySnapshot = await firebaseDb.collection('admin_activity')
      .where('companyDomain', '==', companyDomain)
      .where('timestamp', '>=', since)
      .orderBy('timestamp', 'desc')
      .limit(500)
      .get();

    // 会社ユーザーを取得
    const usersSnapshot = await firebaseDb.collection('company_users')
      .where('companyDomain', '==', companyDomain)
      .get();

    const activities = activitySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || null
    }));

    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      lastLoginAt: doc.data().lastLoginAt?.toDate?.() || null,
      lastActiveAt: doc.data().lastActiveAt?.toDate?.() || null,
      createdAt: doc.data().createdAt?.toDate?.() || null
    }));

    // ユーザー別集計
    const userStats = {};
    users.forEach(user => {
      userStats[user.id] = {
        userId: user.id,
        userName: user.name || user.username || user.email,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        actions: 0,
        sections: {}
      };
    });

    // 機能別集計
    const sectionStats = {};
    let totalLogins = 0;

    activities.forEach(act => {
      if (userStats[act.userId]) {
        userStats[act.userId].actions++;
        if (act.section) {
          userStats[act.userId].sections[act.section] = (userStats[act.userId].sections[act.section] || 0) + 1;
        }
      }
      if (act.action === 'login') totalLogins++;
      if (act.section) {
        sectionStats[act.section] = (sectionStats[act.section] || 0) + 1;
      }
    });

    return {
      companyDomain,
      totalLogins,
      totalActions: activities.length,
      userStats: Object.values(userStats),
      sectionStats,
      recentActivities: activities.slice(0, 50) // 直近50件
    };
  } catch (error) {
    console.error('[ActivityTracker] Failed to get company usage detail:', error);
    return null;
  }
}

/**
 * 機能別利用状況を取得
 * @param {number} days
 */
export async function getSectionUsageStats(days = 30) {
  if (!firebaseDb) return null;

  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    const activitySnapshot = await firebaseDb.collection('admin_activity')
      .where('timestamp', '>=', since)
      .get();

    const sectionStats = {};

    activitySnapshot.docs.forEach(doc => {
      const data = doc.data();
      const section = data.section;
      if (section) {
        if (!sectionStats[section]) {
          sectionStats[section] = { section, total: 0, byAction: {} };
        }
        sectionStats[section].total++;
        sectionStats[section].byAction[data.action] = (sectionStats[section].byAction[data.action] || 0) + 1;
      }
    });

    return Object.values(sectionStats).sort((a, b) => b.total - a.total);
  } catch (error) {
    console.error('[ActivityTracker] Failed to get section usage stats:', error);
    return null;
  }
}

/**
 * ユーザー別利用状況を取得
 * @param {number} days
 */
export async function getUserUsageStats(days = 30) {
  if (!firebaseDb) return null;

  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    const activitySnapshot = await firebaseDb.collection('admin_activity')
      .where('timestamp', '>=', since)
      .get();

    const usersSnapshot = await firebaseDb.collection('company_users').get();

    const userMap = {};
    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      userMap[doc.id] = {
        userId: doc.id,
        userName: data.name || data.username || data.email,
        companyDomain: data.companyDomain,
        companyName: data.companyName || data.companyDomain,
        lastLoginAt: data.lastLoginAt?.toDate?.() || null,
        actions: 0
      };
    });

    activitySnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (userMap[data.userId]) {
        userMap[data.userId].actions++;
      }
    });

    return Object.values(userMap)
      .filter(u => u.actions > 0)
      .sort((a, b) => b.actions - a.actions);
  } catch (error) {
    console.error('[ActivityTracker] Failed to get user usage stats:', error);
    return null;
  }
}

export default {
  initActivityTracker,
  updateUserInfo,
  trackActivity,
  trackLogin,
  trackSectionView,
  trackCreate,
  trackUpdate,
  trackDelete,
  updateLastActive,
  getUsageSummary,
  getCompanyUsageDetail,
  getSectionUsageStats,
  getUserUsageStats
};
