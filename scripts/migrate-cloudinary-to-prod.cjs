#!/usr/bin/env node
/**
 * Cloudinary画像を本番フォルダ（prod/）に移動するスクリプト
 *
 * 使用方法:
 *   CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME node scripts/migrate-cloudinary-to-prod.cjs
 *
 * または環境変数を個別に設定:
 *   CLOUDINARY_CLOUD_NAME=dnvtqyhuw
 *   CLOUDINARY_API_KEY=your_api_key
 *   CLOUDINARY_API_SECRET=your_api_secret
 */

const https = require('https');

// 設定
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dnvtqyhuw';
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

// CLOUDINARY_URL形式の場合はパース
if (process.env.CLOUDINARY_URL) {
  const match = process.env.CLOUDINARY_URL.match(/cloudinary:\/\/(\d+):([^@]+)@(.+)/);
  if (match) {
    process.env.CLOUDINARY_API_KEY = match[1];
    process.env.CLOUDINARY_API_SECRET = match[2];
    process.env.CLOUDINARY_CLOUD_NAME = match[3];
  }
}

const apiKey = process.env.CLOUDINARY_API_KEY || API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET || API_SECRET;
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || CLOUD_NAME;

if (!apiKey || !apiSecret) {
  console.error('エラー: Cloudinary APIキーが設定されていません');
  console.error('');
  console.error('使用方法:');
  console.error('  CLOUDINARY_API_KEY=xxx CLOUDINARY_API_SECRET=yyy node scripts/migrate-cloudinary-to-prod.cjs');
  console.error('');
  console.error('または:');
  console.error('  CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME node scripts/migrate-cloudinary-to-prod.cjs');
  process.exit(1);
}

// 移動対象のフォルダ
const FOLDERS_TO_MIGRATE = [
  'companies',
  'recruit',
  'jobs',
  'lp'
];

// Basic認証ヘッダー
const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

/**
 * Cloudinary Admin APIを呼び出す
 */
function callCloudinaryAPI(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudinary.com',
      port: 443,
      path: `/v1_1/${cloudName}${path}`,
      method: method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`パースエラー: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * フォルダ内のリソースを取得
 */
async function getResourcesInFolder(folder, nextCursor = null) {
  let path = `/resources/image?prefix=${folder}/&max_results=100&type=upload`;
  if (nextCursor) {
    path += `&next_cursor=${nextCursor}`;
  }
  return callCloudinaryAPI('GET', path);
}

/**
 * リソースをリネーム（移動）
 */
async function renameResource(fromPublicId, toPublicId) {
  return callCloudinaryAPI('POST', '/image/rename', {
    from_public_id: fromPublicId,
    to_public_id: toPublicId,
    overwrite: false
  });
}

/**
 * メイン処理
 */
async function main() {
  console.log('===========================================');
  console.log('Cloudinary 画像移動スクリプト');
  console.log(`Cloud Name: ${cloudName}`);
  console.log('===========================================\n');

  let totalMoved = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const folder of FOLDERS_TO_MIGRATE) {
    console.log(`\n[${folder}] フォルダをスキャン中...`);

    let nextCursor = null;
    let folderCount = 0;

    do {
      try {
        const result = await getResourcesInFolder(folder, nextCursor);
        const resources = result.resources || [];

        for (const resource of resources) {
          const publicId = resource.public_id;

          // すでにprod/またはdev/で始まっている場合はスキップ
          if (publicId.startsWith('prod/') || publicId.startsWith('dev/')) {
            console.log(`  スキップ: ${publicId} (既に環境フォルダ内)`);
            totalSkipped++;
            continue;
          }

          // 新しいpublic_id
          const newPublicId = `prod/${publicId}`;

          try {
            console.log(`  移動中: ${publicId} -> ${newPublicId}`);
            await renameResource(publicId, newPublicId);
            folderCount++;
            totalMoved++;

            // レート制限対策
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (err) {
            console.error(`  エラー: ${publicId} - ${err.message}`);
            totalErrors++;
          }
        }

        nextCursor = result.next_cursor;
      } catch (err) {
        console.error(`  フォルダスキャンエラー: ${err.message}`);
        break;
      }
    } while (nextCursor);

    console.log(`[${folder}] 完了: ${folderCount}件移動`);
  }

  console.log('\n===========================================');
  console.log('完了');
  console.log(`  移動: ${totalMoved}件`);
  console.log(`  スキップ: ${totalSkipped}件`);
  console.log(`  エラー: ${totalErrors}件`);
  console.log('===========================================');
}

main().catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
