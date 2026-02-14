/**
 * 環境設定 - Vite環境変数から設定を読み込み
 *
 * 使い方:
 * import { envConfig } from '@shared/env-config';
 * console.log(envConfig.cloudFunctionsBaseUrl);
 */

// 環境識別
export const isDevelopment = import.meta.env.VITE_ENV === 'development' || import.meta.env.DEV;
export const isProduction = import.meta.env.VITE_ENV === 'production' || import.meta.env.PROD;

// Firebase設定
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB3eXZoFkXOwnHxPvaHiWO7csmZK4KGqAQ',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'generated-area-484613-e3-90bd4.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'generated-area-484613-e3-90bd4'
};

// Cloud Functions
export const cloudFunctionsBaseUrl = import.meta.env.VITE_CLOUD_FUNCTIONS_BASE_URL || 'https://asia-northeast1-generated-area-484613-e3.cloudfunctions.net';

// Google Analytics
export const gaConfig = {
  propertyId: import.meta.env.VITE_GA_PROPERTY_ID || 'G-E1XC94EG05',
  apiKey: import.meta.env.VITE_GA_API_KEY || 'AIzaSyAIC2WGg5dnvMh6TO4sivpbk4HtpYw4tbo'
};

// API エンドポイント
export const apiEndpoints = {
  analytics: `${cloudFunctionsBaseUrl}/getAnalyticsData`,
  pageAnalytics: `${cloudFunctionsBaseUrl}/getPageAnalytics`,
  trackPageAnalytics: `${cloudFunctionsBaseUrl}/trackPageAnalytics`,
  legacyLogin: `${cloudFunctionsBaseUrl}/legacyLogin`,
  resetLegacyPassword: `${cloudFunctionsBaseUrl}/resetLegacyPassword`,
  sendEmail: `${cloudFunctionsBaseUrl}/sendEmail`,
  getEmails: `${cloudFunctionsBaseUrl}/getEmails`,
  createCompanyUser: `${cloudFunctionsBaseUrl}/createCompanyUser`,
  createCompanyStaff: `${cloudFunctionsBaseUrl}/createCompanyStaff`,
  deleteCompanyUser: `${cloudFunctionsBaseUrl}/deleteCompanyUser`,
  // カレンダー系
  initiateCalendarAuth: `${cloudFunctionsBaseUrl}/initiateCalendarAuth`,
  calendarOAuthCallback: `${cloudFunctionsBaseUrl}/calendarOAuthCallback`,
  getCalendarAvailability: `${cloudFunctionsBaseUrl}/getCalendarAvailability`,
  createCalendarEvent: `${cloudFunctionsBaseUrl}/createCalendarEvent`,
  getCalendarIntegration: `${cloudFunctionsBaseUrl}/getCalendarIntegration`,
  revokeCalendarAuth: `${cloudFunctionsBaseUrl}/revokeCalendarAuth`
};

// まとめてエクスポート
export const envConfig = {
  isDevelopment,
  isProduction,
  env: import.meta.env.VITE_ENV || (import.meta.env.DEV ? 'development' : 'production'),
  firebase: firebaseConfig,
  cloudFunctionsBaseUrl,
  ga: gaConfig,
  api: apiEndpoints
};

// デバッグ用（開発環境のみ）
if (isDevelopment) {
  console.log('[env-config] Environment:', envConfig.env);
  console.log('[env-config] Cloud Functions URL:', cloudFunctionsBaseUrl);
}
