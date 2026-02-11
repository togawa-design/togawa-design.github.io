#!/usr/bin/env node
/**
 * 管理者ユーザーを追加するスクリプト
 *
 * 使用方法:
 *   node scripts/add-admin.cjs <email> [--dev|--prod]
 *
 * 例:
 *   node scripts/add-admin.cjs t.ogawa@obt-llc.com --dev   # 開発環境
 *   node scripts/add-admin.cjs t.ogawa@obt-llc.com --prod  # 本番環境
 *   node scripts/add-admin.cjs t.ogawa@obt-llc.com         # デフォルト: 開発環境
 */

const admin = require('firebase-admin');

// プロジェクト設定
const PROJECTS = {
  dev: {
    projectId: 'lset-dev',
    name: '開発環境'
  },
  prod: {
    projectId: 'generated-area-484613-e3-90bd4',
    name: '本番環境'
  }
};

// コマンドライン引数を解析
const args = process.argv.slice(2);
const email = args.find(arg => arg.includes('@'));
const envFlag = args.find(arg => arg.startsWith('--'));
const env = envFlag === '--prod' ? 'prod' : 'dev';

if (!email) {
  console.error('使用方法: node scripts/add-admin.cjs <email> [--dev|--prod]');
  console.error('');
  console.error('例:');
  console.error('  node scripts/add-admin.cjs t.ogawa@obt-llc.com --dev');
  console.error('  node scripts/add-admin.cjs t.ogawa@obt-llc.com --prod');
  process.exit(1);
}

const project = PROJECTS[env];
console.log(`\n[${project.name}] ${project.projectId} に管理者を追加します\n`);

// Firebase Admin SDK を初期化
admin.initializeApp({
  projectId: project.projectId
});

const db = admin.firestore();

async function addAdmin() {
  try {
    // 既存のチェック
    const existing = await db.collection('admin_users')
      .where('email', '==', email)
      .get();

    if (!existing.empty) {
      console.log(`このメールアドレスは既に登録されています: ${email}`);
      process.exit(0);
    }

    // 管理者を追加
    const docRef = await db.collection('admin_users').add({
      email: email,
      role: 'admin',
      companyDomain: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'script'
    });

    console.log('管理者を追加しました:');
    console.log(`  環境: ${project.name}`);
    console.log(`  プロジェクト: ${project.projectId}`);
    console.log(`  メール: ${email}`);
    console.log(`  ドキュメントID: ${docRef.id}`);
    console.log('');
    console.log('このアカウントでGoogleログインすると、管理画面にアクセスできます。');

  } catch (error) {
    console.error('エラー:', error.message);
    if (error.message.includes('Could not load the default credentials')) {
      console.error('');
      console.error('認証エラー: 以下のコマンドでログインしてください:');
      console.error('  gcloud auth application-default login');
    }
    process.exit(1);
  }

  process.exit(0);
}

addAdmin();
