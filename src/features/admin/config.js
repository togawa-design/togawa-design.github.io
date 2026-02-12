/**
 * Admin Dashboard - 設定
 */
import { firebaseConfig as envFirebaseConfig, cloudFunctionsBaseUrl, gaConfig, apiEndpoints } from '@shared/env-config';

// ユーザーロール定義
export const USER_ROLES = {
  ADMIN: 'admin',       // 全機能アクセス可能
  COMPANY: 'company'    // 自社のみアクセス可能
};

export const config = {
  credentials: {
    username: 'admin',
    password: 'receco2025'
  },
  sessionKey: 'rikueco_admin_session',
  userRoleKey: 'rikueco_user_role',
  userCompanyKey: 'rikueco_user_company',
  gaPropertyId: gaConfig.propertyId,
  gaApiKey: gaConfig.apiKey,
  apiEndpoint: apiEndpoints.analytics,
  cloudFunctionsBaseUrl: cloudFunctionsBaseUrl,
  legacyLoginUrl: apiEndpoints.legacyLogin,
  firebaseConfig: envFirebaseConfig
};

// パターンラベル取得
export function getPatternLabel(pattern) {
  const labels = {
    standard: 'スタンダード',
    modern: 'モダン',
    classic: 'クラシック',
    minimal: 'ミニマル',
    colorful: 'カラフル'
  };
  return labels[pattern] || 'スタンダード';
}

// ヒーロー画像プリセット
export const heroImagePresets = [
  { id: 'teamwork-1', name: 'チームミーティング', url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&q=60' },
  { id: 'teamwork-2', name: 'オフィスワーク', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=60' },
  { id: 'teamwork-3', name: 'コラボレーション', url: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=60' },
  { id: 'teamwork-4', name: 'ビジネス握手', url: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&q=60' },
  { id: 'teamwork-5', name: 'ワークショップ', url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&q=60' },
  { id: 'work-1', name: '作業風景', url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=60' },
  { id: 'work-2', name: '倉庫作業', url: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&q=60' },
  { id: 'work-3', name: '建設現場', url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=60' },
  { id: 'work-4', name: '技術職', url: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400&q=60' },
  { id: 'work-5', name: 'チームワーク', url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1920&q=80', thumbnail: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=60' }
];
