import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { I18N_SRC, loadI18n } from './helpers/vm-i18n.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const HAS_CJK = /[\u3040-\u30ff\u4e00-\u9fff]/;

function loadWith(globals) {
  const context = vm.createContext(globals);
  vm.runInContext(readFileSync(I18N_SRC, 'utf8'), context);
  return vm.runInContext('CB_I18N', context);
}

test('selectLocale maps ja* to Japanese and everything else to English', () => {
  const i18n = loadWith({});
  assert.equal(i18n.selectLocale('ja'), 'ja');
  assert.equal(i18n.selectLocale('ja-JP'), 'ja');
  assert.equal(i18n.selectLocale('ja_JP'), 'ja');
  assert.equal(i18n.selectLocale('ja-JP-mac'), 'ja');
  assert.equal(i18n.selectLocale('en'), 'en');
  assert.equal(i18n.selectLocale('en-US'), 'en');
  assert.equal(i18n.selectLocale('fr'), 'en');
  assert.equal(i18n.selectLocale('zh-CN'), 'en');
  assert.equal(i18n.selectLocale(''), 'en');
  assert.equal(i18n.selectLocale(undefined), 'en');
  assert.equal(i18n.selectLocale(null), 'en');
});

test('detectLanguage prefers chrome.i18n.getUILanguage over navigator.language', () => {
  const i18n = loadWith({
    chrome: { i18n: { getUILanguage: () => 'ja-JP' } },
    navigator: { language: 'en-US' },
  });
  assert.equal(i18n.detectLanguage(), 'ja-JP');
  assert.equal(i18n.getLocale(), 'ja');
});

test('detectLanguage falls back to navigator.language then English', () => {
  const fromNavigator = loadWith({ navigator: { language: 'fr-FR' } });
  assert.equal(fromNavigator.detectLanguage(), 'fr-FR');
  assert.equal(fromNavigator.getLocale(), 'en');

  const fromMissing = loadWith({});
  assert.equal(fromMissing.detectLanguage(), 'en');
  assert.equal(fromMissing.getLocale(), 'en');
});

test('English is the default catalog and Japanese stays complete', () => {
  const i18n = loadWith({});
  assert.equal(i18n.DEFAULT_LOCALE, 'en');
  assert.deepEqual([...i18n.SUPPORTED], ['en', 'ja']);
  assert.deepEqual(
    Object.keys(i18n.MESSAGES.en).sort(),
    Object.keys(i18n.MESSAGES.ja).sort(),
  );
  assert.ok(Object.keys(i18n.MESSAGES.en).length > 20);
});

test('every English UI string exists and is not leftover Japanese', () => {
  const i18n = loadWith({});
  const required = [
    'extName', 'extDescription', 'extTitle',
    'displayModeLegend', 'displayModePlaceholder', 'displayModeCollapse',
    'emptyBlocked', 'emptyKeywords', 'keywordAlreadyAdded',
    'blockThisStore', 'blockThisSource', 'blockThisEntity',
    'unblock', 'blockedToast', 'unblockedToast',
    'resolutionFailed', 'targetUnconfirmed',
  ];
  for (const key of required) {
    const value = i18n.MESSAGES.en[key];
    assert.equal(typeof value, 'string', key);
    assert.ok(value.length > 0, key);
    assert.equal(HAS_CJK.test(value), false, `${key} still contains Japanese: ${value}`);
  }
  for (const [key, value] of Object.entries(i18n.MESSAGES.en)) {
    assert.equal(typeof value, 'string', key);
    assert.ok(value.length > 0, key);
  }
});

test('t() substitutes placeholders in the selected locale', () => {
  const i18n = loadWith({});
  i18n.setLocale('en');
  assert.equal(i18n.t('blockedToast', 'Shop A'), 'Blocked Shop A');
  assert.equal(i18n.t('blockThisEntity', 'shop'), '🚫 Block this shop');
  i18n.setLocale('ja');
  assert.equal(i18n.t('blockedToast', 'Shop A'), 'Shop A をブロックしました');
  assert.equal(i18n.t('blockThisEntity', 'ショップ'), '🚫 このショップをブロック');
});

test('entity() maps adapter labels and English keys', () => {
  const i18n = loadWith({});
  i18n.setLocale('en');
  assert.equal(i18n.entity('ショップ'), 'shop');
  assert.equal(i18n.entity('出品者'), 'seller');
  assert.equal(i18n.entity('チャンネル'), 'channel');
  assert.equal(i18n.entity('shop'), 'shop');
  i18n.setLocale('ja');
  assert.equal(i18n.entity('shop'), 'ショップ');
  assert.equal(i18n.entity(undefined), 'チャンネル');
});

test('_locales catalogs match runtime extName, extDescription, and extTitle', () => {
  const i18n = loadWith({});
  for (const locale of ['en', 'ja']) {
    const chromeMessages = JSON.parse(
      readFileSync(path.join(repoRoot, '_locales', locale, 'messages.json'), 'utf8'),
    );
    for (const key of ['extName', 'extDescription', 'extTitle']) {
      assert.equal(chromeMessages[key].message, i18n.MESSAGES[locale][key], `${locale} ${key}`);
    }
  }
});

test('manifest uses chrome.i18n placeholders and default_locale en', () => {
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.default_locale, 'en');
  assert.equal(manifest.name, '__MSG_extName__');
  assert.equal(manifest.description, '__MSG_extDescription__');
  assert.equal(manifest.action.default_title, '__MSG_extTitle__');
  for (const entry of manifest.content_scripts) {
    if (entry.world === 'MAIN') continue;
    assert.ok(entry.js.includes('src/i18n.js'), `${entry.matches} is missing src/i18n.js`);
    const i18nIndex = entry.js.indexOf('src/i18n.js');
    const firstUserScript = entry.js.findIndex((file) => (
      file.startsWith('src/content-') || file.startsWith('src/adapters/')
    ));
    if (firstUserScript >= 0) {
      assert.ok(i18nIndex < firstUserScript, `${entry.matches} loads i18n after UI scripts`);
    }
  }
});

test('popup HTML is locale-neutral and filled by data-i18n keys', () => {
  const html = readFileSync(path.join(repoRoot, 'popup', 'popup.html'), 'utf8');
  assert.match(html, /src="\.\.\/src\/i18n\.js"/);
  assert.match(html, /data-i18n="displayModeLegend"/);
  assert.match(html, /data-i18n="addKeyword"/);
  assert.match(html, /data-i18n-placeholder="keywordPlaceholder"/);
  assert.doesNotMatch(html, /ブロック済みの表示/);
  assert.doesNotMatch(html, /キャッシュクリア/);
});

test('loadI18n helper can pin Japanese for existing UI tests', () => {
  const context = vm.createContext({});
  const i18n = loadI18n(context, 'ja');
  assert.equal(i18n.getLocale(), 'ja');
  assert.equal(i18n.t('unblock'), 'ブロック解除');
});
