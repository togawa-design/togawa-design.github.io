/**
 * 求人フィード生成機能
 * - Indeed XML フィード
 * - Google しごと検索 JSON-LD
 * - 求人ボックス/スタンバイ用 XML
 */

import * as JobsLoader from '../../shared/jobs-loader.js';

// サイト設定
const SITE_CONFIG = {
  siteName: 'L-SET',
  siteUrl: 'https://rikueko.com',
  publisherName: 'L-SET',
  publisherUrl: 'https://rikueko.com'
};

/**
 * XMLエスケープ
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * HTMLタグを除去
 */
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * 勤務地から都道府県と市区町村を抽出
 */
function parseLocation(location) {
  if (!location) return { prefecture: '', city: '', country: 'JP' };

  const prefMatch = location.match(/^(.+?[都道府県])/);
  const prefecture = prefMatch ? prefMatch[1] : '';

  const cityMatch = location.match(/[都道府県](.+?[市区町村])/);
  const city = cityMatch ? cityMatch[1] : location.replace(prefecture, '').trim();

  return {
    prefecture,
    city,
    country: 'JP'
  };
}

/**
 * 給与文字列をパース
 */
function parseSalary(salaryStr) {
  if (!salaryStr) return { min: null, max: null, currency: 'JPY', period: 'MONTH' };

  // 数値の場合は文字列に変換
  const str = String(salaryStr);
  let amount = 0;

  // 「万」単位
  const manMatch = str.match(/(\d+(?:\.\d+)?)\s*万/);
  if (manMatch) {
    amount = parseFloat(manMatch[1]) * 10000;
  } else {
    // 数値を抽出
    const numMatch = str.match(/(\d{1,3}(?:,\d{3})*|\d+)/);
    if (numMatch) {
      amount = parseInt(numMatch[1].replace(/,/g, ''));
    }
  }

  return {
    min: amount,
    max: amount,
    currency: 'JPY',
    period: 'MONTH'
  };
}

/**
 * 雇用形態をGoogle JobPosting形式に変換
 */
function mapEmploymentType(type) {
  if (!type) return 'FULL_TIME';

  const mapping = {
    '正社員': 'FULL_TIME',
    'フルタイム': 'FULL_TIME',
    'パート': 'PART_TIME',
    'パートタイム': 'PART_TIME',
    'アルバイト': 'PART_TIME',
    '契約社員': 'CONTRACTOR',
    '契約': 'CONTRACTOR',
    '派遣': 'TEMPORARY',
    '派遣社員': 'TEMPORARY',
    'インターン': 'INTERN',
    '期間工': 'CONTRACTOR',
    '期間従業員': 'CONTRACTOR'
  };

  return mapping[type] || 'FULL_TIME';
}

/**
 * 求人URLを生成
 */
function getJobUrl(job) {
  if (job.companyDomain && job.id) {
    return `${SITE_CONFIG.siteUrl}/job-detail.html?company=${encodeURIComponent(job.companyDomain)}&job=${encodeURIComponent(job.id)}`;
  }
  if (job.companyDomain) {
    return `${SITE_CONFIG.siteUrl}/lp.html?company=${encodeURIComponent(job.companyDomain)}`;
  }
  return SITE_CONFIG.siteUrl;
}

/**
 * Indeed XMLフィードを生成
 */
export function generateIndeedXml(jobs) {
  const now = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>${escapeXml(SITE_CONFIG.publisherName)}</publisher>
  <publisherurl>${escapeXml(SITE_CONFIG.publisherUrl)}</publisherurl>
  <lastBuildDate>${now}</lastBuildDate>
`;

  jobs.forEach(job => {
    if (!job.title) return;

    const location = parseLocation(job.location || job.companyAddress);
    const salary = parseSalary(job.monthlySalary);
    const jobUrl = getJobUrl(job);
    const description = stripHtml(job.jobDescription || job.description || '');

    xml += `
  <job>
    <title><![CDATA[${job.title}]]></title>
    <date>${job.publishStartDate || new Date().toISOString().split('T')[0]}</date>
    <referencenumber>${escapeXml(job.id || '')}</referencenumber>
    <url><![CDATA[${jobUrl}]]></url>
    <company><![CDATA[${job.company || ''}]]></company>
    <city><![CDATA[${location.city}]]></city>
    <state><![CDATA[${location.prefecture}]]></state>
    <country>${location.country}</country>
    <postalcode></postalcode>
    <description><![CDATA[${description}]]></description>
    <salary><![CDATA[${job.monthlySalary || ''}]]></salary>
    <jobtype>${mapEmploymentType(job.employmentType)}</jobtype>
    <category><![CDATA[${job.jobType || 'その他'}]]></category>
    <experience><![CDATA[${job.requirements || '未経験歓迎'}]]></experience>
  </job>`;
  });

  xml += `
</source>`;

  return xml;
}

/**
 * Google しごと検索 JSON-LD を生成
 */
export function generateGoogleJobsJsonLd(jobs) {
  const jsonLdItems = jobs.map(job => {
    if (!job.title) return null;

    const location = parseLocation(job.location || job.companyAddress);
    const salary = parseSalary(job.monthlySalary);
    const jobUrl = getJobUrl(job);
    const description = stripHtml(job.jobDescription || job.description || job.title);

    const jsonLd = {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      'title': job.title,
      'description': description,
      'identifier': {
        '@type': 'PropertyValue',
        'name': job.company || SITE_CONFIG.siteName,
        'value': job.id || ''
      },
      'datePosted': job.publishStartDate || new Date().toISOString().split('T')[0],
      'hiringOrganization': {
        '@type': 'Organization',
        'name': job.company || '',
        'sameAs': jobUrl
      },
      'jobLocation': {
        '@type': 'Place',
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': location.city,
          'addressRegion': location.prefecture,
          'addressCountry': location.country
        }
      },
      'employmentType': mapEmploymentType(job.employmentType)
    };

    // 給与情報
    if (salary.min) {
      jsonLd.baseSalary = {
        '@type': 'MonetaryAmount',
        'currency': salary.currency,
        'value': {
          '@type': 'QuantitativeValue',
          'value': salary.min,
          'unitText': salary.period
        }
      };
    }

    // 掲載終了日
    if (job.publishEndDate) {
      jsonLd.validThrough = job.publishEndDate;
    }

    return jsonLd;
  }).filter(Boolean);

  return JSON.stringify(jsonLdItems, null, 2);
}

/**
 * 求人ボックス/スタンバイ用 XMLフィードを生成
 */
export function generateJobBoxXml(jobs) {
  const now = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<jobs xmlns="http://www.jobbox.com/schema/jobs">
  <publisher>${escapeXml(SITE_CONFIG.publisherName)}</publisher>
  <publisherUrl>${escapeXml(SITE_CONFIG.publisherUrl)}</publisherUrl>
  <lastUpdate>${now}</lastUpdate>
`;

  jobs.forEach(job => {
    if (!job.title) return;

    const location = parseLocation(job.location || job.companyAddress);
    const salary = parseSalary(job.monthlySalary);
    const jobUrl = getJobUrl(job);
    const description = stripHtml(job.jobDescription || job.description || '');

    xml += `
  <job>
    <id>${escapeXml(job.id || '')}</id>
    <title><![CDATA[${job.title}]]></title>
    <company><![CDATA[${job.company || ''}]]></company>
    <url><![CDATA[${jobUrl}]]></url>
    <location>
      <prefecture>${escapeXml(location.prefecture)}</prefecture>
      <city>${escapeXml(location.city)}</city>
      <country>${location.country}</country>
    </location>
    <description><![CDATA[${description}]]></description>
    <salary>
      <type>monthly</type>
      <min>${salary.min || ''}</min>
      <max>${salary.max || ''}</max>
      <currency>${salary.currency}</currency>
      <text><![CDATA[${job.monthlySalary || ''}]]></text>
    </salary>
    <employmentType>${escapeXml(job.employmentType || '正社員')}</employmentType>
    <requirements><![CDATA[${job.requirements || ''}]]></requirements>
    <benefits><![CDATA[${job.benefits || ''}]]></benefits>
    <workingHours><![CDATA[${job.workingHours || ''}]]></workingHours>
    <holidays><![CDATA[${job.holidays || ''}]]></holidays>
    <datePosted>${job.publishStartDate || new Date().toISOString().split('T')[0]}</datePosted>
    <validThrough>${job.publishEndDate || ''}</validThrough>
  </job>`;
  });

  xml += `
</jobs>`;

  return xml;
}

/**
 * CSVフィードを生成
 */
export function generateCsv(jobs) {
  const headers = [
    'id',
    'タイトル',
    '会社名',
    '勤務地',
    '都道府県',
    '市区町村',
    '月収',
    '特典総額',
    '雇用形態',
    '仕事内容',
    '応募資格',
    '待遇',
    '勤務時間',
    '休日',
    '掲載開始日',
    '掲載終了日',
    'URL'
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str}"`;
    }
    return str;
  };

  let csv = headers.join(',') + '\n';

  jobs.forEach(job => {
    const location = parseLocation(job.location || job.companyAddress);
    const jobUrl = getJobUrl(job);

    const row = [
      job.id || '',
      job.title || '',
      job.company || '',
      job.location || job.companyAddress || '',
      location.prefecture,
      location.city,
      job.monthlySalary || '',
      job.totalBonus || '',
      job.employmentType || '',
      stripHtml(job.jobDescription || ''),
      job.requirements || '',
      job.benefits || '',
      job.workingHours || '',
      job.holidays || '',
      job.publishStartDate || '',
      job.publishEndDate || '',
      jobUrl
    ];

    csv += row.map(escapeCSV).join(',') + '\n';
  });

  return csv;
}

/**
 * 全求人データを取得してフィードを生成
 */
export async function generateAllFeeds() {
  try {
    // 会社一覧を取得
    const companies = await JobsLoader.fetchCompanies();
    if (!companies) {
      throw new Error('会社一覧の取得に失敗しました');
    }

    // 全求人を収集
    const allJobs = [];

    for (const company of companies) {
      if (!JobsLoader.isCompanyVisible(company)) continue;

      const jobs = await JobsLoader.fetchCompanyJobs(company.jobsSheet);
      if (jobs) {
        jobs.forEach(job => {
          // 公開中の求人のみ
          if (job.visible === 'false' || job.visible === 'FALSE') return;
          if (!JobsLoader.isJobInPublishPeriod(job)) return;

          // 会社情報を追加
          job.company = company.company;
          job.companyDomain = company.companyDomain;
          job.companyAddress = job.location || company.companyAddress || '';

          allJobs.push(job);
        });
      }
    }

    console.log(`[JobFeedGenerator] ${allJobs.length}件の求人を取得しました`);

    return {
      jobs: allJobs,
      indeedXml: generateIndeedXml(allJobs),
      googleJsonLd: generateGoogleJobsJsonLd(allJobs),
      jobBoxXml: generateJobBoxXml(allJobs),
      csv: generateCsv(allJobs)
    };
  } catch (error) {
    console.error('[JobFeedGenerator] フィード生成エラー:', error);
    throw error;
  }
}

/**
 * ファイルをダウンロード
 */
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Indeed XMLをダウンロード
 */
export async function downloadIndeedXml() {
  const feeds = await generateAllFeeds();
  downloadFile(feeds.indeedXml, 'indeed-feed.xml', 'application/xml');
}

/**
 * Google JSON-LDをダウンロード
 */
export async function downloadGoogleJsonLd() {
  const feeds = await generateAllFeeds();
  downloadFile(feeds.googleJsonLd, 'google-jobs.json', 'application/json');
}

/**
 * 求人ボックスXMLをダウンロード
 */
export async function downloadJobBoxXml() {
  const feeds = await generateAllFeeds();
  downloadFile(feeds.jobBoxXml, 'jobbox-feed.xml', 'application/xml');
}

/**
 * CSVをダウンロード
 */
export async function downloadCsv() {
  const feeds = await generateAllFeeds();
  downloadFile(feeds.csv, 'jobs-feed.csv', 'text/csv;charset=utf-8');
}

export default {
  generateIndeedXml,
  generateGoogleJobsJsonLd,
  generateJobBoxXml,
  generateCsv,
  generateAllFeeds,
  downloadFile,
  downloadIndeedXml,
  downloadGoogleJsonLd,
  downloadJobBoxXml,
  downloadCsv
};
