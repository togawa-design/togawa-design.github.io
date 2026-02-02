/**
 * Admin Dashboard - 状態管理
 * ナビゲーション履歴とjob-manage用の状態を管理
 */

// ナビゲーション履歴（戻るボタン用）
export let navigationHistory = [];

// 現在のjob-manage対象会社
export let currentCompany = {
  domain: null,
  name: null
};

// job-manageの現在のサブセクション
export let currentSubsection = 'jobs';

// 現在のcompany-edit対象会社ドメイン
export let editingCompanyDomain = null;

// 編集待ちの求人ID（job-listings → job-manage遷移時に使用）
export let pendingJobId = null;

// 初期表示タブ（job-manage遷移時に使用）
export let pendingInitialTab = null;

// セクション切り替え中フラグ（連打防止）
let isSwitchingSection = false;

// 非同期処理キャンセル用AbortController
let currentAbortController = null;

/**
 * 現在の会社を設定
 */
export function setCurrentCompany(domain, name) {
  currentCompany.domain = domain;
  currentCompany.name = name;
}

/**
 * 現在の会社をクリア
 */
export function clearCurrentCompany() {
  currentCompany.domain = null;
  currentCompany.name = null;
}

/**
 * ナビゲーション履歴に追加
 */
export function pushHistory(section) {
  if (section) {
    navigationHistory.push(section);
  }
}

/**
 * ナビゲーション履歴から取り出し
 */
export function popHistory() {
  return navigationHistory.pop() || null;
}

/**
 * ナビゲーション履歴をクリア
 */
export function clearHistory() {
  navigationHistory = [];
}

/**
 * サブセクションを設定
 */
export function setCurrentSubsection(subsection) {
  currentSubsection = subsection;
}

/**
 * 現在のサブセクションを取得
 */
export function getCurrentSubsection() {
  return currentSubsection;
}

/**
 * 編集中の会社ドメインを設定
 */
export function setEditingCompanyDomain(domain) {
  editingCompanyDomain = domain;
}

/**
 * 編集中の会社ドメインを取得
 */
export function getEditingCompanyDomain() {
  return editingCompanyDomain;
}

/**
 * 編集中の会社ドメインをクリア
 */
export function clearEditingCompanyDomain() {
  editingCompanyDomain = null;
}

/**
 * 編集待ちの求人IDを設定
 */
export function setPendingJobId(jobId) {
  pendingJobId = jobId;
}

/**
 * 編集待ちの求人IDを取得
 */
export function getPendingJobId() {
  return pendingJobId;
}

/**
 * 編集待ちの求人IDをクリア
 */
export function clearPendingJobId() {
  pendingJobId = null;
}

/**
 * 初期表示タブを設定
 */
export function setPendingInitialTab(tab) {
  pendingInitialTab = tab;
}

/**
 * 初期表示タブを取得
 */
export function getPendingInitialTab() {
  return pendingInitialTab;
}

/**
 * 初期表示タブをクリア
 */
export function clearPendingInitialTab() {
  pendingInitialTab = null;
}

/**
 * セクション切り替え中かどうか
 */
export function isSectionSwitching() {
  return isSwitchingSection;
}

/**
 * セクション切り替え開始
 */
export function startSectionSwitch() {
  isSwitchingSection = true;
}

/**
 * セクション切り替え終了
 */
export function endSectionSwitch() {
  isSwitchingSection = false;
}

/**
 * 新しいAbortControllerを取得（前のをキャンセル）
 */
export function getNewAbortController() {
  if (currentAbortController) {
    currentAbortController.abort();
  }
  currentAbortController = new AbortController();
  return currentAbortController;
}

/**
 * 現在のAbortControllerをクリア
 */
export function clearAbortController() {
  currentAbortController = null;
}

export default {
  navigationHistory,
  currentCompany,
  currentSubsection,
  editingCompanyDomain,
  pendingJobId,
  pendingInitialTab,
  setCurrentCompany,
  clearCurrentCompany,
  pushHistory,
  popHistory,
  clearHistory,
  setCurrentSubsection,
  getCurrentSubsection,
  setEditingCompanyDomain,
  getEditingCompanyDomain,
  clearEditingCompanyDomain,
  setPendingJobId,
  getPendingJobId,
  clearPendingJobId,
  setPendingInitialTab,
  getPendingInitialTab,
  clearPendingInitialTab,
  isSectionSwitching,
  startSectionSwitch,
  endSectionSwitch,
  getNewAbortController,
  clearAbortController
};
