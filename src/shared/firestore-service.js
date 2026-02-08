/**
 * Firestore サービスモジュール
 *
 * 会社、求人、LP設定、採用ページ設定のCRUD操作を提供
 */

import { config } from '../features/admin/config.js';

let db = null;
let firebase = null;
let initPromise = null;

/**
 * Firebase SDKが読み込まれるまで待機
 */
function waitForFirebase(maxWait = 5000) {
  return new Promise((resolve, reject) => {
    // 既に読み込まれている場合
    if (typeof window !== 'undefined' && window.firebase) {
      resolve(window.firebase);
      return;
    }

    const startTime = Date.now();
    const checkInterval = 50;

    const check = () => {
      if (typeof window !== 'undefined' && window.firebase) {
        resolve(window.firebase);
        return;
      }

      if (Date.now() - startTime >= maxWait) {
        reject(new Error('Firebase SDK load timeout'));
        return;
      }

      setTimeout(check, checkInterval);
    };

    check();
  });
}

/**
 * Firestoreを初期化
 */
export function initFirestore() {
  if (db) return db;

  if (typeof window !== 'undefined' && window.firebase) {
    firebase = window.firebase;

    if (!firebase.apps.length) {
      firebase.initializeApp(config.firebaseConfig);
    }

    db = firebase.firestore();
    return db;
  }

  console.warn('[FirestoreService] Firebase not loaded');
  return null;
}

/**
 * Firestoreを非同期で初期化（Firebase SDK読み込み待機あり）
 */
export async function initFirestoreAsync() {
  if (db) return db;

  // 既に初期化中の場合は同じPromiseを返す
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      firebase = await waitForFirebase();

      if (!firebase.apps.length) {
        firebase.initializeApp(config.firebaseConfig);
      }

      db = firebase.firestore();
      console.log('[FirestoreService] Firestore initialized successfully');
      return db;
    } catch (error) {
      console.error('[FirestoreService] Firebase initialization error:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Firestoreインスタンスを取得（同期版）
 */
export function getFirestore() {
  if (!db) {
    initFirestore();
  }
  return db;
}

/**
 * Firestoreインスタンスを取得（非同期版、SDK待機あり）
 */
export async function getFirestoreAsync() {
  if (!db) {
    await initFirestoreAsync();
  }
  return db;
}

// ========================================
// 会社 (Companies)
// ========================================

/**
 * 全会社を取得
 */
export async function getCompanies() {
  const firestore = await getFirestoreAsync();
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    const snapshot = await firestore.collection('companies')
      .orderBy('order', 'asc')
      .get();

    const companies = [];
    snapshot.forEach(doc => {
      companies.push({
        id: doc.id,
        companyDomain: doc.id,
        ...doc.data()
      });
    });

    return { success: true, companies };
  } catch (error) {
    console.error('[FirestoreService] getCompanies error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 単一会社を取得
 */
export async function getCompany(companyDomain) {
  const firestore = await getFirestoreAsync();
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    const doc = await firestore.collection('companies').doc(companyDomain).get();

    if (!doc.exists) {
      return { success: false, error: '会社が見つかりません' };
    }

    return {
      success: true,
      company: {
        id: doc.id,
        companyDomain: doc.id,
        ...doc.data()
      }
    };
  } catch (error) {
    console.error('[FirestoreService] getCompany error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 会社を保存（作成/更新）
 */
export async function saveCompany(companyDomain, companyData) {
  const firestore = await getFirestoreAsync();
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    const docRef = firestore.collection('companies').doc(companyDomain);
    const existingDoc = await docRef.get();
    const isNew = !existingDoc.exists;

    const dataToSave = {
      ...companyData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (isNew) {
      dataToSave.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    await docRef.set(dataToSave, { merge: true });

    return {
      success: true,
      message: isNew ? '会社を作成しました' : '会社情報を更新しました',
      companyDomain
    };
  } catch (error) {
    console.error('[FirestoreService] saveCompany error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 会社を削除
 */
export async function deleteCompany(companyDomain) {
  const firestore = await getFirestoreAsync();
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    // サブコレクション（jobs, lpSettings, recruitSettings）も削除
    const batch = firestore.batch();

    // 求人を削除
    const jobsSnapshot = await firestore
      .collection('companies').doc(companyDomain)
      .collection('jobs').get();
    jobsSnapshot.forEach(doc => batch.delete(doc.ref));

    // LP設定を削除
    const lpSnapshot = await firestore
      .collection('companies').doc(companyDomain)
      .collection('lpSettings').get();
    lpSnapshot.forEach(doc => batch.delete(doc.ref));

    // 採用ページ設定を削除
    const recruitSnapshot = await firestore
      .collection('companies').doc(companyDomain)
      .collection('recruitSettings').get();
    recruitSnapshot.forEach(doc => batch.delete(doc.ref));

    // 会社ドキュメントを削除
    batch.delete(firestore.collection('companies').doc(companyDomain));

    await batch.commit();

    return { success: true, message: '会社を削除しました' };
  } catch (error) {
    console.error('[FirestoreService] deleteCompany error:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// 求人 (Jobs)
// ========================================

/**
 * 会社の全求人を取得
 */
export async function getJobs(companyDomain) {
  const firestore = await getFirestoreAsync();
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    const snapshot = await firestore
      .collection('companies').doc(companyDomain)
      .collection('jobs')
      .orderBy('order', 'asc')
      .get();

    const jobs = [];
    let rowIndex = 3; // スプレッドシート互換（ヘッダー2行 + 1）

    snapshot.forEach(doc => {
      jobs.push({
        ...doc.data(),
        _rowIndex: rowIndex,
        _docId: doc.id
      });
      rowIndex++;
    });

    return { success: true, jobs };
  } catch (error) {
    console.error('[FirestoreService] getJobs error:', error);
    return { success: false, error: error.message, jobs: [] };
  }
}

/**
 * 単一求人を取得
 */
export async function getJob(companyDomain, jobId) {
  const firestore = await getFirestoreAsync();
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    const doc = await firestore
      .collection('companies').doc(companyDomain)
      .collection('jobs').doc(String(jobId))
      .get();

    if (!doc.exists) {
      return { success: false, error: '求人が見つかりません' };
    }

    return {
      success: true,
      job: {
        ...doc.data(),
        _docId: doc.id
      }
    };
  } catch (error) {
    console.error('[FirestoreService] getJob error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 求人を保存（作成/更新）
 */
export async function saveJob(companyDomain, jobData, existingDocId = null) {
  const firestore = await getFirestoreAsync();
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    const jobsRef = firestore.collection('companies').doc(companyDomain).collection('jobs');

    let docRef;
    let isNew = false;
    let jobId;

    if (existingDocId) {
      // 既存ドキュメントを更新
      docRef = jobsRef.doc(String(existingDocId));
      jobId = existingDocId;
    } else if (jobData.id) {
      // IDが指定されている場合
      docRef = jobsRef.doc(String(jobData.id));
      const existingDoc = await docRef.get();
      isNew = !existingDoc.exists;
      jobId = jobData.id;
    } else {
      // 新規作成 - 新しいIDを生成
      const snapshot = await jobsRef.orderBy('id', 'desc').limit(1).get();
      let maxId = 0;
      snapshot.forEach(doc => {
        const id = parseInt(doc.data().id) || 0;
        if (id > maxId) maxId = id;
      });
      jobId = maxId + 1;
      docRef = jobsRef.doc(String(jobId));
      isNew = true;
    }

    const dataToSave = {
      ...jobData,
      id: String(jobId),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (isNew) {
      dataToSave.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    // _rowIndexと_docIdは保存しない
    delete dataToSave._rowIndex;
    delete dataToSave._docId;

    await docRef.set(dataToSave, { merge: true });

    return {
      success: true,
      message: isNew ? '求人を作成しました' : '求人情報を更新しました',
      jobId: jobId,
      rowIndex: null // Firestore使用時はrowIndexは不要
    };
  } catch (error) {
    console.error('[FirestoreService] saveJob error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 求人を削除
 */
export async function deleteJob(companyDomain, jobId) {
  const firestore = await getFirestoreAsync();
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    await firestore
      .collection('companies').doc(companyDomain)
      .collection('jobs').doc(String(jobId))
      .delete();

    return { success: true, message: '求人を削除しました' };
  } catch (error) {
    console.error('[FirestoreService] deleteJob error:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// LP設定 (LP Settings)
// ========================================

/**
 * LP設定を取得
 */
export async function getLPSettings(companyDomain, jobId = 'default') {
  const firestore = await getFirestoreAsync();
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    const doc = await firestore
      .collection('companies').doc(companyDomain)
      .collection('lpSettings').doc(String(jobId))
      .get();

    if (!doc.exists) {
      return { success: true, settings: {} };
    }

    return {
      success: true,
      settings: doc.data()
    };
  } catch (error) {
    console.error('[FirestoreService] getLPSettings error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * LP設定を保存
 */
export async function saveLPSettings(companyDomain, jobId, settingsData) {
  const firestore = await getFirestoreAsync();
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    const docRef = firestore
      .collection('companies').doc(companyDomain)
      .collection('lpSettings').doc(String(jobId || 'default'));

    const dataToSave = {
      ...settingsData,
      companyDomain,
      jobId: String(jobId || 'default'),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await docRef.set(dataToSave, { merge: true });

    return { success: true, message: 'LP設定を保存しました' };
  } catch (error) {
    console.error('[FirestoreService] saveLPSettings error:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// 採用ページ設定 (Recruit Settings)
// ========================================

/**
 * 採用ページ設定を取得
 */
export async function getRecruitSettings(companyDomain) {
  const firestore = await getFirestoreAsync();
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    const doc = await firestore
      .collection('companies').doc(companyDomain)
      .collection('recruitSettings').doc('main')
      .get();

    if (!doc.exists) {
      return { success: true, settings: {} };
    }

    return {
      success: true,
      settings: doc.data()
    };
  } catch (error) {
    console.error('[FirestoreService] getRecruitSettings error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 採用ページ設定を保存
 */
export async function saveRecruitSettings(companyDomain, settingsData) {
  const firestore = await getFirestoreAsync();
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    const docRef = firestore
      .collection('companies').doc(companyDomain)
      .collection('recruitSettings').doc('main');

    const dataToSave = {
      ...settingsData,
      companyDomain,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await docRef.set(dataToSave, { merge: true });

    return { success: true, message: '採用ページ設定を保存しました' };
  } catch (error) {
    console.error('[FirestoreService] saveRecruitSettings error:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// 全求人取得（公開ページ用）
// ========================================

/**
 * 全会社の公開求人を取得（コレクショングループクエリ）
 */
export async function getAllVisibleJobs() {
  const firestore = await getFirestoreAsync();
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    // collectionGroupクエリで全求人を一度に取得（インデックス必須）
    const snapshot = await firestore.collectionGroup('jobs')
      .where('visible', '==', true)
      .orderBy('order', 'asc')
      .get();

    const jobs = [];
    snapshot.forEach(doc => {
      // パスからcompanyDomainを抽出
      const pathParts = doc.ref.path.split('/');
      const companyDomain = pathParts[1]; // companies/{companyDomain}/jobs/{jobId}

      jobs.push({
        ...doc.data(),
        companyDomain,
        _docId: doc.id
      });
    });

    return { success: true, jobs };
  } catch (error) {
    console.error('[FirestoreService] getAllVisibleJobs error:', error);
    return { success: false, error: error.message, jobs: [] };
  }
}

/**
 * 求人統計を計算
 */
export async function getJobStats() {
  const firestore = await getFirestoreAsync();
  if (!firestore) throw new Error('Firestore not initialized');

  try {
    const result = await getAllVisibleJobs();
    if (!result.success) {
      return result;
    }

    const jobs = result.jobs;
    let totalSalary = 0;
    let salaryCount = 0;

    jobs.forEach(job => {
      const salary = parseSalary(job.monthlySalary);
      if (salary > 0) {
        totalSalary += salary;
        salaryCount++;
      }
    });

    const avgMonthlySalary = salaryCount > 0 ? Math.round(totalSalary / salaryCount) : 0;
    const avgHourlyWage = avgMonthlySalary > 0 ? Math.round(avgMonthlySalary / 160) : 0;

    return {
      success: true,
      stats: {
        jobCount: jobs.length,
        avgMonthlySalary,
        avgHourlyWage,
        updatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[FirestoreService] getJobStats error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 給与文字列をパース
 */
function parseSalary(salaryStr) {
  if (!salaryStr) return 0;

  const str = String(salaryStr).replace(/[,，]/g, '');

  // "30万円" -> 300000
  const manMatch = str.match(/(\d+(?:\.\d+)?)\s*万/);
  if (manMatch) {
    return parseFloat(manMatch[1]) * 10000;
  }

  // "300000円" or "¥300000" -> 300000
  const numMatch = str.match(/[\d,]+/);
  if (numMatch) {
    return parseInt(numMatch[0].replace(/,/g, '')) || 0;
  }

  return 0;
}

// デフォルトエクスポート
export default {
  initFirestore,
  initFirestoreAsync,
  getFirestore,
  getFirestoreAsync,
  getCompanies,
  getCompany,
  saveCompany,
  deleteCompany,
  getJobs,
  getJob,
  saveJob,
  deleteJob,
  getLPSettings,
  saveLPSettings,
  getRecruitSettings,
  saveRecruitSettings,
  getAllVisibleJobs,
  getJobStats
};
