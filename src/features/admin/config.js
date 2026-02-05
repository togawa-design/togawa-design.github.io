/**
 * Admin Dashboard - 設定
 */

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
  gaPropertyId: 'G-E1XC94EG05',
  gaApiKey: 'AIzaSyAIC2WGg5dnvMh6TO4sivpbk4HtpYw4tbo',
  apiEndpoint: 'https://asia-northeast1-generated-area-484613-e3.cloudfunctions.net/getAnalyticsData',
  firebaseConfig: {
    apiKey: "AIzaSyB3eXZoFkXOwnHxPvaHiWO7csmZK4KGqAQ",
    authDomain: "generated-area-484613-e3-90bd4.firebaseapp.com",
    projectId: "generated-area-484613-e3-90bd4"
  }
};

export const spreadsheetConfig = {
  sheetId: '1NVIDV3OiXbNrVI7EFdRrU2Ggn8dx7Q0rSnvJ6uaWvX0',
  companySheetName: '会社一覧',
  lpSettingsSheetName: 'LP設定',
  gasApiUrl: 'https://script.google.com/macros/s/AKfycbxj6CqSfY7jq04uDXURhewD_BAKx3csLKBpl1hdRBdNg-R-E6IuoaZGje22Gr9WYWY2/exec'
};

// Firestoreを使用するかどうかのフラグ
// true: Firestoreを使用（新方式）
// false: GAS APIを使用（旧方式）
export const useFirestore = true; // Firestore使用中

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
