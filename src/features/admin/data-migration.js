/**
 * データ移行モジュール
 * スプレッドシートからFirestoreへのデータ移行をブラウザ側で実行
 */

import { config, spreadsheetConfig } from './config.js';
import * as FirestoreService from '@shared/firestore-service.js';

// 進捗状態
let migrationProgress = {
  status: 'idle', // idle, running, completed, error
  currentStep: '',
  companiesTotal: 0,
  companiesDone: 0,
  jobsTotal: 0,
  jobsDone: 0,
  errors: []
};

/**
 * 進捗状態を取得
 */
export function getMigrationProgress() {
  return { ...migrationProgress };
}

/**
 * 進捗をリセット
 */
function resetProgress() {
  migrationProgress = {
    status: 'idle',
    currentStep: '',
    companiesTotal: 0,
    companiesDone: 0,
    jobsTotal: 0,
    jobsDone: 0,
    errors: []
  };
}

/**
 * 進捗を更新
 */
function updateProgress(updates) {
  migrationProgress = { ...migrationProgress, ...updates };
  console.log('[Migration]', migrationProgress.currentStep, migrationProgress);
}

/**
 * GAS APIから会社一覧を取得
 */
async function fetchCompaniesFromGAS() {
  const url = `${spreadsheetConfig.gasApiUrl}?action=getCompanies`;
  const response = await fetch(url);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || '会社一覧の取得に失敗');
  }

  return result.companies || [];
}

/**
 * GAS APIから求人を取得
 */
async function fetchJobsFromGAS(companyDomain) {
  const url = `${spreadsheetConfig.gasApiUrl}?action=getJobs&domain=${encodeURIComponent(companyDomain)}`;
  const response = await fetch(url);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || '求人の取得に失敗');
  }

  return result.jobs || [];
}

/**
 * GAS APIから採用ページ設定を取得
 */
async function fetchRecruitSettingsFromGAS(companyDomain) {
  const url = `${spreadsheetConfig.gasApiUrl}?action=getRecruitSettings&companyDomain=${encodeURIComponent(companyDomain)}`;
  const response = await fetch(url);
  const result = await response.json();

  if (!result.success) {
    return null; // 設定がない場合はnull
  }

  return result.settings || null;
}

/**
 * GAS APIからLP設定を取得
 */
async function fetchLPSettingsFromGAS(companyDomain, jobId) {
  const url = `${spreadsheetConfig.gasApiUrl}?action=getLPSettings&companyDomain=${encodeURIComponent(companyDomain)}&jobId=${encodeURIComponent(jobId)}`;
  const response = await fetch(url);
  const result = await response.json();

  if (!result.success) {
    return null;
  }

  return result.settings || null;
}

/**
 * LP設定をFirestoreに保存
 */
async function migrateLPSettings(companyDomain, jobId, settings) {
  if (!settings) return;

  const result = await FirestoreService.saveLPSettings(companyDomain, jobId, settings);
  if (!result.success) {
    throw new Error(result.error);
  }
}

/**
 * 会社データをFirestoreに保存
 */
async function migrateCompany(company) {
  const companyDomain = company.companyDomain || company.domain;
  if (!companyDomain) {
    throw new Error('会社ドメインがありません');
  }

  const companyData = {
    company: company.company || company.name || '',
    description: company.description || '',
    jobDescription: company.jobDescription || '',
    workingHours: company.workingHours || '',
    companyAddress: company.companyAddress || company.address || '',
    workLocation: company.workLocation || '',
    designPattern: company.designPattern || '',
    imageUrl: company.imageUrl || '',
    order: parseInt(company.order) || 0,
    showCompany: company.showCompany === true || company.showCompany === '○' || company.showCompany === '◯',
    manageSheetUrl: company.manageSheetUrl || company.jobsSheet || ''
  };

  const result = await FirestoreService.saveCompany(companyDomain, companyData);
  if (!result.success) {
    throw new Error(result.error);
  }

  return companyDomain;
}

/**
 * 求人データをFirestoreに保存
 */
async function migrateJob(companyDomain, job) {
  const jobData = {
    id: String(job.id || ''),
    title: job.title || '',
    location: job.location || '',
    area: job.area || '',
    totalBonus: job.totalBonus || '',
    monthlySalary: job.monthlySalary || '',
    salaryType: job.salaryType || '',
    salaryOther: job.salaryOther || '',
    jobType: job.jobType || '',
    employmentType: job.employmentType || '',
    features: job.features || '',
    displayedFeatures: job.displayedFeatures || '',
    badges: job.badges || '',
    jobDescription: job.jobDescription || '',
    requirements: job.requirements || '',
    benefits: job.benefits || '',
    workingHours: job.workingHours || '',
    holidays: job.holidays || '',
    visible: job.visible === true || job.visible === 'true' || job.visible === 'TRUE',
    order: parseInt(job.order) || 0,
    publishStartDate: job.publishStartDate || '',
    publishEndDate: job.publishEndDate || '',
    memo: job.memo || '',
    access: job.access || '',
    imageUrl: job.imageUrl || '',
    jobLogo: job.jobLogo || job.imageUrl || '',
    showVideoButton: job.showVideoButton === true || job.showVideoButton === 'true',
    videoUrl: job.videoUrl || ''
  };

  const result = await FirestoreService.saveJob(companyDomain, jobData, job.id ? String(job.id) : null);
  if (!result.success) {
    throw new Error(result.error);
  }
}

/**
 * 採用ページ設定をFirestoreに保存
 */
async function migrateRecruitSettings(companyDomain, settings) {
  if (!settings) return;

  const result = await FirestoreService.saveRecruitSettings(companyDomain, settings);
  if (!result.success) {
    throw new Error(result.error);
  }
}

/**
 * 全データを移行
 */
export async function migrateAllData(onProgress) {
  resetProgress();
  updateProgress({ status: 'running', currentStep: '初期化中...' });

  try {
    // Firestore初期化
    FirestoreService.initFirestore();

    // 会社一覧を取得
    updateProgress({ currentStep: '会社一覧を取得中...' });
    const companies = await fetchCompaniesFromGAS();
    updateProgress({ companiesTotal: companies.length });

    if (onProgress) onProgress(getMigrationProgress());

    // 各会社を移行
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      const companyDomain = company.companyDomain || company.domain;

      if (!companyDomain) {
        migrationProgress.errors.push(`会社 ${i + 1}: ドメインなし`);
        continue;
      }

      try {
        updateProgress({ currentStep: `会社を移行中: ${companyDomain}` });

        // 会社を保存
        await migrateCompany(company);

        // 求人を取得・保存
        updateProgress({ currentStep: `${companyDomain} の求人を取得中...` });
        const jobs = await fetchJobsFromGAS(companyDomain);
        updateProgress({ jobsTotal: migrationProgress.jobsTotal + jobs.length });

        for (const job of jobs) {
          try {
            await migrateJob(companyDomain, job);
            updateProgress({ jobsDone: migrationProgress.jobsDone + 1 });
          } catch (jobError) {
            migrationProgress.errors.push(`${companyDomain}/job ${job.id}: ${jobError.message}`);
          }
        }

        // 採用ページ設定を取得・保存
        try {
          const recruitSettings = await fetchRecruitSettingsFromGAS(companyDomain);
          if (recruitSettings) {
            await migrateRecruitSettings(companyDomain, recruitSettings);
          }
        } catch (settingsError) {
          migrationProgress.errors.push(`${companyDomain}/recruitSettings: ${settingsError.message}`);
        }

        updateProgress({ companiesDone: i + 1 });

      } catch (companyError) {
        migrationProgress.errors.push(`${companyDomain}: ${companyError.message}`);
      }

      if (onProgress) onProgress(getMigrationProgress());

      // レート制限回避のため少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    updateProgress({
      status: 'completed',
      currentStep: '完了'
    });

    if (onProgress) onProgress(getMigrationProgress());

    return {
      success: true,
      companiesCount: migrationProgress.companiesDone,
      jobsCount: migrationProgress.jobsDone,
      errors: migrationProgress.errors
    };

  } catch (error) {
    updateProgress({
      status: 'error',
      currentStep: `エラー: ${error.message}`
    });

    if (onProgress) onProgress(getMigrationProgress());

    return {
      success: false,
      error: error.message,
      errors: migrationProgress.errors
    };
  }
}

/**
 * 単一会社をテスト移行
 */
export async function migrateTestCompany(companyDomain, onProgress) {
  resetProgress();
  updateProgress({ status: 'running', currentStep: '初期化中...' });

  try {
    FirestoreService.initFirestore();

    // 会社一覧から該当会社を探す
    updateProgress({ currentStep: '会社情報を取得中...' });
    const companies = await fetchCompaniesFromGAS();
    const company = companies.find(c => (c.companyDomain || c.domain) === companyDomain);

    if (!company) {
      throw new Error(`会社が見つかりません: ${companyDomain}`);
    }

    updateProgress({ companiesTotal: 1, currentStep: '会社を移行中...' });
    await migrateCompany(company);
    updateProgress({ companiesDone: 1 });

    if (onProgress) onProgress(getMigrationProgress());

    // 求人を取得・保存
    updateProgress({ currentStep: '求人を取得中...' });
    const jobs = await fetchJobsFromGAS(companyDomain);
    updateProgress({ jobsTotal: jobs.length });

    for (const job of jobs) {
      try {
        await migrateJob(companyDomain, job);
        updateProgress({ jobsDone: migrationProgress.jobsDone + 1 });
      } catch (jobError) {
        migrationProgress.errors.push(`job ${job.id}: ${jobError.message}`);
      }
      if (onProgress) onProgress(getMigrationProgress());
    }

    // 採用ページ設定
    try {
      const recruitSettings = await fetchRecruitSettingsFromGAS(companyDomain);
      if (recruitSettings) {
        await migrateRecruitSettings(companyDomain, recruitSettings);
      }
    } catch (e) {
      migrationProgress.errors.push(`recruitSettings: ${e.message}`);
    }

    updateProgress({ status: 'completed', currentStep: '完了' });
    if (onProgress) onProgress(getMigrationProgress());

    return {
      success: true,
      companiesCount: 1,
      jobsCount: migrationProgress.jobsDone,
      errors: migrationProgress.errors
    };

  } catch (error) {
    updateProgress({ status: 'error', currentStep: `エラー: ${error.message}` });
    if (onProgress) onProgress(getMigrationProgress());
    return { success: false, error: error.message };
  }
}

/**
 * LP設定を全て移行
 */
export async function migrateAllLPSettings(onProgress) {
  resetProgress();
  updateProgress({ status: 'running', currentStep: '初期化中...' });

  let lpCount = 0;

  try {
    FirestoreService.initFirestore();

    // 会社一覧を取得
    updateProgress({ currentStep: '会社一覧を取得中...' });
    const companies = await fetchCompaniesFromGAS();
    updateProgress({ companiesTotal: companies.length });

    if (onProgress) onProgress(getMigrationProgress());

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      const companyDomain = company.companyDomain || company.domain;

      if (!companyDomain) continue;

      try {
        updateProgress({ currentStep: `${companyDomain} のLP設定を取得中...` });

        // 求人一覧を取得
        const jobs = await fetchJobsFromGAS(companyDomain);

        // 各求人のLP設定を移行
        for (const job of jobs) {
          try {
            const lpSettings = await fetchLPSettingsFromGAS(companyDomain, job.id);
            if (lpSettings && Object.keys(lpSettings).length > 0) {
              await migrateLPSettings(companyDomain, job.id, lpSettings);
              lpCount++;
              updateProgress({ currentStep: `${companyDomain}/job ${job.id} のLP設定を移行完了` });
            }
          } catch (lpError) {
            migrationProgress.errors.push(`${companyDomain}/lp ${job.id}: ${lpError.message}`);
          }

          // レート制限回避
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        updateProgress({ companiesDone: i + 1 });

      } catch (companyError) {
        migrationProgress.errors.push(`${companyDomain}: ${companyError.message}`);
      }

      if (onProgress) onProgress(getMigrationProgress());
    }

    updateProgress({ status: 'completed', currentStep: '完了' });
    if (onProgress) onProgress(getMigrationProgress());

    return {
      success: true,
      lpSettingsCount: lpCount,
      errors: migrationProgress.errors
    };

  } catch (error) {
    updateProgress({ status: 'error', currentStep: `エラー: ${error.message}` });
    if (onProgress) onProgress(getMigrationProgress());
    return { success: false, error: error.message, errors: migrationProgress.errors };
  }
}

export default {
  migrateAllData,
  migrateTestCompany,
  migrateAllLPSettings,
  getMigrationProgress
};
