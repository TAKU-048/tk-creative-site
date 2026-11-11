#!/usr/bin/env node
// tk-creative.org ブログのページを作る（2026-11-11 ユーザー指示：週1本の記事を自動公開）
// 使い方: node tools/blog/build.mjs
//   content/blog/*.md（記事の原稿）から site/tk-creative.org/blog/<slug>.html と blog/index.html を作る。
//   記事の最後には必ず月額ホームページ制作サービスのページへの案内を入れる（原稿に書かなくても入る）。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcDir = path.join(root, 'content/blog');
const outDir = path.join(root, 'site/tk-creative.org/blog');
const SITE = 'https://tk-creative.org';
const SERVICE = '../web-subscription.html';

export function parse(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${path.basename(file)}：先頭の --- で囲んだ設定がありません`);
  const meta = {};
  for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  for (const k of ['title', 'description', 'date', 'slug', 'category']) if (!meta[k]) throw new Error(`${path.basename(file)}：${k} がありません`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${path.basename(file)}：date は 2026-11-11 の形で`);
  if (!/^[a-z0-9-]+$/.test(meta.slug)) throw new Error(`${path.basename(file)}：slug は半角英小文字・数字・ハイフンのみ`);
  meta.draft = meta.draft === 'true';
  return { meta, body: m[2].trim(), file };
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function inline(t) {
  let s = esc(t);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, href) => {
    const ext = /^https?:\/\//.test(href);
    return `<a href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}>${txt}</a>`;
  });
  return s;
}
// 原稿の書き方（簡単なMarkdown）：## 見出し / ### 小見出し / - 箇条書き / 1. 番号つき / 空行で段落 / **強調** / [文字](URL) / > 注記
export function render(body) {
  const blocks = body.split(/\n{2,}/); const out = []; const toc = [];
  for (const b of blocks) {
    const lines = b.split('\n');
    if (/^## /.test(b)) { const t = b.slice(3).trim(); const id = 's' + (toc.length + 1); toc.push({ id, t }); out.push(`<h2 id="${id}">${inline(t)}</h2>`); }
    else if (/^### /.test(b)) out.push(`<h3>${inline(b.slice(4).trim())}</h3>`);
    else if (lines.every(l => /^- /.test(l))) out.push('<ul>' + lines.map(l => `<li>${inline(l.slice(2))}</li>`).join('') + '</ul>');
    else if (lines.every(l => /^\d+\. /.test(l))) out.push('<ol>' + lines.map(l => `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`).join('') + '</ol>');
    else if (lines.every(l => /^> /.test(l))) out.push(`<p class="note">${lines.map(l => inline(l.slice(2))).join('<br>')}</p>`);
    else out.push(`<p>${lines.map(inline).join('<br>')}</p>`);
  }
  return { html: out.join('\n'), toc };
}

const nav = (prefix) => `<nav id="tk-nav">
  <a class="nav-logo" href="${prefix}preview.html" aria-label="TK-creative トップページ"><img src="${prefix}tk-creative-logo-v2.png" alt="TK-creative" width="240" height="193"></a>
  <button class="svc-menu-btn" type="button" aria-expanded="false" aria-controls="svc-menu"><span class="svc-menu-bars" aria-hidden="true"></span>メニュー</button>
  <ul class="svc-menu" id="svc-menu">
    <li><a href="${prefix}preview.html">トップ</a></li>
    <li><a href="${prefix}web-subscription.html">ホームページ制作</a></li>
    <li><a href="${prefix}service-ai.html">AI業務効率化</a></li>
    <li><a href="${prefix}onepost.html">ONEPOST</a></li>
    <li><a href="${prefix}contact.html?service=web-subscription">お問い合わせ</a></li>
  </ul>
  <a class="nav-red" href="${prefix}web-subscription.html#free">【無料】構成案を受け取る</a>
</nav>`;
const foot = (prefix) => `<footer id="tk-footer">
  <div class="footer-logo"><img src="${prefix}tk-creative-logo-v2.png" alt="TK-creative" width="240" height="193"></div>
  <nav class="footer-nav"><a href="${prefix}preview.html">トップに戻る</a><a href="${prefix}web-subscription.html">月額ホームページ制作</a><a href="${prefix}blog/">ブログ</a><a href="${prefix}referral-partner.html">紹介パートナー制度</a><a href="${prefix}contact.html">お問い合わせ</a></nav>
  <p class="footer-copy">&copy; 2026 TK-creative. All rights reserved.</p>
</footer>
<script>(function(){var b=document.querySelector('.svc-menu-btn'),m=document.getElementById('svc-menu');if(!b||!m)return;function set(o){b.setAttribute('aria-expanded',String(o));m.classList.toggle('open',o)}b.addEventListener('click',function(){set(b.getAttribute('aria-expanded')!=='true')});m.addEventListener('click',function(e){if(e.target.closest('a'))set(false)});document.addEventListener('keydown',function(e){if(e.key==='Escape')set(false)})})();</script>`;
const head = (title, desc, url, prefix, extra = '') => `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="${extra ? 'article' : 'website'}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="${prefix}css/tk-pages.css">${extra}
</head>
<body>
<!-- このページは tools/blog/build.mjs が content/blog の原稿から作る。直接書き換えない -->`;
const jp = d => { const [y, m, dd] = d.split('-').map(Number); return `${y}年${m}月${dd}日`; };

export function pageFor(p) {
  const { meta } = p; const { html, toc } = render(p.body);
  const url = `${SITE}/blog/${meta.slug}.html`;
  const ld = `\n<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: meta.title, description: meta.description, datePublished: meta.date, author: { '@type': 'Organization', name: 'TK-creative.' }, publisher: { '@type': 'Organization', name: 'TK-creative.' }, mainEntityOfPage: url })}</script>`;
  const tocHtml = toc.length >= 3 ? `<nav class="toc" aria-label="目次"><b>目次</b><ol>${toc.map(t => `<li><a href="#${t.id}">${inline(t.t)}</a></li>`).join('')}</ol></nav>\n` : '';
  return `${head(meta.title + ' | TK-creative. ブログ', meta.description, url, '../', ld)}
${nav('../')}
<main>
<section class="ph">
  <div class="wrap">
    <p class="crumbs"><a href="./">ブログ</a> ／ ${esc(meta.category)}</p>
    <h1>${esc(meta.title)}</h1>
    <p>${esc(meta.description)}</p>
    <div class="post-meta"><time datetime="${meta.date}">${jp(meta.date)}</time><span>${esc(meta.category)}</span><span>TK-creative.</span></div>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    <article class="prose">
${tocHtml}${html}
    </article>
    <aside class="post-cta" data-service-cta>
      <h2>ホームページのこと、まとめて任せませんか？</h2>
      <p>TK-creative.の月額ホームページ制作は、初期制作費0円・月額9,600円（税別）。制作から公開後の更新・管理まで、まとめてお任せいただけます。</p>
      <a class="btn btn-red" href="${SERVICE}">月額ホームページ制作サービスを見る</a>
    </aside>
  </div>
</section>
</main>
${foot('../')}
</body>
</html>
`;
}

export function indexFor(posts) {
  const items = posts.map(p => `      <li><a href="${p.meta.slug}.html"><span class="cat">${esc(p.meta.category)}</span><h2>${esc(p.meta.title)}</h2><p>${esc(p.meta.description)}</p><time datetime="${p.meta.date}">${jp(p.meta.date)}</time></a></li>`).join('\n');
  return `${head('ブログ｜小さなお店のホームページとGoogleマップ集客 | TK-creative.', '小さなお店の経営者向けに、ホームページやGoogleマップ集客の悩みと、その解決のヒントをお届けします。', `${SITE}/blog/`, '../')}
${nav('../')}
<main>
<section class="ph">
  <div class="wrap">
    <span class="tag">ブログ</span>
    <h1>小さなお店の、<br><em>ホームページとGoogleマップ集客</em>。</h1>
    <p>小さなお店の経営者のみなさまに向けて、ホームページやGoogleマップ集客のよくある悩みと、その解決のヒントを毎週お届けします。</p>
  </div>
</section>
<section class="sec sec-gray">
  <div class="wrap">
    <ul class="posts">
${items || '      <li><p>記事は準備中です。</p></li>'}
    </ul>
  </div>
</section>
</main>
${foot('../')}
</body>
</html>
`;
}

export function loadPosts() {
  if (!fs.existsSync(srcDir)) return [];
  const posts = fs.readdirSync(srcDir).filter(f => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f)).map(f => parse(path.join(srcDir, f))).filter(p => !p.meta.draft);
  const slugs = new Set(); for (const p of posts) { if (slugs.has(p.meta.slug)) throw new Error(`slug が重複しています：${p.meta.slug}`); slugs.add(p.meta.slug); }
  return posts.sort((a, b) => b.meta.date.localeCompare(a.meta.date) || a.meta.slug.localeCompare(b.meta.slug));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const posts = loadPosts();
  fs.mkdirSync(outDir, { recursive: true });
  for (const p of posts) fs.writeFileSync(path.join(outDir, `${p.meta.slug}.html`), pageFor(p));
  fs.writeFileSync(path.join(outDir, 'index.html'), indexFor(posts));
  // 原稿が無くなった記事のページを残さない
  const keep = new Set(['index.html', ...posts.map(p => `${p.meta.slug}.html`)]);
  for (const f of fs.readdirSync(outDir)) if (f.endsWith('.html') && !keep.has(f)) fs.unlinkSync(path.join(outDir, f));
  console.log(`ブログを作りました：記事 ${posts.length} 本`);
}
