/**
 * Admin Dashboard - CSV ユーティリティ
 */

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
    'manageSheetUrl': 'manageSheetUrl'
  };
  const cleanHeader = header.replace(/"/g, '').trim();
  return mapping[cleanHeader] || cleanHeader;
}
