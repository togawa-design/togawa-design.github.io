#!/usr/bin/env node
/**
 * admin_users ドキュメントを UID ベースに移行するスクリプト
 *
 * 既存の自動生成IDのドキュメントを、Firebase Auth の UID をキーとした
 * ドキュメントに移行します。
 *
 * 使用方法:
 *   node scripts/migrate-admin-users-to-uid.cjs [--dev|--prod] [--dry-run]
 *
 * オプション:
 *   --dev      開発環境（デフォルト）
 *   --prod     本番環境
 *   --dry-run  実際には変更せず、何が行われるかを表示
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
const envFlag = args.find(arg => arg === '--prod' || arg === '--dev');
const dryRun = args.includes('--dry-run');
const env = envFlag === '--prod' ? 'prod' : 'dev';

const project = PROJECTS[env];

console.log('===========================================');
console.log('admin_users UID 移行スクリプト');
console.log(`環境: ${project.name} (${project.projectId})`);
if (dryRun) {
  console.log('モード: DRY RUN（実際の変更は行いません）');
}
console.log('===========================================\n');

// Firebase Admin SDK を初期化
admin.initializeApp({
  projectId: project.projectId
});

const db = admin.firestore();

async function migrate() {
  try {
    // 全ての admin_users ドキュメントを取得
    const snapshot = await db.collection('admin_users').get();

    if (snapshot.empty) {
      console.log('admin_users ドキュメントがありません');
      process.exit(0);
    }

    console.log(`${snapshot.size} 件のドキュメントを確認します...\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docId = doc.id;
      const email = data.email;

      console.log(`[${email}]`);
      console.log(`  現在のドキュメントID: ${docId}`);

      try {
        // Firebase Auth からユーザーを取得
        let userRecord;
        try {
          userRecord = await admin.auth().getUserByEmail(email);
        } catch (authError) {
          if (authError.code === 'auth/user-not-found') {
            console.log(`  ⚠️ Firebase Auth にユーザーが存在しません`);
            console.log(`  → ユーザーを作成します`);

            if (!dryRun) {
              userRecord = await admin.auth().createUser({ email });
            } else {
              console.log(`  [DRY RUN] ユーザー作成をスキップ`);
              skipped++;
              continue;
            }
          } else {
            throw authError;
          }
        }

        const uid = userRecord.uid;
        console.log(`  Firebase Auth UID: ${uid}`);

        // 既にUIDベースのドキュメントか確認
        if (docId === uid) {
          console.log(`  ✅ 既にUIDベースです（スキップ）`);
          skipped++;
          continue;
        }

        // UIDベースのドキュメントが既に存在するか確認
        const existingUidDoc = await db.collection('admin_users').doc(uid).get();
        if (existingUidDoc.exists) {
          console.log(`  ⚠️ UIDベースのドキュメントが既に存在します`);
          console.log(`  → 古いドキュメントを削除します`);

          if (!dryRun) {
            await doc.ref.delete();
          }
          console.log(`  ✅ 古いドキュメント削除完了`);
          migrated++;
          continue;
        }

        // 移行: 新しいUIDベースのドキュメントを作成
        console.log(`  → UIDベースに移行します: ${docId} -> ${uid}`);

        if (!dryRun) {
          // 新しいドキュメントを作成
          await db.collection('admin_users').doc(uid).set({
            ...data,
            migratedFrom: docId,
            migratedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // 古いドキュメントを削除
          await doc.ref.delete();
        }

        console.log(`  ✅ 移行完了`);
        migrated++;

      } catch (error) {
        console.log(`  ❌ エラー: ${error.message}`);
        errors++;
      }

      console.log('');
    }

    console.log('===========================================');
    console.log('完了');
    console.log(`  移行: ${migrated} 件`);
    console.log(`  スキップ: ${skipped} 件`);
    console.log(`  エラー: ${errors} 件`);
    if (dryRun) {
      console.log('\n※ DRY RUN モードのため、実際の変更は行われていません');
      console.log('  実行するには --dry-run を外してください');
    }
    console.log('===========================================');

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

migrate();
