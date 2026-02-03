/**
 * Admin Dashboard - 日付ピッカーモジュール
 * flatpickrを使用した期間選択の管理
 */

// 現在の期間設定
let currentStartDate = null;
let currentEndDate = null;
let startPicker = null;
let endPicker = null;

// 日付変更時のコールバック
let onDateChangeCallback = null;

/**
 * 日付ピッカーを初期化
 * @param {Function} onDateChange - 日付変更時のコールバック
 */
export function initDatePicker(onDateChange) {
  onDateChangeCallback = onDateChange;

  // flatpickrがロードされているか確認
  if (typeof flatpickr === 'undefined') {
    console.warn('[DatePicker] flatpickr not loaded');
    return;
  }

  // 日本語ロケール設定
  flatpickr.localize(flatpickr.l10ns.ja);

  // デフォルト期間（過去1ヶ月間）を設定
  const today = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(today.getMonth() - 1);

  currentStartDate = oneMonthAgo;
  currentEndDate = today;

  // ヘッダーの日付ピッカーを初期化
  initHeaderDatePicker();

  // 求人管理アナリティクスの日付ピッカーを初期化
  initJobManageAnalyticsDatePicker();
}

/**
 * ヘッダーの日付ピッカーを初期化
 */
function initHeaderDatePicker() {
  const startInput = document.getElementById('date-range-start');
  const endInput = document.getElementById('date-range-end');

  if (!startInput || !endInput) return;

  const commonConfig = {
    dateFormat: 'Y/m/d',
    maxDate: 'today',
    disableMobile: true
  };

  // 開始日ピッカー
  startPicker = flatpickr(startInput, {
    ...commonConfig,
    defaultDate: currentStartDate,
    onChange: (selectedDates) => {
      if (selectedDates[0]) {
        currentStartDate = selectedDates[0];
        // 終了日より後の場合は終了日を更新
        if (currentEndDate && selectedDates[0] > currentEndDate) {
          currentEndDate = selectedDates[0];
          endPicker?.setDate(currentEndDate);
        }
        triggerDateChange();
      }
    }
  });

  // 終了日ピッカー
  endPicker = flatpickr(endInput, {
    ...commonConfig,
    defaultDate: currentEndDate,
    onChange: (selectedDates) => {
      if (selectedDates[0]) {
        currentEndDate = selectedDates[0];
        // 開始日より前の場合は開始日を更新
        if (currentStartDate && selectedDates[0] < currentStartDate) {
          currentStartDate = selectedDates[0];
          startPicker?.setDate(currentStartDate);
        }
        triggerDateChange();
      }
    }
  });
}

/**
 * 求人管理アナリティクスの日付ピッカーを初期化
 */
function initJobManageAnalyticsDatePicker() {
  const startInput = document.getElementById('jm-analytics-start-date');
  const endInput = document.getElementById('jm-analytics-end-date');

  if (!startInput || !endInput) return;

  const commonConfig = {
    dateFormat: 'Y/m/d',
    maxDate: 'today',
    disableMobile: true
  };

  // 開始日ピッカー
  flatpickr(startInput, {
    ...commonConfig,
    defaultDate: currentStartDate,
    onChange: (selectedDates) => {
      if (selectedDates[0]) {
        // ヘッダーと同期
        currentStartDate = selectedDates[0];
        startPicker?.setDate(selectedDates[0]);
        if (currentEndDate && selectedDates[0] > currentEndDate) {
          currentEndDate = selectedDates[0];
          endPicker?.setDate(currentEndDate);
        }
      }
    }
  });

  // 終了日ピッカー
  flatpickr(endInput, {
    ...commonConfig,
    defaultDate: currentEndDate,
    onChange: (selectedDates) => {
      if (selectedDates[0]) {
        currentEndDate = selectedDates[0];
        endPicker?.setDate(selectedDates[0]);
        if (currentStartDate && selectedDates[0] < currentStartDate) {
          currentStartDate = selectedDates[0];
          startPicker?.setDate(currentStartDate);
        }
      }
    }
  });
}

/**
 * 期間を設定
 * @param {Date} startDate
 * @param {Date} endDate
 */
export function setDateRange(startDate, endDate) {
  currentStartDate = startDate;
  currentEndDate = endDate;

  // flatpickrインスタンスを更新
  if (startPicker) startPicker.setDate(startDate);
  if (endPicker) endPicker.setDate(endDate);

  // 求人管理アナリティクスの日付も更新
  const jmStartInput = document.getElementById('jm-analytics-start-date');
  const jmEndInput = document.getElementById('jm-analytics-end-date');
  if (jmStartInput?._flatpickr) jmStartInput._flatpickr.setDate(startDate);
  if (jmEndInput?._flatpickr) jmEndInput._flatpickr.setDate(endDate);
}

/**
 * 日付変更をトリガー
 */
function triggerDateChange() {
  if (onDateChangeCallback) {
    onDateChangeCallback(getDateRange());
  }
}

/**
 * 現在の期間を取得
 * @returns {{ startDate: Date, endDate: Date, days: number }}
 */
export function getDateRange() {
  const start = currentStartDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = currentEndDate || new Date();
  const days = Math.round((end - start) / (1000 * 60 * 60 * 24));

  return {
    startDate: start,
    endDate: end,
    days,
    // API用フォーマット
    startDateStr: formatDateForAPI(start),
    endDateStr: formatDateForAPI(end)
  };
}

/**
 * API用の日付フォーマット (YYYY-MM-DD)
 */
function formatDateForAPI(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 日数から期間を設定
 * @param {number} days
 */
export function setDays(days) {
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - days);
  setDateRange(startDate, today);
}

export default {
  initDatePicker,
  getDateRange,
  setDateRange,
  setDays
};
