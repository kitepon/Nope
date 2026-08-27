import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..');
const campaign = 'utm_source=nope&utm_medium=chrome_extension&utm_campaign=nope-brand-link';

test('導入後の2リンクは固定campaignでkitepon.dev rootへ戻る', () => {
  const search = readFileSync(path.join(repoRoot, 'src/content-search.js'), 'utf8');
  const name = readFileSync(path.join(repoRoot, 'src/content-name.js'), 'utf8');
  const popup = readFileSync(path.join(repoRoot, 'popup/popup.html'), 'utf8');

  assert.match(search, new RegExp(`${campaign}&utm_content=blocked-placeholder`));
  assert.match(name, new RegExp(`${campaign}&utm_content=blocked-placeholder`));
  assert.match(popup, /https:\/\/kitepon\.dev\/\?utm_source=nope&amp;utm_medium=chrome_extension&amp;utm_campaign=nope-brand-link&amp;utm_content=popup-footer/);
  assert.doesNotMatch(search, /const BRAND_URL = 'https:\/\/kitepon\.dev\/';/);
  assert.doesNotMatch(name, /const BRAND_URL = 'https:\/\/kitepon\.dev\/';/);
});

test('READMEはStore公開済みを示し、英語を先に置いて日本語入口も残す', () => {
  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const englishHeadings = ['In 5 seconds', 'Current distribution', 'How to use it', 'Seven service groups', 'Privacy, permissions, limits'];
  const japaneseHeadings = ['5秒でわかる', '現在の配布状態', '30秒の使い方', '対応する7サービス群・8対応面', 'プライバシー・権限・制限'];
  for (const heading of englishHeadings) assert.match(readme, new RegExp(`## ${heading}`));
  for (const heading of japaneseHeadings) assert.match(readme, new RegExp(`## ${heading}`));
  assert.ok(readme.indexOf('## In 5 seconds') < readme.indexOf('## 5秒でわかる'));
  assert.match(readme, /現行の公開packageはv2\.0\.2です/);
  assert.match(readme, /v2\.0\.2 is the current public package/);
  assert.match(readme, /live Chrome Web Store is \*\*v2\.0\.2\*\*/);
  assert.match(readme, /日本語listingと英語listingとも\*\*v2\.0\.2\*\*/);
  assert.doesNotMatch(readme, /next ship/);
  assert.doesNotMatch(readme, /次の提出版はv2\.0\.2です/);
  assert.doesNotMatch(readme, /v2\.0\.1のまま/);
  assert.doesNotMatch(readme, /still \*\*v2\.0\.1\*\*/);
  assert.match(readme, /https:\/\/chromewebstore\.google\.com\/detail\/bodffbgmcokkhlibiehhelefknmbiaaf/);
  assert.match(readme, /Load unpackedは開発者向けの確認手順/);
  assert.match(readme, /docs\/evidence\/r5-smoke-restored\.png/);
  assert.match(readme, /docs\/evidence\/r5-smoke-blocked\.png/);
  assert.doesNotMatch(readme, /審査中/);
  assert.doesNotMatch(readme, /再審査/);
  assert.doesNotMatch(readme, /installできると見せるリンクを置きません/);
  assert.doesNotMatch(readme, /\b\d{2,}%\b/);
});
