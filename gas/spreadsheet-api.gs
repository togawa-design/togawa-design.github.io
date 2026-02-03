/**
 * リクエコ求人ナビ - スプレッドシートAPI 統合版
 *
 * 仕様：
 * - A列: ID (行番号-1) ※自動採番
 * - B列: 会社名
 * - C列: 説明 (HTML対応)
 * - D列: お仕事内容 (HTML対応)
 * - E列: 勤務時間 (HTML対応)
 * - F列: 会社住所 (既存の「勤務地」列も会社住所として扱う)
 * - G列: デザインパターン
 * - H列: 画像URL
 * - I列: 並び順
 * - J列: 表示する
 * - K列: 勤務地 (HTML対応) - 実際に働く場所
 * - M列: 会社ドメイン (company_domain)
 * - O列: 管理シートURL (自動作成)
 *
 * ※HTML対応フィールドは<b>、<i>、<u>、<ul>、<ol>、<li>タグを許可
 */

const SPREADSHEET_ID = "1NVIDV3OiXbNrVI7EFdRrU2Ggn8dx7Q0rSnvJ6uaWvX0";
const COMPANY_SHEET_NAME = "会社一覧";
const LP_SETTINGS_SHEET_NAME = "LP設定";

// --- API エントリポイント (doGet/doPost) ---

function doGet(e) {
  const action = e.parameter.action;
  let result;
  try {
    if (action === "post" && e.parameter.data) {
      const decodedData = Utilities.newBlob(
        Utilities.base64Decode(e.parameter.data),
      ).getDataAsString("UTF-8");
      const data = JSON.parse(decodedData);
      result = handlePostAction(data);
    } else {
      switch (action) {
        case "getCompanies":
          result = getCompanies();
          break;
        case "getCompany":
          result = getCompany(e.parameter.domain);
          break;
        case "getLPSettings":
          result = getLPSettings(e.parameter.domain);
          break;
        case "getJobs":
          result = getJobs(e.parameter.domain);
          break;
        case "getJobStats":
          result = getJobStats();
          break;
        case "getRecruitSettings":
          result = getRecruitSettings(e.parameter.companyDomain);
          break;
        default:
          result = { error: "Unknown action" };
      }
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function doPost(e) {
  const output = ContentService.createTextOutput().setMimeType(
    ContentService.MimeType.JSON,
  );
  try {
    const data = JSON.parse(e.postData.contents);
    const result = handlePostAction(data);
    output.setContent(JSON.stringify(result));
  } catch (error) {
    output.setContent(JSON.stringify({ success: false, error: error.message }));
  }
  return output;
}

function handlePostAction(data) {
  switch (data.action) {
    case "saveCompany":
      return saveCompany(data.company);
    case "saveLPSettings":
      return saveLPSettings(data.settings);
    case "deleteCompany":
      return deleteCompany(data.domain);
    case "getJobs":
      return getJobs(data.companyDomain);
    case "saveJob":
      return saveJob(data.companyDomain, data.job, data.rowIndex);
    case "deleteJob":
      return deleteJob(data.companyDomain, data.rowIndex);
    case "updateRecruitSettings":
      return updateRecruitSettings(data.settings || JSON.parse(data.data || "{}"));
    default:
      return { success: false, error: "Unknown action" };
  }
}

// --- 会社情報操作ロジック ---

function saveCompany(companyData) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(COMPANY_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(COMPANY_SHEET_NAME);
    const headers = [
      "ID", // A列 (1)
      "会社名", // B列 (2)
      "説明", // C列 (3) - HTML対応
      "お仕事内容", // D列 (4) - HTML対応
      "勤務時間", // E列 (5) - HTML対応
      "会社住所", // F列 (6)
      "デザインパターン", // G列 (7)
      "画像URL", // H列 (8)
      "並び順", // I列 (9)
      "表示する", // J列 (10)
      "",
      "", // K, L列 (予備)
      "company_domain", // M列 (13)
      "", // N列 (予備)
      "管理シートURL", // O列 (15)
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // 列番号マッピング（ヘッダーから動的に取得）
  const COL = {
    ID: getColIndex(headers, ["ID", "id"]) + 1,
    NAME: getColIndex(headers, ["会社名", "company"]) + 1,
    DESC: getColIndex(headers, ["説明", "description"]) + 1,
    JOB_CONTENT:
      getColIndex(headers, [
        "お仕事内容",
        "仕事内容",
        "jobContent",
        "jobDescription",
      ]) + 1,
    WORKING_HOURS: getColIndex(headers, ["勤務時間", "workingHours"]) + 1,
    COMPANY_ADDRESS: getColIndex(headers, ["会社住所", "companyAddress"]) + 1,
    WORK_LOCATION: getColIndex(headers, ["勤務地", "workLocation"]) + 1,
    DESIGN: getColIndex(headers, ["デザインパターン", "designPattern"]) + 1,
    IMAGE: getColIndex(headers, ["画像URL", "imageUrl"]) + 1,
    ORDER: getColIndex(headers, ["並び順", "order"]) + 1,
    VISIBLE: getColIndex(headers, ["表示する", "showCompany", "visible"]) + 1,
    DOMAIN:
      getColIndex(headers, [
        "company_domain",
        "companyDomain",
        "会社ドメイン",
      ]) + 1,
    SHEET_URL: getColIndex(headers, ["管理シートURL", "manageSheetUrl"]) + 1,
  };

  // ドメインで既存行を検索
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL.DOMAIN - 1] === companyData.companyDomain) {
      rowIndex = i + 1;
      break;
    }
  }

  let finalRow;
  if (rowIndex > 0) {
    // 既存行を更新
    finalRow = rowIndex;
  } else {
    // 新規行を追加
    finalRow = sheet.getLastRow() + 1;
    if (COL.ID > 0) sheet.getRange(finalRow, COL.ID).setValue(finalRow - 1);
    if (COL.DOMAIN > 0)
      sheet
        .getRange(finalRow, COL.DOMAIN)
        .setValue(companyData.companyDomain || "");
  }

  // 各フィールドを更新（列が存在する場合のみ）
  if (COL.NAME > 0)
    sheet.getRange(finalRow, COL.NAME).setValue(companyData.company || "");
  if (COL.DESC > 0)
    sheet
      .getRange(finalRow, COL.DESC)
      .setValue(sanitizeHtml(companyData.description || ""));
  if (COL.JOB_CONTENT > 0)
    sheet
      .getRange(finalRow, COL.JOB_CONTENT)
      .setValue(
        sanitizeHtml(
          companyData.jobDescription || companyData.jobContent || "",
        ),
      );
  if (COL.WORKING_HOURS > 0)
    sheet
      .getRange(finalRow, COL.WORKING_HOURS)
      .setValue(sanitizeHtml(companyData.workingHours || ""));
  if (COL.COMPANY_ADDRESS > 0)
    sheet
      .getRange(finalRow, COL.COMPANY_ADDRESS)
      .setValue(companyData.companyAddress || "");
  if (COL.WORK_LOCATION > 0)
    sheet
      .getRange(finalRow, COL.WORK_LOCATION)
      .setValue(sanitizeHtml(companyData.workLocation || ""));
  if (COL.DESIGN > 0)
    sheet
      .getRange(finalRow, COL.DESIGN)
      .setValue(companyData.designPattern || "standard");
  if (COL.IMAGE > 0)
    sheet.getRange(finalRow, COL.IMAGE).setValue(companyData.imageUrl || "");
  if (COL.ORDER > 0)
    sheet.getRange(finalRow, COL.ORDER).setValue(companyData.order || "");
  if (COL.VISIBLE > 0)
    sheet
      .getRange(finalRow, COL.VISIBLE)
      .setValue(companyData.showCompany || companyData.visible || "");

  // フォルダ・管理シート作成（管理シートURL列が空の場合のみ）
  const domain = companyData.companyDomain;
  if (COL.SHEET_URL > 0) {
    const currentUrl = sheet.getRange(finalRow, COL.SHEET_URL).getValue();
    if (domain && !currentUrl) {
      createCompanyAssets(domain, sheet, finalRow);
    }
  }

  return { success: true, id: finalRow - 1, rowIndex: finalRow };
}

// ヘッダー配列から列インデックスを取得（0ベース、見つからない場合は-1）
function getColIndex(headers, names) {
  for (const name of names) {
    const idx = headers.findIndex((h) => String(h).trim() === name);
    if (idx >= 0) return idx;
  }
  return -1;
}

// HTMLサニタイズ（許可タグのみ残す）
function sanitizeHtml(html) {
  if (!html) return "";

  // 許可するタグ
  const allowedTags = [
    "b",
    "strong",
    "i",
    "em",
    "u",
    "ul",
    "ol",
    "li",
    "br",
    "div",
    "p",
  ];

  // 許可されていないタグを削除（内容は残す）
  let sanitized = html;

  // script, styleタグは完全削除
  sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  sanitized = sanitized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // on*イベントハンドラを削除
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "");

  // javascript:リンクを削除
  sanitized = sanitized.replace(
    /href\s*=\s*["']javascript:[^"']*["']/gi,
    'href="#"',
  );

  // 許可されたタグ以外のタグを削除（開始タグと終了タグ）
  const tagPattern = /<\/?([a-z][a-z0-9]*)[^>]*>/gi;
  sanitized = sanitized.replace(tagPattern, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      // 許可タグの属性を全て削除
      if (match.startsWith("</")) {
        return `</${tagName.toLowerCase()}>`;
      }
      return `<${tagName.toLowerCase()}>`;
    }
    return ""; // 許可されていないタグは削除
  });

  return sanitized;
}

// --- 手動編集用トリガー ---

function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== COMPANY_SHEET_NAME) return;

  const row = range.getRow();
  if (row <= 1) return;

  // 1. IDの自動補完 (A列が空なら)
  const idCell = sheet.getRange(row, 1);
  if (idCell.getValue() === "") {
    idCell.setValue(row - 1);
  }

  // 2. M列(ドメイン)入力時の自動作成
  const col = range.getColumn();
  if (col === 13) {
    const domain = range.getValue();
    const urlCell = sheet.getRange(row, 15);
    if (domain && urlCell.getValue() === "") {
      createCompanyAssets(domain, sheet, row);
    }
  }
}

// --- 資産作成共通関数 ---

function createCompanyAssets(domainName, sheet, row) {
  try {
    const parentFolder = DriveApp.getFileById(sheet.getParent().getId())
      .getParents()
      .next();
    const existingFolders = parentFolder.getFoldersByName(domainName);
    if (existingFolders.hasNext()) return;

    const newFolder = parentFolder.createFolder(domainName);
    const fileName = domainName + "_管理シート";
    const newSs = SpreadsheetApp.create(fileName);
    const newFile = DriveApp.getFileById(newSs.getId());

    newFile.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW,
    );

    const targetSheet = newSs.getSheets()[0];
    const h1 = [
      [
        "id",
        "title",
        "location",
        "totalBonus",
        "monthlySalary",
        "jobType",
        "features",
        "badges",
        "jobDescription",
        "requirements",
        "benefits",
        "workingHours",
        "holidays",
        "visible",
        "order",
        "publishStartDate",
        "publishEndDate",
      ],
    ];
    const h2 = [
      [
        "管理ID",
        "募集タイトル",
        "勤務地",
        "賞与合計",
        "月収",
        "職種",
        "特徴",
        "バッジ",
        "仕事内容",
        "応募資格",
        "福利厚生",
        "勤務時間",
        "休日",
        "表示(true/false)",
        "表示順",
        "掲載開始日(YYYY/MM/DD)",
        "掲載終了日(YYYY/MM/DD)",
      ],
    ];

    targetSheet.getRange("A1:Q1").setValues(h1);
    targetSheet.getRange("A2:Q2").setValues(h2);
    targetSheet.getRange("A1:Q2").setFontWeight("bold");
    targetSheet.getRange("A1:Q1").setBackground("#d9d9d9");
    targetSheet.getRange("A2:Q2").setBackground("#f3f3f3");
    targetSheet.setFrozenRows(2);
    targetSheet.getRange("D3:E1000").setNumberFormat("¥#,##0");
    targetSheet.getRange("O3:P1000").setNumberFormat("yyyy/MM/dd");

    newFile.moveTo(newFolder);
    sheet.getRange(row, 15).setValue(newFile.getUrl());

    // ついでにB列の会社名が空ならドメイン名を入れておく
    const nameCell = sheet.getRange(row, 2);
    if (nameCell.getValue() === "") nameCell.setValue(domainName);
  } catch (err) {
    console.error(`Assets Error: ${err.message}`);
  }
}

// --- 会社情報取得 ---

function getCompanies() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(COMPANY_SHEET_NAME);
  if (!sheet) return { success: false, error: "シートが見つかりません" };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const companies = data
    .slice(1)
    .filter((r) => r[0] || r[1])
    .map((row) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[normalizeHeader(h)] = row[idx] || "";
      });
      return obj;
    });
  return { success: true, companies };
}

/**
 * 特定の会社情報を取得（高速版）
 */
function getCompany(domain) {
  if (!domain) {
    return { success: false, error: "domainが指定されていません" };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(COMPANY_SHEET_NAME);
  if (!sheet) return { success: false, error: "シートが見つかりません" };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // company_domain列のインデックスを取得
  const domainColIndex = headers.findIndex(h =>
    h === "company_domain" || h === "companyDomain" || h === "会社ドメイン"
  );

  if (domainColIndex < 0) {
    return { success: false, error: "ドメイン列が見つかりません" };
  }

  // 該当する会社を検索
  for (let i = 1; i < data.length; i++) {
    if (data[i][domainColIndex] === domain) {
      const company = {};
      headers.forEach((h, idx) => {
        company[normalizeHeader(h)] = data[i][idx] || "";
      });
      return { success: true, company };
    }
  }

  return { success: false, error: "会社が見つかりません" };
}

// --- 会社情報削除 ---

function deleteCompany(domain) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(COMPANY_SHEET_NAME);

  if (!sheet) {
    return { success: false, error: "シートが見つかりません" };
  }

  const data = sheet.getDataRange().getValues();
  const DOMAIN_COL = 13; // M列

  for (let i = 1; i < data.length; i++) {
    if (data[i][DOMAIN_COL - 1] === domain) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "会社情報を削除しました" };
    }
  }

  return { success: false, error: "該当する会社が見つかりません" };
}

// --- LP設定取得 ---

function getLPSettings(domain) {
  // domainはjobId形式（companyDomain_jobId）または companyDomain
  const parts = domain.split("_");
  const companyDomain = parts[0];
  const jobId = domain; // 元のdomainをjobIdとして使用

  try {
    // 会社の管理シートを開く
    const companySs = openCompanySheet(companyDomain);
    let sheet = companySs.getSheetByName(LP_SETTINGS_SHEET_NAME);

    if (!sheet) {
      return { success: true, settings: null };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // jobId列を優先的に検索（求人単位LP対応）
    const jobIdColIndex = headers.findIndex(
      (h) => h === "jobId" || h === "求人ID",
    );

    // jobId列が存在する場合、jobIdで検索
    if (jobIdColIndex >= 0) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][jobIdColIndex] === jobId) {
          const settings = {};
          headers.forEach((header, idx) => {
            settings[header] = data[i][idx] || "";
          });
          return { success: true, settings };
        }
      }
    }

    return { success: true, settings: null };
  } catch (error) {
    console.error("getLPSettings error:", error.message);
    return { success: false, error: error.message };
  }
}

// --- LP設定保存 ---

function saveLPSettings(settingsData) {
  // companyDomainを取得（jobIdから抽出または直接指定）
  let companyDomain = settingsData.companyDomain;
  if (!companyDomain && settingsData.jobId) {
    const parts = settingsData.jobId.split("_");
    companyDomain = parts[0];
  }

  if (!companyDomain) {
    return { success: false, error: "companyDomainが指定されていません" };
  }

  try {
    // 会社の管理シートを開く
    const companySs = openCompanySheet(companyDomain);
    let sheet = companySs.getSheetByName(LP_SETTINGS_SHEET_NAME);

    // シートが存在しない場合は作成
    if (!sheet) {
      sheet = companySs.insertSheet(LP_SETTINGS_SHEET_NAME);
      sheet.appendRow([
        "jobId", // 求人ID（求人単位LP対応）
        "companyDomain",
        "designPattern",
        "layoutStyle",
        "heroTitle",
        "heroSubtitle",
        "heroImage",
        "pointTitle1",
        "pointDesc1",
        "pointTitle2",
        "pointDesc2",
        "pointTitle3",
        "pointDesc3",
        "pointTitle4",
        "pointDesc4",
        "pointTitle5",
        "pointDesc5",
        "pointTitle6",
        "pointDesc6",
        "ctaText",
        "faq",
        "lpContent", // v2形式のLP構成データ（JSON）
        "sectionOrder",
        "sectionVisibility",
        "tiktokPixelId",
        "googleAdsId",
        "googleAdsLabel",
        "ogpTitle",
        "ogpDescription",
        "ogpImage",
        "showVideoButton",
        "videoUrl",
        "customPrimary",
        "customAccent",
        "customBg",
        "customText",
      ]);
      sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight("bold");
      sheet.getRange(1, 1, 1, sheet.getLastColumn()).setBackground("#f3f3f3");
      sheet.setFrozenRows(1);
    }

    // 既存シートに必要な列がなければ追加
    let existingHeaders = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    const requiredCols = [
      "jobId",
      "layoutStyle",
      "sectionOrder",
      "sectionVisibility",
      "pointTitle4",
      "pointDesc4",
      "pointTitle5",
      "pointDesc5",
      "pointTitle6",
      "pointDesc6",
      "ctaText",
      "faq",
      "lpContent",
      "tiktokPixelId",
      "googleAdsId",
      "googleAdsLabel",
      "ogpTitle",
      "ogpDescription",
      "ogpImage",
      "showVideoButton",
      "videoUrl",
      "customPrimary",
      "customAccent",
      "customBg",
      "customText",
    ];

    for (const col of requiredCols) {
      if (!existingHeaders.includes(col)) {
        const newCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, newCol).setValue(col);
        existingHeaders = sheet
          .getRange(1, 1, 1, sheet.getLastColumn())
          .getValues()[0];
      }
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // 既存行を検索 - jobIdで検索
    let rowIndex = -1;

    const jobIdColIndex = headers.findIndex(
      (h) => h === "jobId" || h === "求人ID",
    );

    // jobIdが提供されている場合、jobIdで検索
    if (settingsData.jobId && jobIdColIndex >= 0) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][jobIdColIndex] === settingsData.jobId) {
          rowIndex = i + 1;
          break;
        }
      }
    }

    // 行データを作成
    const rowData = headers.map((header) => {
      if (settingsData[header] !== undefined) {
        return settingsData[header];
      }
      // 日本語ヘッダーの場合の対応
      const mapping = {
        求人ID: "jobId",
        会社ドメイン: "companyDomain",
        デザインパターン: "designPattern",
        レイアウトスタイル: "layoutStyle",
        ヒーロータイトル: "heroTitle",
        ヒーローサブタイトル: "heroSubtitle",
        ヒーロー画像: "heroImage",
        ポイント1タイトル: "pointTitle1",
        ポイント1説明: "pointDesc1",
        ポイント2タイトル: "pointTitle2",
        ポイント2説明: "pointDesc2",
        ポイント3タイトル: "pointTitle3",
        ポイント3説明: "pointDesc3",
        ポイント4タイトル: "pointTitle4",
        ポイント4説明: "pointDesc4",
        ポイント5タイトル: "pointTitle5",
        ポイント5説明: "pointDesc5",
        ポイント6タイトル: "pointTitle6",
        ポイント6説明: "pointDesc6",
        CTAテキスト: "ctaText",
        FAQ: "faq",
        LP構成: "lpContent",
        セクション順序: "sectionOrder",
        セクション表示: "sectionVisibility",
        動画ボタン表示: "showVideoButton",
        動画URL: "videoUrl",
      };
      const key = mapping[header];
      return key ? settingsData[key] || "" : "";
    });

    if (rowIndex > 0) {
      // 既存行を更新
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      return { success: true, message: "LP設定を更新しました", isNew: false };
    } else {
      // 新規行を追加
      sheet.appendRow(rowData);
      return { success: true, message: "LP設定を登録しました", isNew: true };
    }
  } catch (error) {
    console.error("saveLPSettings error:", error.message);
    return { success: false, error: error.message };
  }
}

// --- ヘッダー正規化 ---

function normalizeHeader(header) {
  const mapping = {
    ID: "id",
    会社名: "company",
    company: "company",
    会社ドメイン: "companyDomain",
    companyDomain: "companyDomain",
    company_domain: "companyDomain",
    管理シートURL: "manageSheetUrl",
    manageSheetUrl: "manageSheetUrl",
    デザインパターン: "designPattern",
    designPattern: "designPattern",
    表示する: "showCompany",
    showCompany: "showCompany",
    visible: "showCompany",
    画像URL: "imageUrl",
    imageUrl: "imageUrl",
    説明: "description",
    description: "description",
    並び順: "order",
    order: "order",
    // 新規追加フィールド
    お仕事内容: "jobDescription",
    仕事内容: "jobDescription",
    jobContent: "jobDescription",
    jobDescription: "jobDescription",
    勤務時間: "workingHours",
    workingHours: "workingHours",
    会社住所: "companyAddress",
    companyAddress: "companyAddress",
    // 勤務地（実際に働く場所）
    勤務地: "workLocation",
    workLocation: "workLocation",
    // 給与形態
    給与形態: "salaryType",
    salaryType: "salaryType",
    "給与詳細（その他）": "salaryOther",
    salaryOther: "salaryOther",
    // 雇用形態
    雇用形態: "employmentType",
    employmentType: "employmentType",
    // メモ
    メモ: "memo",
    memo: "memo",
    // 職種
    職種: "jobType",
    jobType: "jobType",
    // 表示する特徴
    "表示する特徴": "displayedFeatures",
    displayedFeatures: "displayedFeatures",
  };
  const cleanHeader = String(header).trim();
  return mapping[cleanHeader] || cleanHeader;
}

// --- テスト用関数 ---

function testSaveLPSettings() {
  const result = saveLPSettings({
    companyDomain: "test-company",
    designPattern: "modern",
    heroTitle: "テストタイトル",
    heroSubtitle: "テストサブタイトル",
    heroImage: "",
    pointTitle1: "ポイント1",
    pointDesc1: "説明1",
    pointTitle2: "",
    pointDesc2: "",
    pointTitle3: "",
    pointDesc3: "",
    ctaText: "応募する",
    faq: "",
  });
  Logger.log(result);
}

function testGetCompanies() {
  const result = getCompanies();
  Logger.log(result);
}

// ========================================
// 求人CRUD機能
// ========================================

/**
 * 会社の管理シートURLを取得
 */
function getCompanySheetUrl(companyDomain) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(COMPANY_SHEET_NAME);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  const DOMAIN_COL = 13; // M列
  const URL_COL = 15; // O列

  for (let i = 1; i < data.length; i++) {
    if (data[i][DOMAIN_COL - 1] === companyDomain) {
      return data[i][URL_COL - 1] || null;
    }
  }
  return null;
}

/**
 * 管理シートURLからスプレッドシートを開く
 */
function openCompanySheet(companyDomain) {
  const sheetUrl = getCompanySheetUrl(companyDomain);
  if (!sheetUrl) {
    throw new Error("管理シートが見つかりません");
  }

  const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!sheetIdMatch) {
    throw new Error("シートIDを取得できません");
  }

  return SpreadsheetApp.openById(sheetIdMatch[1]);
}

/**
 * 求人一覧を取得
 */
function getJobs(companyDomain) {
  try {
    const ss = openCompanySheet(companyDomain);
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();

    if (data.length < 3) {
      return { success: true, jobs: [] };
    }

    const headers = data[0]; // 英語ヘッダー
    const jobs = [];

    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      if (!row[0] && !row[1]) continue; // IDもタイトルもない行はスキップ

      const job = { _rowIndex: i + 1 };
      headers.forEach((header, idx) => {
        job[header] = row[idx] || "";
      });
      jobs.push(job);
    }

    return { success: true, jobs };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 求人を保存（新規作成/更新）
 */
function saveJob(companyDomain, jobData, rowIndex) {
  try {
    const ss = openCompanySheet(companyDomain);
    const sheet = ss.getSheets()[0];

    // 現在のヘッダーを取得
    const lastCol = sheet.getLastColumn();
    let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    // 必要な列が存在しなければ追加
    const requiredCols = ["memo", "employmentType", "jobType", "salaryType", "salaryOther", "displayedFeatures"];
    for (const col of requiredCols) {
      if (!headers.includes(col)) {
        const newColIndex = sheet.getLastColumn() + 1;
        sheet.getRange(1, newColIndex).setValue(col);
        // 2行目に日本語ヘッダーを追加
        const japaneseHeaders = {
          memo: "メモ",
          employmentType: "雇用形態",
          jobType: "職種",
          salaryType: "給与形態",
          salaryOther: "給与詳細（その他）",
          displayedFeatures: "表示する特徴"
        };
        if (japaneseHeaders[col]) {
          sheet.getRange(2, newColIndex).setValue(japaneseHeaders[col]);
        }
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      }
    }

    // 行データを作成
    const rowData = headers.map((header) => {
      const mapping = {
        id: jobData.id || "",
        memo: jobData.memo || "",
        title: jobData.title || "",
        employmentType: jobData.employmentType || "",
        location: jobData.location || "",
        totalBonus: jobData.totalBonus || "",
        salaryType: jobData.salaryType || "",
        monthlySalary: jobData.monthlySalary || "",
        salaryOther: jobData.salaryOther || "",
        jobType: jobData.jobType || "",
        features: jobData.features || "",
        displayedFeatures: jobData.displayedFeatures || "",
        badges: jobData.badges || "",
        jobDescription: jobData.jobDescription || "",
        requirements: jobData.requirements || "",
        benefits: jobData.benefits || "",
        workingHours: jobData.workingHours || "",
        holidays: jobData.holidays || "",
        visible: jobData.visible || "true",
        order: jobData.order || "",
        publishStartDate: jobData.publishStartDate || "",
        publishEndDate: jobData.publishEndDate || "",
      };
      return mapping[header] !== undefined ? mapping[header] : "";
    });

    if (rowIndex) {
      // 既存行を更新
      // 既存のIDを保持（空の場合は既存値を維持）
      if (!rowData[0]) {
        const existingId = sheet.getRange(rowIndex, 1).getValue();
        rowData[0] = existingId || rowIndex - 2; // IDがなければ行番号から生成
      }
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      return {
        success: true,
        message: "求人情報を更新しました",
        rowIndex: rowIndex,
      };
    } else {
      // 新規行を追加
      // 新しいIDを生成
      const lastRow = sheet.getLastRow();
      const newId = lastRow > 2 ? lastRow - 1 : 1;
      rowData[0] = newId; // A列にID

      sheet.appendRow(rowData);
      return {
        success: true,
        message: "求人を作成しました",
        rowIndex: sheet.getLastRow(),
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 求人を削除
 */
function deleteJob(companyDomain, rowIndex) {
  try {
    if (!rowIndex || rowIndex <= 2) {
      return { success: false, error: "無効な行番号です" };
    }

    const ss = openCompanySheet(companyDomain);
    const sheet = ss.getSheets()[0];

    // 行が存在するか確認
    const lastRow = sheet.getLastRow();
    if (rowIndex > lastRow) {
      return { success: false, error: "指定された行が存在しません" };
    }

    sheet.deleteRow(rowIndex);
    return { success: true, message: "求人を削除しました" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// テスト用
function testGetJobs() {
  const result = getJobs("toyota");
  Logger.log(result);
}

// ========================================
// 採用ページ設定機能
// ========================================

const RECRUIT_SETTINGS_SHEET_NAME = "採用ページ設定";

/**
 * 採用ページ設定を取得
 */
function getRecruitSettings(companyDomain) {
  if (!companyDomain) {
    return { success: false, error: "companyDomainが指定されていません" };
  }

  try {
    const companySs = openCompanySheet(companyDomain);
    const sheet = companySs.getSheetByName(RECRUIT_SETTINGS_SHEET_NAME);

    if (!sheet) {
      return { success: true, settings: null };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return { success: true, settings: null };
    }

    const headers = data[0];
    const row = data[1]; // 1行目がヘッダー、2行目がデータ

    const settings = {};
    headers.forEach((header, idx) => {
      settings[header] = row[idx] || "";
    });

    return { success: true, settings };
  } catch (error) {
    console.error("getRecruitSettings error:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 採用ページ設定を保存
 */
function updateRecruitSettings(settingsData) {
  const companyDomain = settingsData.companyDomain;

  if (!companyDomain) {
    return { success: false, error: "companyDomainが指定されていません" };
  }

  try {
    const companySs = openCompanySheet(companyDomain);
    let sheet = companySs.getSheetByName(RECRUIT_SETTINGS_SHEET_NAME);

    // シートが存在しない場合は作成
    if (!sheet) {
      sheet = companySs.insertSheet(RECRUIT_SETTINGS_SHEET_NAME);
      const headers = [
        "companyDomain",
        "layoutStyle",
        "designPattern",
        "customPrimary",
        "customAccent",
        "customBg",
        "customText",
        "logoUrl",
        "companyNameDisplay",
        "phoneNumber",
        "ctaButtonText",
        "heroTitle",
        "heroSubtitle",
        "heroImage",
        "companyIntro",
        "jobsTitle",
        "ctaTitle",
        "ctaText",
        "ogpTitle",
        "ogpDescription",
        "ogpImage",
        "showVideoButton",
        "videoUrl",
        "sectionOrder",
        "sectionVisibility",
        "snsTwitter",
        "snsInstagram",
        "snsFacebook",
        "snsYoutube",
        "snsLine"
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.getRange(1, 1, 1, headers.length).setBackground("#f3f3f3");
      sheet.setFrozenRows(1);
    }

    // 既存シートに必要な列がなければ追加
    let existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const requiredCols = [
      "companyDomain",
      "layoutStyle",
      "designPattern",
      "customPrimary",
      "customAccent",
      "customBg",
      "customText",
      "logoUrl",
      "companyNameDisplay",
      "phoneNumber",
      "ctaButtonText",
      "heroTitle",
      "heroSubtitle",
      "heroImage",
      "companyIntro",
      "jobsTitle",
      "ctaTitle",
      "ctaText",
      "ogpTitle",
      "ogpDescription",
      "ogpImage",
      "showVideoButton",
      "videoUrl",
      "sectionOrder",
      "sectionVisibility",
      "snsTwitter",
      "snsInstagram",
      "snsFacebook",
      "snsYoutube",
      "snsLine"
    ];

    for (const col of requiredCols) {
      if (!existingHeaders.includes(col)) {
        const newCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, newCol).setValue(col);
        existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      }
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // 行データを作成
    const rowData = headers.map((header) => {
      return settingsData[header] !== undefined ? settingsData[header] : "";
    });

    // 2行目にデータがあれば更新、なければ追加
    const data = sheet.getDataRange().getValues();
    if (data.length >= 2) {
      sheet.getRange(2, 1, 1, rowData.length).setValues([rowData]);
      return { success: true, message: "採用ページ設定を更新しました", isNew: false };
    } else {
      sheet.appendRow(rowData);
      return { success: true, message: "採用ページ設定を登録しました", isNew: true };
    }
  } catch (error) {
    console.error("updateRecruitSettings error:", error.message);
    return { success: false, error: error.message };
  }
}

// テスト用
function testGetRecruitSettings() {
  const result = getRecruitSettings("toyota");
  Logger.log(result);
}

// ========================================
// 求人統計機能は job-stats.gs に分離
// ========================================
