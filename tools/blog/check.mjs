#!/usr/bin/env node
// ブログ記事の公開前チェック（2026-11-11 ユーザー指示「公開前に日本語の誤りがないかチェック」）
// 使い方: node tools/blog/check.mjs [content/blog/<file>.md ...]（指定なしなら全記事）
// 機械的に見つけられる誤りをここで止める。文章の自然さ・誤字・敬語・事実の確認は、公開する AI が本文を読んで行う（docs/blog.md）。
// エラーが1件でもあれば終了コード1（公開しない）。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse, render, loadPosts} from './build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = process.argv.slice(2).length ? process.argv.slice(2).map(f => path.resolve(f)) : fs.readdirSync(path.join(root, 'content/blog')).filter(f => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f)).map(f => path.join(root, 'content/blog', f));
const jp = '[\\u3040-\\u30ff\\u4e00-\\u9fff]';
const rules = [
  [/。。|、、|！！|？？|，，|．．|。、|、。/, '句読点が重なっている'],
  [/([をがにでへ])\1(?![ゃゅょぁぃぅぇぉ])/, '助詞が重なっている（「をを」「にに」など）'],
  [/　/, '全角スペースが入っている'],
  [/[ｦ-ﾟ]/, '半角カタカナが使われている'],
  [new RegExp(`${jp}[!?]`), '日本語のあとに半角の「!」「?」'],
  [new RegExp(`${jp}[,.](?=${jp})`), '日本語の文中に半角の「,」「.」'],
  [new RegExp(`${jp} +${jp}`), '日本語の間に半角スペース'],
  [/[０-９]/, '全角数字（半角数字にそろえる）'],
  [/です。。|ます。。|でです|ますます|ですです/, '語尾の重なり'],
  [/TODO|FIXME|要確認|要決定|仮テキスト|ダミー|lorem|〇〇|○○|●●|XXX|undefined|null|NaN|\[object Object\]/i, '仮の文字・作業用の文字が残っている'],
];
const pairs = [['「', '」'], ['（', '）'], ['『', '』'], ['【', '】']];
let errors = 0, warns = 0; const out = [];
const err = (f, m) => { errors++; out.push(`[エラー] ${f}：${m}`); };
const warn = (f, m) => { warns++; out.push(`[注意] ${f}：${m}`); };
for (const file of files) {
  const name = path.basename(file);
  let p; try { p = parse(file); } catch (e) { err(name, e.message); continue; }
  const { meta, body } = p;
  const text = [meta.title, meta.description, body.replace(/\]\([^)]*\)/g, ']')].join('\n');
  text.split('\n').forEach((line, i) => {
    for (const [re, what] of rules) if (re.test(line)) err(name, `${what}（${i + 1}行目付近）：${line.trim().slice(0, 60)}`);
    for (const [a, b] of pairs) { const n1 = line.split(a).length - 1, n2 = line.split(b).length - 1; if (n1 !== n2) err(name, `「${a}${b}」の数が合わない（${i + 1}行目付近）：${line.trim().slice(0, 60)}`); }
  });
  // です・ます調にそろっているか（文末の「だ。」「である。」を拾う）
  const plain = body.match(/[^\n。]*(だ|である|だろう|ではない)。/g);
  if (plain) err(name, `です・ます調でない文末：${plain.slice(0, 3).map(s => s.trim().slice(-20)).join(' / ')}`);
  if ([...meta.title].length > 40) warn(name, `タイトルが長い（${[...meta.title].length}文字。32文字前後が目安）`);
  if ([...meta.description].length < 50 || [...meta.description].length > 130) warn(name, `説明文の長さ（${[...meta.description].length}文字。80〜120文字が目安）`);
  const { toc } = render(body);
  if (toc.length < 3) err(name, '「## 見出し」が3つ未満');
  const chars = [...body.replace(/\s/g, '')].length;
  if (chars < 1800) err(name, `本文が短い（${chars}文字。2,000文字以上）`);
  if (/web-subscription\.html/.test(body) === false) err(name, '本文の最後に月額ホームページ制作サービスのページ（../web-subscription.html）へのリンクがない');
  const last = body.trim().split(/\n{2,}/).slice(-2).join('\n');
  if (!/web-subscription\.html/.test(last)) err(name, '月額ホームページ制作サービスへのリンクが記事の最後（最後の2段落）にない');
  for (const m of body.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) if (!/^https:\/\//.test(m[1])) err(name, `http のリンク：${m[1]}`);
}
// slug の重複・日付
try { loadPosts(); } catch (e) { err('全体', e.message); }
console.log(out.join('\n') || '問題は見つかりませんでした。');
console.log(`エラー ${errors} 件／注意 ${warns} 件`);
process.exit(errors ? 1 : 0);
