/**
 * フォームバリデーションモジュール
 * リアルタイムバリデーションとインラインエラー表示
 */

// スタイルを動的に追加
function ensureStyles() {
  if (document.getElementById('validation-styles')) return;

  const style = document.createElement('style');
  style.id = 'validation-styles';
  style.textContent = `
    .field-error {
      border-color: #ef4444 !important;
      background-color: #fef2f2 !important;
    }
    .field-error:focus {
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
    }
    .field-success {
      border-color: #10b981 !important;
    }
    .validation-message {
      font-size: 0.75rem;
      margin-top: 0.25rem;
      display: block;
    }
    .validation-message.error {
      color: #ef4444;
    }
    .validation-message.success {
      color: #10b981;
    }
  `;
  document.head.appendChild(style);
}

/**
 * バリデーションルール
 */
export const rules = {
  required: (value) => {
    if (value === null || value === undefined || value === '') {
      return '必須項目です';
    }
    return null;
  },

  email: (value) => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'メールアドレスの形式が正しくありません';
    }
    return null;
  },

  url: (value) => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return 'URLの形式が正しくありません';
    }
  },

  minLength: (min) => (value) => {
    if (!value) return null;
    if (value.length < min) {
      return `${min}文字以上で入力してください`;
    }
    return null;
  },

  maxLength: (max) => (value) => {
    if (!value) return null;
    if (value.length > max) {
      return `${max}文字以内で入力してください`;
    }
    return null;
  },

  pattern: (regex, message) => (value) => {
    if (!value) return null;
    if (!regex.test(value)) {
      return message || 'パターンが一致しません';
    }
    return null;
  },

  number: (value) => {
    if (!value) return null;
    if (isNaN(Number(value))) {
      return '数値を入力してください';
    }
    return null;
  },

  range: (min, max) => (value) => {
    if (!value) return null;
    const num = Number(value);
    if (isNaN(num)) return '数値を入力してください';
    if (num < min || num > max) {
      return `${min}から${max}の間で入力してください`;
    }
    return null;
  },

  phone: (value) => {
    if (!value) return null;
    // 日本の電話番号形式（ハイフンあり・なし両方対応）
    const phoneRegex = /^(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}|\d{10,11})$/;
    if (!phoneRegex.test(value.replace(/\s/g, ''))) {
      return '電話番号の形式が正しくありません';
    }
    return null;
  },

  postalCode: (value) => {
    if (!value) return null;
    // 日本の郵便番号形式（ハイフンあり・なし両方対応）
    const postalRegex = /^\d{3}-?\d{4}$/;
    if (!postalRegex.test(value)) {
      return '郵便番号の形式が正しくありません（例: 123-4567）';
    }
    return null;
  },

  katakana: (value) => {
    if (!value) return null;
    const katakanaRegex = /^[\u30A0-\u30FF\s]+$/;
    if (!katakanaRegex.test(value)) {
      return 'カタカナで入力してください';
    }
    return null;
  },

  custom: (fn, message) => (value) => {
    if (!value) return null;
    if (!fn(value)) {
      return message || 'バリデーションエラー';
    }
    return null;
  }
};

/**
 * フィールドをバリデート
 * @param {HTMLInputElement} field - 入力フィールド
 * @param {Array<Function>} validators - バリデーション関数の配列
 * @returns {string|null} - エラーメッセージまたはnull
 */
export function validateField(field, validators) {
  ensureStyles();

  const value = field.value?.trim() ?? '';
  let error = null;

  for (const validator of validators) {
    error = validator(value);
    if (error) break;
  }

  // 既存のメッセージを削除
  const existingMessage = field.parentElement?.querySelector('.validation-message');
  if (existingMessage) existingMessage.remove();

  // エラー/成功スタイルをリセット
  field.classList.remove('field-error', 'field-success');

  if (error) {
    field.classList.add('field-error');
    const message = document.createElement('span');
    message.className = 'validation-message error';
    message.textContent = error;
    field.parentElement?.appendChild(message);
  } else if (value) {
    field.classList.add('field-success');
  }

  return error;
}

/**
 * フォーム全体をバリデート
 * @param {HTMLFormElement} form - フォーム要素
 * @param {Object} fieldRules - { fieldName: [validators] }
 * @returns {Object} - { valid: boolean, errors: Object }
 */
export function validateForm(form, fieldRules) {
  const errors = {};
  let valid = true;

  for (const [fieldName, validators] of Object.entries(fieldRules)) {
    const field = form.querySelector(`[name="${fieldName}"]`) ||
                  form.querySelector(`#${fieldName}`);
    if (!field) continue;

    const error = validateField(field, validators);
    if (error) {
      errors[fieldName] = error;
      valid = false;
    }
  }

  return { valid, errors };
}

/**
 * フォームにリアルタイムバリデーションを設定
 * @param {HTMLFormElement} form - フォーム要素
 * @param {Object} fieldRules - { fieldName: [validators] }
 * @param {Object} options - オプション
 * @returns {Function} - クリーンアップ関数
 */
export function setupRealtimeValidation(form, fieldRules, options = {}) {
  const { onValidate } = options;
  const handlers = [];

  for (const [fieldName, validators] of Object.entries(fieldRules)) {
    const field = form.querySelector(`[name="${fieldName}"]`) ||
                  form.querySelector(`#${fieldName}`);
    if (!field) continue;

    const handler = () => {
      const error = validateField(field, validators);
      if (onValidate) onValidate(fieldName, error);
    };

    field.addEventListener('blur', handler);
    field.addEventListener('input', () => {
      // 入力中はエラーをクリア
      field.classList.remove('field-error');
      const msg = field.parentElement?.querySelector('.validation-message');
      if (msg) msg.remove();
    });

    handlers.push({ field, handler });
  }

  // クリーンアップ関数を返す
  return () => {
    handlers.forEach(({ field, handler }) => {
      field.removeEventListener('blur', handler);
    });
  };
}

/**
 * フォームのすべてのバリデーションエラーをクリア
 * @param {HTMLFormElement} form - フォーム要素
 */
export function clearValidationErrors(form) {
  if (!form) return;

  // エラーメッセージを削除
  form.querySelectorAll('.validation-message').forEach(msg => msg.remove());

  // エラー/成功クラスを削除
  form.querySelectorAll('.field-error, .field-success').forEach(field => {
    field.classList.remove('field-error', 'field-success');
  });
}

/**
 * 特定フィールドのエラーを表示
 * @param {HTMLInputElement} field - フィールド要素
 * @param {string} message - エラーメッセージ
 */
export function showFieldError(field, message) {
  if (!field) return;

  ensureStyles();

  // 既存のメッセージを削除
  const existingMessage = field.parentElement?.querySelector('.validation-message');
  if (existingMessage) existingMessage.remove();

  field.classList.remove('field-success');
  field.classList.add('field-error');

  const messageEl = document.createElement('span');
  messageEl.className = 'validation-message error';
  messageEl.textContent = message;
  field.parentElement?.appendChild(messageEl);
}

/**
 * 特定フィールドのエラーをクリア
 * @param {HTMLInputElement} field - フィールド要素
 */
export function clearFieldError(field) {
  if (!field) return;

  const existingMessage = field.parentElement?.querySelector('.validation-message');
  if (existingMessage) existingMessage.remove();

  field.classList.remove('field-error', 'field-success');
}

/**
 * 最初のエラーフィールドにフォーカス
 * @param {HTMLFormElement} form - フォーム要素
 */
export function focusFirstError(form) {
  if (!form) return;

  const firstErrorField = form.querySelector('.field-error');
  if (firstErrorField) {
    firstErrorField.focus();
    firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

export default {
  rules,
  validateField,
  validateForm,
  setupRealtimeValidation,
  clearValidationErrors,
  showFieldError,
  clearFieldError,
  focusFirstError
};
