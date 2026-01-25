/**
 * Google Sheets連携 - 求人データローダー (ES Module版)
 */

// Google SheetのID
export const SHEET_ID = '1NVIDV3OiXbNrVI7EFdRrU2Ggn8dx7Q0rSnvJ6uaWvX0';
export const SHEET_NAME = '会社一覧';
export const STATS_SHEET_NAME = 'Stats';
export const DEFAULT_IMAGE = 'images/default-job.svg';

// CSVを取得するURL
export const getCsvUrl = () =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}`;

export const getStatsUrl = () =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${STATS_SHEET_NAME}`;

export const getSheetUrl = (sheetName) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

// CSVの1行をパース
export function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// ヘッダー名を正規化
export function normalizeHeader(header) {
  const mapping = {
    'id': 'id', 'ID': 'id',
    '会社名': 'company', 'company': 'company',
    'タイトル': 'title', 'title': 'title',
    '勤務地': 'location', 'location': 'companyAddress',
    '特典総額': 'totalBonus', 'totalBonus': 'totalBonus',
    '月収例': 'monthlySalary', 'monthlySalary': 'monthlySalary',
    '特徴': 'features', 'features': 'features',
    'バッジ': 'badges', 'badges': 'badges',
    '画像URL': 'imageUrl', 'imageUrl': 'imageUrl',
    '詳細URL': 'detailUrl', 'detailUrl': 'detailUrl',
    '表示': 'visible', 'visible': 'visible',
    '表示する': 'showCompany',
    '並び順': 'order', 'order': 'order',
    '会社ドメイン': 'companyDomain', 'companyDomain': 'companyDomain', 'company_domain': 'companyDomain',
    '会社住所': 'companyAddress', 'companyAddress': 'companyAddress',
    '説明': 'description', 'description': 'description',
    'お仕事内容': 'jobContent', 'jobContent': 'jobContent',
    '仕事内容': 'jobDescription', 'jobDescription': 'jobDescription',
    '応募資格': 'requirements', 'requirements': 'requirements',
    '待遇': 'benefits', 'benefits': 'benefits',
    '勤務時間': 'workingHours', 'workingHours': 'workingHours',
    '休日': 'holidays', 'holidays': 'holidays',
    'デザインパターン': 'designPattern', 'designPattern': 'designPattern', 'design_pattern': 'designPattern',
    'パターン': 'designPattern', 'pattern': 'designPattern',
    '管理シート': 'jobsSheet', 'jobsSheet': 'jobsSheet', 'jobs_sheet': 'jobsSheet',
    '掲載開始日': 'publishStartDate', 'publishStartDate': 'publishStartDate', 'publish_start_date': 'publishStartDate',
    '掲載終了日': 'publishEndDate', 'publishEndDate': 'publishEndDate', 'publish_end_date': 'publishEndDate',
    '職種名': 'jobType', 'jobType': 'jobType', 'job_type': 'jobType',
    '給与': 'salary', 'salary': 'salary',
    '雇用形態': 'employmentType', 'employmentType': 'employmentType', 'employment_type': 'employmentType',
    '資格・スキル': 'skills', 'skills': 'skills', '資格': 'skills', 'スキル': 'skills'
  };

  const cleanHeader = header.replace(/"/g, '').trim();
  if (mapping[cleanHeader]) return mapping[cleanHeader];

  const parts = cleanHeader.split(/\s+/);
  if (parts.length > 1 && mapping[parts[0]]) return mapping[parts[0]];

  return parts[0] || cleanHeader;
}

// CSVをパース
export function parseCSV(csvText, headerRow = 0, dataStartRow = 1) {
  const lines = csvText.split('\n');
  const headers = parseCSVLine(lines[headerRow] || '');
  const items = [];

  for (let i = dataStartRow; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = parseCSVLine(lines[i]);
    const item = {};

    headers.forEach((header, index) => {
      const key = normalizeHeader(header);
      item[key] = values[index] || '';
    });

    if (item.features) {
      item.features = item.features.split(',').map(f => f.trim()).filter(f => f);
    }

    items.push(item);
  }

  return items;
}

// スプレッドシートIDを抽出
export function extractSpreadsheetId(input) {
  const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9_-]+$/.test(input)) return input;
  return null;
}

// 会社一覧データを取得
export async function fetchCompanies() {
  try {
    const response = await fetch(getCsvUrl());
    if (!response.ok) throw new Error('会社一覧の取得に失敗しました');
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error('会社一覧の取得エラー:', error);
    return null;
  }
}

// 会社の求人データを取得
export async function fetchCompanyJobs(jobsSheetIdOrUrl) {
  if (!jobsSheetIdOrUrl) return null;
  try {
    const sheetId = extractSpreadsheetId(jobsSheetIdOrUrl.trim());
    if (!sheetId) return null;

    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error('求人データの取得に失敗しました');
    const csvText = await response.text();
    return parseCSV(csvText, 0, 2);
  } catch (error) {
    console.error('求人データの取得エラー:', error);
    return null;
  }
}

// 会社が表示対象か判定
export function isCompanyVisible(company) {
  if (!company.jobsSheet || !company.jobsSheet.trim()) return false;
  if (company.showCompany !== '○' && company.showCompany !== '◯') return false;
  return true;
}

// 日付文字列をDateオブジェクトに変換
export function parseDate(dateStr) {
  if (!dateStr) return null;
  const normalized = dateStr.trim().replace(/\//g, '-');
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

// 求人が掲載期間内か判定
export function isJobInPublishPeriod(job) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (job.publishStartDate && job.publishStartDate.trim()) {
    const startDate = parseDate(job.publishStartDate);
    if (startDate && today < startDate) return false;
  }

  if (job.publishEndDate && job.publishEndDate.trim()) {
    const endDate = parseDate(job.publishEndDate);
    if (endDate && today > endDate) return false;
  }

  return true;
}

// 詳細URLを取得
export function getDetailUrl(job) {
  if (job.companyDomain && job.companyDomain.trim()) {
    return `company.html?id=${encodeURIComponent(job.companyDomain.trim())}`;
  }
  return job.detailUrl || '#';
}

// 月収例から最高額を取得
export function getMaxMonthlySalary(jobs) {
  let maxSalary = 0;
  let maxSalaryStr = '';

  jobs.forEach(job => {
    if (!job.monthlySalary) return;

    const salaryStr = job.monthlySalary;
    let salary = 0;

    const manMatch = salaryStr.match(/(\d+(?:\.\d+)?)\s*万/);
    if (manMatch) {
      salary = parseFloat(manMatch[1]) * 10000;
    } else {
      const yenMatch = salaryStr.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
      if (yenMatch) {
        salary = parseInt(yenMatch[1].replace(/,/g, ''));
      } else {
        const yenSymbolMatch = salaryStr.match(/[¥￥]\s*(\d{1,3}(?:,\d{3})*|\d+)/);
        if (yenSymbolMatch) {
          salary = parseInt(yenSymbolMatch[1].replace(/,/g, ''));
        } else {
          const numMatch = salaryStr.match(/(\d{1,3}(?:,\d{3})*|\d+)/);
          if (numMatch) {
            salary = parseInt(numMatch[1].replace(/,/g, ''));
          }
        }
      }
    }

    if (salary > maxSalary) {
      maxSalary = salary;
      maxSalaryStr = salaryStr;
    }
  });

  return maxSalaryStr;
}

// すべての会社の求人データを取得
export async function fetchAllJobs() {
  const companies = await fetchCompanies();
  if (!companies) return [];

  const allJobs = [];

  for (const company of companies) {
    if (!isCompanyVisible(company)) continue;

    const jobs = await fetchCompanyJobs(company.jobsSheet);
    if (jobs) {
      jobs.forEach(job => {
        job.company = company.company;
        job.companyDomain = company.companyDomain;
        allJobs.push(job);
      });
    }
  }

  return allJobs;
}

// すべての勤務地を取得
export async function getLocationList() {
  const allJobs = await fetchAllJobs();
  const locationMap = {};

  allJobs.forEach(job => {
    // companyAddressまたはlocationフィールドを参照
    const locationValue = job.companyAddress || job.location;
    if (!locationValue) return;

    const prefMatch = locationValue.match(/^(.+?[都道府県])/);
    const prefecture = prefMatch ? prefMatch[1] : locationValue;

    if (!locationMap[prefecture]) {
      locationMap[prefecture] = { prefecture, jobs: [], count: 0 };
    }
    locationMap[prefecture].jobs.push(job);
    locationMap[prefecture].count++;
  });

  return Object.values(locationMap).sort((a, b) => b.count - a.count);
}

// 勤務地で求人をフィルタリング
export async function getJobsByLocation(prefecture) {
  const allJobs = await fetchAllJobs();
  return allJobs.filter(job => {
    const locationValue = job.companyAddress || job.location;
    return locationValue && locationValue.includes(prefecture);
  });
}

// 実績データを取得
export async function fetchStats() {
  try {
    const response = await fetch(getStatsUrl());
    if (!response.ok) throw new Error('実績データの取得に失敗しました');
    const csvText = await response.text();
    return parseStatsCSV(csvText);
  } catch (error) {
    console.error('実績データの取得エラー:', error);
    return null;
  }
}

// 実績CSVをパース
function parseStatsCSV(csvText) {
  const lines = csvText.split('\n');
  const stats = {};

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = parseCSVLine(lines[i]);
    const key = values[0] ? values[0].replace(/"/g, '').trim() : '';
    const value = values[1] ? values[1].replace(/"/g, '').trim() : '';
    const label = values[2] ? values[2].replace(/"/g, '').trim() : '';

    if (key) {
      stats[key] = { value, label };
    }
  }

  return stats;
}

// デザインパターンのCSSクラスを取得
export function getDesignPatternClass(pattern) {
  const validPatterns = ['modern', 'classic', 'minimal', 'colorful'];
  const normalizedPattern = pattern ? pattern.toLowerCase().trim() : '';
  if (validPatterns.includes(normalizedPattern)) {
    return `pattern-${normalizedPattern}`;
  }
  return '';
}

// JobsLoaderオブジェクト（後方互換用）
const JobsLoader = {
  SHEET_ID,
  SHEET_NAME,
  STATS_SHEET_NAME,
  DEFAULT_IMAGE,
  get csvUrl() { return getCsvUrl(); },
  get statsUrl() { return getStatsUrl(); },
  getSheetUrl,
  parseCSVLine,
  normalizeHeader,
  parseCSV,
  extractSpreadsheetId,
  fetchCompanies,
  fetchCompanyJobs,
  fetchJobs: fetchCompanies, // 後方互換
  isCompanyVisible,
  parseDate,
  isJobInPublishPeriod,
  getDetailUrl,
  getMaxMonthlySalary,
  fetchAllJobs,
  getLocationList,
  getJobsByLocation,
  fetchStats,
  getDesignPatternClass,
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
  sanitizeHtml(html) {
    if (!html || html === '<br>' || html === '<div><br></div>') return '';
    const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'div', 'p'];
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
      if (!allowedTags.includes(el.tagName.toLowerCase())) {
        el.replaceWith(...el.childNodes);
      } else {
        while (el.attributes.length > 0) {
          el.removeAttribute(el.attributes[0].name);
        }
      }
    });
    return temp.innerHTML;
  }
};

export default JobsLoader;

// グローバルにエクスポート（後方互換）
if (typeof window !== 'undefined') {
  window.JobsLoader = JobsLoader;
}
