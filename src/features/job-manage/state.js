/**
 * 求人管理 - 共有状態管理モジュール
 */

// 会社情報
export let companyDomain = null;
export let companyName = null;
export let sheetUrl = null;

// 求人データ
export let jobsCache = [];
export let currentEditingJob = null;
export let isNewJob = false;

// 統計・レポートデータ
export let applicationsCache = [];
export let reportData = null;
export let analyticsCache = null;
export let jobStatsCache = {}; // { jobId: { applications: number, pv: number } }

// フィルター状態
export let jobFilters = {
  search: '',
  status: '',
  area: ''
};

// LP設定用
export let allJobsCacheForLP = [];
export let currentJobDataForLP = null;

// 初期化フラグ
export let applicantsInitialized = false;
export let lpSettingsInitialized = false;

// ヒーロー画像プリセット
export const heroImagePresets = [
  { id: 'teamwork-1', name: 'チームミーティング', url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&q=60' },
  { id: 'teamwork-2', name: 'オフィスワーク', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=60' },
  { id: 'teamwork-3', name: 'コラボレーション', url: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=60' },
  { id: 'work-1', name: '製造ライン', url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=60' },
  { id: 'work-2', name: '倉庫作業', url: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&q=60' },
  { id: 'work-3', name: '建設現場', url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=60' },
  { id: 'work-4', name: '工場作業', url: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&q=60' },
  { id: 'work-5', name: 'チームワーク', url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=60' }
];

export const MAX_POINTS = 6;

// 状態を更新する関数
export function setCompanyInfo(domain, name, url) {
  companyDomain = domain;
  companyName = name;
  sheetUrl = url;
}

export function setSheetUrl(url) {
  sheetUrl = url;
}

export function setJobsCache(jobs) {
  jobsCache = jobs;
}

export function setCurrentEditingJob(job) {
  currentEditingJob = job;
}

export function setIsNewJob(value) {
  isNewJob = value;
}

export function setApplicationsCache(applications) {
  applicationsCache = applications;
}

export function setReportData(data) {
  reportData = data;
}

export function setAnalyticsCache(data) {
  analyticsCache = data;
}

export function setJobStatsCache(stats) {
  jobStatsCache = stats;
}

export function updateJobStatsCache(jobId, stats) {
  jobStatsCache[jobId] = stats;
}

export function setJobFilters(filters) {
  jobFilters = filters;
}

export function resetJobFilters() {
  jobFilters = { search: '', status: '', area: '' };
}

export function setAllJobsCacheForLP(jobs) {
  allJobsCacheForLP = jobs;
}

export function setCurrentJobDataForLP(job) {
  currentJobDataForLP = job;
}

export function setApplicantsInitialized(value) {
  applicantsInitialized = value;
}

export function setLpSettingsInitialized(value) {
  lpSettingsInitialized = value;
}
