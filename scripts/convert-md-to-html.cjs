#!/usr/bin/env node
/**
 * Markdown → HTML 変換スクリプト
 *
 * 機能:
 * - docs/ 内の全MDファイルをHTMLに変換
 * - .md リンクを .html に自動変換
 * - index.html を自動生成（全ファイルへのリンク付き）
 *
 * 使用方法:
 *   node scripts/convert-md-to-html.js
 */

const fs = require('fs');
const path = require('path');

// markedがない場合は簡易変換を使用
let marked;
try {
  marked = require('marked');
} catch (e) {
  marked = null;
}

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const OUTPUT_DIR = path.join(DOCS_DIR, 'html');

// カテゴリ設定
const CATEGORIES = {
  system: { name: 'システム設計', order: 1 },
  ui: { name: 'UI/UX設計', order: 2 },
  development: { name: '開発ガイド', order: 3 },
  todo: { name: 'TODO/計画', order: 4 },
  marketing: { name: 'マーケティング', order: 5 },
  '': { name: 'その他', order: 99 }
};

/**
 * MDファイルを再帰的に取得
 */
function getMdFiles(dir, baseDir = dir) {
  const files = [];

  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // htmlフォルダはスキップ
    if (entry.isDirectory() && entry.name === 'html') continue;

    if (entry.isDirectory()) {
      files.push(...getMdFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const relativePath = path.relative(baseDir, fullPath);
      files.push({
        mdPath: fullPath,
        relativePath: relativePath,
        htmlPath: relativePath.replace(/\.md$/, '.html')
      });
    }
  }

  return files;
}

/**
 * 簡易Markdown変換（markedがない場合のフォールバック）
 */
function simpleMarkdownToHtml(markdown) {
  let html = markdown;

  // ヘッダー
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // コードブロック
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

  // インラインコード
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 太字
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // リンク
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // リスト
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // 番号付きリスト
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // テーブル（簡易）
  html = html.replace(/\|(.+)\|/g, (match, content) => {
    const cells = content.split('|').map(c => c.trim());
    if (cells.every(c => /^[-:]+$/.test(c))) return ''; // セパレータ行は削除
    const tag = cells[0].startsWith('**') ? 'th' : 'td';
    return '<tr>' + cells.map(c => `<${tag}>${c.replace(/\*\*/g, '')}</${tag}>`).join('') + '</tr>';
  });
  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>');

  // 段落
  html = html.replace(/\n\n+/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // 空のタグを削除
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*<(h[1-6]|ul|ol|table|pre)/g, '<$1');
  html = html.replace(/<\/(h[1-6]|ul|ol|table|pre)>\s*<\/p>/g, '</$1>');

  return html;
}

/**
 * MDをHTMLに変換
 */
function convertMdToHtml(mdContent, title, relativePath) {
  // .md リンクを .html に変換
  let content = mdContent.replace(/\]\(([^)]+)\.md\)/g, ']($1.html)');

  // Mermaidコードブロックを一時的にプレースホルダーに置換
  const mermaidBlocks = [];
  content = content.replace(/```mermaid\n([\s\S]*?)```/g, (match, code) => {
    const index = mermaidBlocks.length;
    mermaidBlocks.push(code.trim());
    return `MERMAID_PLACEHOLDER_${index}`;
  });

  // Markdown → HTML変換
  let bodyHtml;
  if (marked) {
    bodyHtml = marked.parse(content);
  } else {
    bodyHtml = simpleMarkdownToHtml(content);
  }

  // Mermaidプレースホルダーを<div class="mermaid">に置換
  mermaidBlocks.forEach((code, index) => {
    const placeholder = `MERMAID_PLACEHOLDER_${index}`;
    const mermaidDiv = `<div class="mermaid">\n${code}\n</div>`;

    // pタグで囲まれている場合を先に処理（より具体的なパターン優先）
    bodyHtml = bodyHtml.replace(`<p>${placeholder}</p>`, mermaidDiv);
    // pタグの中にある場合（部分一致）
    bodyHtml = bodyHtml.replace(new RegExp(`<p>\\s*${placeholder}\\s*</p>`, 'g'), mermaidDiv);
    // 単独のプレースホルダー
    bodyHtml = bodyHtml.replace(placeholder, mermaidDiv);
  });

  // 相対パスからindex.htmlへのパスを計算
  const depth = relativePath.split('/').length - 1;
  const indexPath = depth > 0 ? '../'.repeat(depth) + 'index.html' : 'index.html';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - L-SET ドキュメント</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
      background: #fafafa;
    }
    .nav { margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #ddd; }
    .nav a { color: #0066cc; text-decoration: none; }
    .nav a:hover { text-decoration: underline; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 2em; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    h3 { color: #444; margin-top: 1.5em; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', 'Source Code Pro', 'Menlo', 'Consolas', monospace; }
    pre { background: #282c34; color: #abb2bf; padding: 15px; border-radius: 5px; overflow-x: auto; white-space: pre; font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', 'Source Code Pro', 'Menlo', 'Consolas', monospace; line-height: 1.4; }
    pre code { background: none; color: inherit; padding: 0; white-space: pre; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    a { color: #0066cc; }
    ul, ol { padding-left: 1.5em; }
    li { margin: 0.3em 0; }
    blockquote { border-left: 4px solid #0066cc; margin: 1em 0; padding-left: 1em; color: #666; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.9em; }
    .mermaid { background: white; padding: 20px; border-radius: 8px; margin: 1em 0; cursor: pointer; transition: box-shadow 0.2s; position: relative; }
    .mermaid:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .mermaid::after { content: '🔍 クリックで拡大'; position: absolute; bottom: 5px; right: 10px; font-size: 0.75em; color: #999; opacity: 0; transition: opacity 0.2s; }
    .mermaid:hover::after { opacity: 1; }
    .mermaid-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 9999; justify-content: center; align-items: center; }
    .mermaid-modal.active { display: flex; }
    .mermaid-modal-content { background: white; padding: 30px; border-radius: 12px; max-width: 95vw; max-height: 95vh; overflow: auto; position: relative; }
    .mermaid-modal-close { position: absolute; top: 10px; right: 15px; font-size: 24px; cursor: pointer; color: #666; z-index: 10; }
    .mermaid-modal-close:hover { color: #333; }
    .mermaid-modal-hint { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); color: #999; font-size: 0.85em; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      mermaid.initialize({ startOnLoad: true, theme: 'default', securityLevel: 'loose' });

      // モーダル要素を作成
      const modal = document.createElement('div');
      modal.className = 'mermaid-modal';
      modal.innerHTML = '<div class="mermaid-modal-content"><span class="mermaid-modal-close">&times;</span><div class="mermaid-modal-diagram"></div><div class="mermaid-modal-hint">クリックまたはEscキーで閉じる</div></div>';
      document.body.appendChild(modal);

      const modalContent = modal.querySelector('.mermaid-modal-diagram');
      const closeBtn = modal.querySelector('.mermaid-modal-close');

      // Mermaidクリックで拡大
      document.querySelectorAll('.mermaid').forEach(function(el) {
        el.addEventListener('click', function() {
          const svg = el.querySelector('svg');
          if (svg) {
            const clone = svg.cloneNode(true);
            clone.style.maxWidth = '100%';
            clone.style.height = 'auto';
            modalContent.innerHTML = '';
            modalContent.appendChild(clone);
            modal.classList.add('active');
          }
        });
      });

      // モーダルを閉じる
      closeBtn.addEventListener('click', function() { modal.classList.remove('active'); });
      modal.addEventListener('click', function(e) { if (e.target === modal) modal.classList.remove('active'); });
      document.addEventListener('keydown', function(e) { if (e.key === 'Escape') modal.classList.remove('active'); });
    });
  </script>
</head>
<body>
  <nav class="nav">
    <a href="${indexPath}">← 目次に戻る</a>
  </nav>
  ${bodyHtml}
  <div class="footer">
    <p>Generated from Markdown - L-SET Documentation</p>
  </div>
</body>
</html>`;
}

/**
 * index.html を自動生成
 */
function generateIndexHtml(files) {
  // カテゴリ別にグループ化
  const grouped = {};

  for (const file of files) {
    const parts = file.htmlPath.split('/');
    const category = parts.length > 1 ? parts[0] : '';
    const categoryInfo = CATEGORIES[category] || CATEGORIES[''];

    if (!grouped[category]) {
      grouped[category] = {
        name: categoryInfo.name,
        order: categoryInfo.order,
        files: []
      };
    }

    // タイトルを抽出（MDファイルの最初のH1）
    let title = file.htmlPath.replace('.html', '').split('/').pop();
    try {
      const mdContent = fs.readFileSync(file.mdPath, 'utf-8');
      const match = mdContent.match(/^#\s+(.+)$/m);
      if (match) title = match[1];
    } catch (e) {}

    grouped[category].files.push({
      path: file.htmlPath,
      title: title
    });
  }

  // カテゴリをソート
  const sortedCategories = Object.entries(grouped)
    .sort((a, b) => a[1].order - b[1].order);

  // HTML生成
  let categoriesHtml = '';
  for (const [category, data] of sortedCategories) {
    const filesHtml = data.files
      .sort((a, b) => a.title.localeCompare(b.title, 'ja'))
      .map(f => `          <li><a href="${f.path}">${f.title}</a></li>`)
      .join('\n');

    categoriesHtml += `
      <section class="category">
        <h2>${data.name}</h2>
        <ul>
${filesHtml}
        </ul>
      </section>`;
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>L-SET ドキュメント</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
      background: #fafafa;
    }
    h1 {
      color: #1a1a1a;
      border-bottom: 2px solid #0066cc;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    .category { margin-bottom: 30px; }
    .category h2 {
      color: #0066cc;
      font-size: 1.3em;
      margin-bottom: 10px;
      padding-left: 10px;
      border-left: 4px solid #0066cc;
    }
    .category ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 10px;
    }
    .category li {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 5px;
      transition: box-shadow 0.2s;
    }
    .category li:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .category a {
      display: block;
      padding: 12px 15px;
      color: #333;
      text-decoration: none;
    }
    .category a:hover { color: #0066cc; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 0.9em;
      text-align: center;
    }
    .generated-at { color: #999; font-size: 0.85em; }
  </style>
</head>
<body>
  <h1>L-SET ドキュメント</h1>
  ${categoriesHtml}
  <div class="footer">
    <p>L-SET Documentation</p>
    <p class="generated-at">Generated: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
  </div>
</body>
</html>`;
}

/**
 * メイン処理
 */
async function main() {
  console.log('='.repeat(50));
  console.log('Markdown → HTML 変換');
  console.log('='.repeat(50));
  console.log(`Source: ${DOCS_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('');

  // 出力ディレクトリを作成
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // MDファイルを取得
  const files = getMdFiles(DOCS_DIR);
  console.log(`${files.length} 件のMDファイルを検出`);
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  // 各ファイルを変換
  for (const file of files) {
    try {
      const mdContent = fs.readFileSync(file.mdPath, 'utf-8');

      // タイトルを抽出
      const titleMatch = mdContent.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : path.basename(file.relativePath, '.md');

      // HTML変換
      const html = convertMdToHtml(mdContent, title, file.htmlPath);

      // 出力先ディレクトリを作成
      const outputPath = path.join(OUTPUT_DIR, file.htmlPath);
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // 書き込み
      fs.writeFileSync(outputPath, html);
      console.log(`  Converted: ${file.htmlPath}`);
      successCount++;
    } catch (error) {
      console.error(`  Error: ${file.relativePath} - ${error.message}`);
      errorCount++;
    }
  }

  // index.html を生成
  console.log('');
  console.log('Generating index.html...');
  const indexHtml = generateIndexHtml(files);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), indexHtml);
  console.log('  Created: index.html');

  console.log('');
  console.log('='.repeat(50));
  console.log(`完了: ${successCount} 件成功, ${errorCount} 件失敗`);
  console.log(`index.html にすべてのドキュメントへのリンクを生成しました`);

  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
