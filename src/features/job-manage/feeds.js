/**
 * 求人管理 - フィード生成モジュール
 */
import {
  generateIndeedXml,
  generateGoogleJobsJsonLd,
  generateJobBoxXml,
  generateCsv,
  downloadFile
} from '@features/admin/job-feed-generator.js';
import {
  companyDomain,
  companyName,
  jobsCache
} from './state.js';

/**
 * フィード生成用の求人データを準備
 */
export function prepareJobsForFeed() {
  return jobsCache.filter(job => {
    const isVisible = job.visible === 'true' || job.visible === 'TRUE' || job.visible === true;
    return isVisible && job.title;
  }).map(job => ({
    ...job,
    company: companyName,
    companyDomain: companyDomain,
    companyAddress: job.location || ''
  }));
}

/**
 * ローディング表示
 */
export function showFeedLoading() {
  const feedStatus = document.getElementById('feed-status');
  if (feedStatus) feedStatus.style.display = 'flex';
}

export function hideFeedLoading() {
  const feedStatus = document.getElementById('feed-status');
  if (feedStatus) feedStatus.style.display = 'none';
}

/**
 * Indeed XMLをダウンロード
 */
export async function downloadIndeed() {
  const jobs = prepareJobsForFeed();
  if (jobs.length === 0) {
    alert('ダウンロードできる求人がありません');
    return;
  }

  try {
    showFeedLoading();
    const xml = generateIndeedXml(jobs);
    downloadFile(xml, `indeed-${companyDomain}.xml`, 'application/xml');
  } catch (error) {
    alert('フィード生成に失敗しました: ' + error.message);
  } finally {
    hideFeedLoading();
  }
}

/**
 * Google JSON-LDをダウンロード
 */
export async function downloadGoogle() {
  const jobs = prepareJobsForFeed();
  if (jobs.length === 0) {
    alert('ダウンロードできる求人がありません');
    return;
  }

  try {
    showFeedLoading();
    const jsonLd = generateGoogleJobsJsonLd(jobs);
    downloadFile(jsonLd, `google-jobs-${companyDomain}.json`, 'application/json');
  } catch (error) {
    alert('フィード生成に失敗しました: ' + error.message);
  } finally {
    hideFeedLoading();
  }
}

/**
 * 求人ボックスXMLをダウンロード
 */
export async function downloadJobbox() {
  const jobs = prepareJobsForFeed();
  if (jobs.length === 0) {
    alert('ダウンロードできる求人がありません');
    return;
  }

  try {
    showFeedLoading();
    const xml = generateJobBoxXml(jobs);
    downloadFile(xml, `jobbox-${companyDomain}.xml`, 'application/xml');
  } catch (error) {
    alert('フィード生成に失敗しました: ' + error.message);
  } finally {
    hideFeedLoading();
  }
}

/**
 * CSVをダウンロード
 */
export async function downloadCsvFeed() {
  const jobs = prepareJobsForFeed();
  if (jobs.length === 0) {
    alert('ダウンロードできる求人がありません');
    return;
  }

  try {
    showFeedLoading();
    const csv = generateCsv(jobs);
    downloadFile(csv, `jobs-${companyDomain}.csv`, 'text/csv;charset=utf-8');
  } catch (error) {
    alert('フィード生成に失敗しました: ' + error.message);
  } finally {
    hideFeedLoading();
  }
}
