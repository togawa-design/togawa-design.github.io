/**
 * 全テンプレートのスクリーンショットを撮影するスクリプト
 * 使用方法: node scripts/capture-templates.js
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LAYOUT_STYLES = [
  { id: 'default', name: 'デフォルト' },
  { id: 'yellow', name: 'イエロー' },
  { id: 'impact', name: 'インパクト' },
  { id: 'trust', name: '信頼' },
  { id: 'bold', name: 'ボールド' },
  { id: 'elegant', name: 'エレガント' },
  { id: 'playful', name: 'ポップ' },
  { id: 'corporate', name: 'コーポレート' },
  { id: 'magazine', name: 'マガジン' },
  { id: 'athome', name: 'アットホーム' },
  { id: 'local', name: '地域密着' }
];

const JOB_ID = 'hajime123_1';
const BASE_URL = 'http://localhost:3004';
const OUTPUT_DIR = path.join(__dirname, '../screenshots');

async function captureTemplates() {
  // 出力ディレクトリを作成
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('ブラウザを起動中...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // ビューポートサイズを設定（デスクトップ）
  await page.setViewport({
    width: 1440,
    height: 900,
    deviceScaleFactor: 2
  });

  for (const style of LAYOUT_STYLES) {
    console.log(`\n📸 ${style.name} (${style.id}) を撮影中...`);

    try {
      // LPページにアクセス（layoutStyleパラメータ付き）
      const url = `${BASE_URL}/lp.html?j=${JOB_ID}&preview=1&layoutStyle=${style.id}`;
      console.log(`   URL: ${url}`);

      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // ページが完全に読み込まれるまで待機
      try {
        await page.waitForSelector('.lp-hero', { timeout: 10000 });
      } catch (e) {
        console.log(`   ⚠️  .lp-heroが見つからないため、.lp-contentを待機...`);
        try {
          await page.waitForSelector('#lp-content', { timeout: 5000 });
        } catch (e2) {
          console.log(`   ⚠️  #lp-contentも見つからない、現状でキャプチャ`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 2000));

      // フルページスクリーンショット
      const filename = `${style.id}-${style.name}.png`;
      const filepath = path.join(OUTPUT_DIR, filename);

      await page.screenshot({
        path: filepath,
        fullPage: true
      });

      console.log(`   ✅ 保存完了: ${filename}`);

    } catch (error) {
      console.error(`   ❌ エラー: ${error.message}`);
    }
  }

  // モバイル版も撮影
  console.log('\n\n📱 モバイル版を撮影中...');
  await page.setViewport({
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    isMobile: true
  });

  for (const style of LAYOUT_STYLES) {
    console.log(`\n📸 ${style.name} (${style.id}) モバイル版を撮影中...`);

    try {
      const url = `${BASE_URL}/lp.html?j=${JOB_ID}&preview=1&layoutStyle=${style.id}`;

      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      try {
        await page.waitForSelector('.lp-hero', { timeout: 10000 });
      } catch (e) {
        try {
          await page.waitForSelector('#lp-content', { timeout: 5000 });
        } catch (e2) {
          // 無視
        }
      }
      await new Promise(resolve => setTimeout(resolve, 2000));

      const filename = `${style.id}-${style.name}-mobile.png`;
      const filepath = path.join(OUTPUT_DIR, filename);

      await page.screenshot({
        path: filepath,
        fullPage: true
      });

      console.log(`   ✅ 保存完了: ${filename}`);

    } catch (error) {
      console.error(`   ❌ エラー: ${error.message}`);
    }
  }

  await browser.close();
  console.log(`\n\n🎉 完了！スクリーンショットは ${OUTPUT_DIR} に保存されました。`);
}

captureTemplates().catch(console.error);
