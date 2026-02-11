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
    // Firebase Auth でユーザーを取得または作成
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log(`既存のFirebase Authユーザーを発見: ${userRecord.uid}`);
    } catch (authError) {
      if (authError.code === 'auth/user-not-found') {
        // ユーザーが存在しない場合は作成
        userRecord = await admin.auth().createUser({ email });
        console.log(`新規Firebase Authユーザーを作成: ${userRecord.uid}`);
      } else {
        throw authError;
      }
    }

    const uid = userRecord.uid;

    // 既存のadmin_usersドキュメントをチェック（UIDベース）
    const existingDoc = await db.collection('admin_users').doc(uid).get();
    if (existingDoc.exists) {
      console.log(`このユーザーは既に管理者として登録されています`);
      console.log(`  UID: ${uid}`);
      console.log(`  Email: ${email}`);
      process.exit(0);
    }

    // 古い形式（メールベース）のドキュメントがあれば削除
    const oldDocs = await db.collection('admin_users')
      .where('email', '==', email)
      .get();

    if (!oldDocs.empty) {
      console.log(`古い形式のドキュメントを移行します...`);
      for (const doc of oldDocs.docs) {
        const oldData = doc.data();
        // 新しいUIDベースのドキュメントを作成
        await db.collection('admin_users').doc(uid).set({
          ...oldData,
          migratedFrom: doc.id,
          migratedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // 古いドキュメントを削除
        await doc.ref.delete();
        console.log(`  移行完了: ${doc.id} -> ${uid}`);
      }
      console.log('');
      console.log('管理者データを移行しました:');
      console.log(`  環境: ${project.name}`);
      console.log(`  プロジェクト: ${project.projectId}`);
      console.log(`  メール: ${email}`);
      console.log(`  UID: ${uid}`);
      process.exit(0);
    }

    // 新規管理者を追加（UIDをドキュメントIDとして使用）
    await db.collection('admin_users').doc(uid).set({
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
    console.log(`  UID: ${uid}`);
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
