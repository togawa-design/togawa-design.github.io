/**
 * Admin Dashboard - CSV ユーティリティ
 */

// 共通のCSVパーサーをインポート
export { parseCSVLine } from '@shared/jobs-loader.js';

// 会社データ用ヘッダー名を正規化
export function normalizeHeader(header) {
  const mapping = {
    '会社名': 'company',
    'company': 'company',
    '会社ドメイン': 'companyDomain',
    'companyDomain': 'companyDomain',
    'company_domain': 'companyDomain',
    'デザインパターン': 'designPattern',
    'designPattern': 'designPattern',
    'design_pattern': 'designPattern',
    '表示する': 'showCompany',
    'showCompany': 'showCompany',
    'visible': 'showCompany',
    '画像URL': 'imageUrl',
    'imageUrl': 'imageUrl',
    'image_url': 'imageUrl',
    '説明': 'description',
    'description': 'description',
    '並び順': 'order',
    'order': 'order',
    '管理シート': 'manageSheetUrl',
    '管理シートURL': 'manageSheetUrl',
    'manageSheetUrl': 'manageSheetUrl',
    '求人シート': 'jobsSheet',
    '求人管理シート': 'jobsSheet',
    '求人一覧シート': 'jobsSheet',
    'jobs_sheet': 'jobsSheet',
    'jobsSheet': 'jobsSheet'
  };
  const cleanHeader = header.replace(/"/g, '').trim();
  return mapping[cleanHeader] || cleanHeader;
}
