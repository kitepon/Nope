import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const screenshots = [
  'screenshot-01-placeholder.png',
  'screenshot-02-block-source.png',
  'screenshot-03-manage.png',
  'screenshot-04-display-modes.png',
  'screenshot-05-supported-and-private.png',
];

const rawCaptures = [
  '01-placeholder-raw.png',
  '02-block-control-raw.png',
  '02-blocked-result-raw.png',
  '03-popup-raw.png',
  '04-collapse-raw.png',
];

function pngHeader(buffer) {
  assert.deepEqual(
    [...buffer.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    'PNG signature must be valid',
  );
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
  };
}

test('Store screenshots are five full-size 8-bit RGB PNGs', async () => {
  for (const filename of screenshots) {
    const header = pngHeader(await readFile(`assets/store/${filename}`));
    assert.deepEqual(header, {
      width: 1280,
      height: 800,
      bitDepth: 8,
      colorType: 2,
    }, filename);
  }
});

test('Store icon and small promo match the dashboard dimensions', async () => {
  const promo = pngHeader(await readFile('assets/store/small-promo-440x280.png'));
  assert.deepEqual(promo, {
    width: 440,
    height: 280,
    bitDepth: 8,
    colorType: 2,
  });

  const icon = pngHeader(await readFile('assets/store/store-icon-128.png'));
  assert.deepEqual(icon, {
    width: 128,
    height: 128,
    bitDepth: 8,
    colorType: 6,
  });
});

test('Every published visual has a retained raw browser source', async () => {
  const actual = new Set(await readdir('docs/evidence/store-v2.0.1'));
  for (const filename of rawCaptures) assert.ok(actual.has(filename), filename);

  const provenance = await readFile('docs/evidence/store-v2.0.1/README.md', 'utf8');
  assert.match(provenance, /Chrome for Testing 152\.0\.7977\.42/);
  assert.match(provenance, /manifest version: `2\.0\.1`/);
  assert.match(provenance, /実extension UIから操作した/);
});

test('listing references only the current five screenshots and current Store assets', async () => {
  const listing = await readFile('docs/store/listing.md', 'utf8');
  for (const filename of screenshots) assert.match(listing, new RegExp(filename.replaceAll('.', '\\.')));
  assert.match(listing, /assets\/store\/small-promo-440x280\.png/);
  assert.match(listing, /assets\/store\/store-icon-128\.png/);

  for (const oldAsset of ['ac3-placeholder.png', 'ac2-popup.png', 'ac5-collapse.png', 'ac3-unblock.png']) {
    assert.doesNotMatch(listing, new RegExp(oldAsset.replaceAll('.', '\\.')));
  }
});

test('listing, privacy, and submission checklist share the v2.0.1 data boundary', async () => {
  const [manifestText, listing, privacy, checklist] = await Promise.all([
    readFile('manifest.json', 'utf8'),
    readFile('docs/store/listing.md', 'utf8'),
    readFile('docs/store/privacy.md', 'utf8'),
    readFile('docs/store/submission-checklist.md', 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.version, '2.0.1');
  assert.deepEqual(manifest.permissions, ['storage']);
  for (const entry of manifest.content_scripts) {
    for (const match of entry.matches) assert.ok(listing.includes(match), match);
  }

  for (const category of ['Authentication information', 'Web history', 'Website content']) {
    assert.ok(listing.includes(category), `listing: ${category}`);
    assert.ok(privacy.includes(category), `privacy: ${category}`);
    assert.ok(checklist.includes(category), `checklist: ${category}`);
  }

  assert.match(listing, /Remote code declaration[\s\S]*「はい、リモートコードを使用しています」/);
  assert.match(listing, /https:\/\/kitepon\.dev\/products\/nope\//);
  assert.match(listing, /https:\/\/github\.com\/kitepon\/Nope\/issues/);
  assert.match(listing, /一般公開済み/);
  assert.match(listing, /https:\/\/chromewebstore\.google\.com\/detail\/bodffbgmcokkhlibiehhelefknmbiaaf/);
  assert.doesNotMatch(listing, /再審査中/);
  assert.doesNotMatch(listing, /publishはこのlisting契約の作成範囲外であり、未実施/);
  assert.match(checklist, /Visibility: \*\*Public\*\*/);
  assert.match(checklist, /一般公開済み/);
  assert.match(checklist, /https:\/\/chromewebstore\.google\.com\/detail\/bodffbgmcokkhlibiehhelefknmbiaaf/);
  assert.match(checklist, /再審査中ではない/);
  assert.doesNotMatch(checklist, /Data usage 各項目: すべて「該当なし」/);
  assert.doesNotMatch(listing, /【対応サイト】/);
});
