/**
 * 求人統計機能（事前計算方式）
 *
 * 使い方:
 * 1. GASエディタでこのファイルを追加
 * 2. setupJobStatsTrigger() を1回実行してトリガー登録
 * 3. recalculateJobStats() を1回実行して初回計算
 */

const STATS_SHEET_NAME = "Stats";

/**
 * 求人統計を取得（Statsシートから読み込み - 高速）
 */
function getJobStats() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let statsSheet = ss.getSheetByName(STATS_SHEET_NAME);

    // Statsシートがない場合は作成して計算
    if (!statsSheet) {
      return recalculateJobStats();
    }

    const data = statsSheet.getDataRange().getValues();
    if (data.length < 2) {
      return recalculateJobStats();
    }

    // A1:ヘッダー, A2:データ の形式
    const headers = data[0];
    const values = data[1];

    const stats = {};
    headers.forEach((h, idx) => {
      stats[h] = values[idx];
    });

    return {
      success: true,
      stats: {
        jobCount: parseInt(stats.jobCount) || 0,
        avgHourlyWage: parseInt(stats.avgHourlyWage) || 0,
        avgMonthlySalary: parseInt(stats.avgMonthlySalary) || 0,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 求人統計を再計算してStatsシートに保存
 * トリガーで定期実行（1時間ごと推奨）
 */
function recalculateJobStats() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const companySheet = ss.getSheetByName(COMPANY_SHEET_NAME);
    if (!companySheet) {
      return { success: false, error: "会社一覧シートが見つかりません" };
    }

    // Statsシートを取得または作成
    let statsSheet = ss.getSheetByName(STATS_SHEET_NAME);
    if (!statsSheet) {
      statsSheet = ss.insertSheet(STATS_SHEET_NAME);
      statsSheet.appendRow([
        "jobCount",
        "avgHourlyWage",
        "avgMonthlySalary",
        "updatedAt",
      ]);
      statsSheet.getRange(1, 1, 1, 4).setFontWeight("bold");
    }

    const companyData = companySheet.getDataRange().getValues();
    const companyHeaders = companyData[0];

    // 列インデックスを取得
    const visibleColIdx = getColIndex(companyHeaders, [
      "表示する",
      "showCompany",
      "visible",
    ]);
    const sheetUrlColIdx = getColIndex(companyHeaders, [
      "管理シート",
      "管理シートURL",
      "manageSheetUrl",
    ]);

    let totalJobCount = 0;
    let totalMonthlySalary = 0;
    let salaryCount = 0;

    // 各会社の求人を取得
    for (let i = 1; i < companyData.length; i++) {
      const row = companyData[i];
      const visible = row[visibleColIdx];
      const sheetUrl = row[sheetUrlColIdx];

      if (visible !== "○" && visible !== "◯") continue;
      if (!sheetUrl) continue;

      try {
        const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!sheetIdMatch) continue;

        const companySs = SpreadsheetApp.openById(sheetIdMatch[1]);
        const jobSheet = companySs.getSheets()[0];
        const jobData = jobSheet.getDataRange().getValues();

        if (jobData.length < 3) continue;

        const jobHeaders = jobData[0];
        const visibleJobColIdx = getColIndex(jobHeaders, [
          "visible",
          "表示",
          "表示する",
        ]);
        const monthlySalaryColIdx = getColIndex(jobHeaders, [
          "monthlySalary",
          "月収",
          "月給",
          "月収目安",
          "想定月収",
        ]);
        const publishStartColIdx = getColIndex(jobHeaders, [
          "publishStartDate",
          "掲載開始日",
        ]);
        const publishEndColIdx = getColIndex(jobHeaders, [
          "publishEndDate",
          "掲載終了日",
        ]);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let j = 2; j < jobData.length; j++) {
          const jobRow = jobData[j];
          if (!jobRow[0] && !jobRow[1]) continue;

          if (
            visibleJobColIdx >= 0 &&
            (jobRow[visibleJobColIdx] === "false" ||
              jobRow[visibleJobColIdx] === "FALSE")
          ) {
            continue;
          }

          if (publishStartColIdx >= 0 && jobRow[publishStartColIdx]) {
            const startDate = new Date(jobRow[publishStartColIdx]);
            if (!isNaN(startDate.getTime()) && startDate > today) continue;
          }
          if (publishEndColIdx >= 0 && jobRow[publishEndColIdx]) {
            const endDate = new Date(jobRow[publishEndColIdx]);
            if (!isNaN(endDate.getTime()) && endDate < today) continue;
          }

          totalJobCount++;

          if (monthlySalaryColIdx >= 0 && jobRow[monthlySalaryColIdx]) {
            const salary = parseMonthlySalary(jobRow[monthlySalaryColIdx]);
            if (salary > 0) {
              totalMonthlySalary += salary;
              salaryCount++;
            }
          }
        }
      } catch (e) {
        console.error(`Company sheet error: ${e.message}`);
      }
    }

    const avgMonthlySalary =
      salaryCount > 0 ? Math.round(totalMonthlySalary / salaryCount) : 0;
    const avgHourlyWage =
      avgMonthlySalary > 0 ? Math.round(avgMonthlySalary / 160) : 0;

    // Statsシートに保存（2行目を上書き）
    const now = new Date().toISOString();
    if (statsSheet.getLastRow() < 2) {
      statsSheet.appendRow([
        totalJobCount,
        avgHourlyWage,
        avgMonthlySalary,
        now,
      ]);
    } else {
      statsSheet
        .getRange(2, 1, 1, 4)
        .setValues([[totalJobCount, avgHourlyWage, avgMonthlySalary, now]]);
    }

    Logger.log(
      `Stats updated: jobCount=${totalJobCount}, avgHourlyWage=${avgHourlyWage}, avgMonthlySalary=${avgMonthlySalary}`,
    );

    return {
      success: true,
      stats: {
        jobCount: totalJobCount,
        avgHourlyWage: avgHourlyWage,
        avgMonthlySalary: avgMonthlySalary,
      },
    };
  } catch (error) {
    console.error("recalculateJobStats error:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 統計再計算トリガーを設定（1時間ごと）
 * 手動で1回実行してトリガーを登録
 */
function setupJobStatsTrigger() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === "recalculateJobStats") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 1時間ごとのトリガーを作成
  ScriptApp.newTrigger("recalculateJobStats")
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log("統計再計算トリガーを設定しました（1時間ごと）");
}

/**
 * 月収文字列をパースして数値に変換
 */
function parseMonthlySalary(salaryStr) {
  if (!salaryStr) return 0;
  const str = String(salaryStr);

  // "30万円" 形式
  const manMatch = str.match(/(\d+(?:\.\d+)?)\s*万/);
  if (manMatch) {
    return parseFloat(manMatch[1]) * 10000;
  }

  // "300,000円" 形式
  const yenMatch = str.match(/(\d{1,3}(?:,\d{3})*)\s*円/);
  if (yenMatch) {
    return parseInt(yenMatch[1].replace(/,/g, ""));
  }

  // "¥300,000" 形式
  const yenSymbolMatch = str.match(/[¥￥]\s*(\d{1,3}(?:,\d{3})*|\d+)/);
  if (yenSymbolMatch) {
    return parseInt(yenSymbolMatch[1].replace(/,/g, ""));
  }

  // 数値のみ（カンマ区切りまたは連続数字）
  const numMatch = str.match(/(\d+)/g);
  if (numMatch) {
    const longest = numMatch.reduce((a, b) => (a.length >= b.length ? a : b));
    return parseInt(longest);
  }

  return 0;
}

// ========================================
// テスト用関数
// ========================================

function testGetJobStats() {
  const result = getJobStats();
  Logger.log(result);
}

function testRecalculateJobStats() {
  const result = recalculateJobStats();
  Logger.log(result);
}
