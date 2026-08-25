// content-item.js の純粋ロジック（storeId/店名抽出、リンク探索）を検証する。
// 実ブラウザでのDOM注入・MutationObserver統合は agent-browser による実地確認で担保する（AGENTS.md参照）。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { loadI18n } from './helpers/vm-i18n.mjs';

const SRC = path.join(import.meta.dirname, '..', 'src', 'content-item.js');

class FakeMutationObserver {
  observe() {}
  disconnect() {}
}

function makeFakeElement() {
  const listeners = {};
  return {
    style: {},
    textContent: '',
    addEventListener(type, handler) { listeners[type] = handler; },
    fireClick() { return listeners.click(); },
  };
}

function makeFakeStorage(initialBlocked) {
  const sites = { aliexpress: { ...initialBlocked } };
  return {
    async getBlockedSources(siteKey) { return { ...sites[siteKey] }; },
    async addBlockedSource(siteKey, sourceId, name) {
      if (!sites[siteKey]) sites[siteKey] = {};
      sites[siteKey][sourceId] = { name, addedAt: 0 };
    },
    async removeBlockedSource(siteKey, sourceId) { delete sites[siteKey]?.[sourceId]; },
    // テスト検証用ヘルパー
    _getSite(siteKey) { return { ...sites[siteKey] }; },
  };
}

function loadContentItem(storage) {
  const context = vm.createContext({
    document: {
      querySelectorAll: () => [],
      body: { appendChild() {} },
      createElement: () => makeFakeElement(),
    },
    MutationObserver: FakeMutationObserver,
    setTimeout: () => {},
    CB_STORAGE: storage ?? { getBlockedSources: async () => ({}) },
  });
  loadI18n(context, 'ja');
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  return vm.runInContext('CB_ITEM', context);
}

test('extractStoreIdはhref中の/store/<id>を取り出す', () => {
  const item = loadContentItem();
  assert.equal(item.extractStoreId('https://ja.aliexpress.com/store/1100223114'), '1100223114');
  assert.equal(item.extractStoreId('//ja.aliexpress.com/store/1100223114'), '1100223114');
  assert.equal(item.extractStoreId('https://ja.aliexpress.com/item/123.html'), null);
});

test('extractStoreNameは「販売者」接頭辞を除去する', () => {
  const item = loadContentItem();
  assert.equal(item.extractStoreName({ textContent: '販売者NailNest Store' }, '1100223114'), 'NailNest Store');
  assert.equal(item.extractStoreName({ textContent: 'NailNest Store' }, '1100223114'), 'NailNest Store');
});

test('extractStoreNameはテキストが空ならstoreIdからフォールバック名を作る', () => {
  const item = loadContentItem();
  assert.equal(item.extractStoreName({ textContent: '' }, '1100223114'), 'store:1100223114');
});

test('findStoreLinkは最初にstoreIdが取れるリンクを返す', () => {
  const item = loadContentItem();
  const links = [
    { getAttribute: () => '/other/page', textContent: '' },
    { getAttribute: () => '//ja.aliexpress.com/store/1100223114', textContent: '販売者NailNest Store' },
    { getAttribute: () => '//ja.aliexpress.com/store/1100223114', textContent: 'NailNest Store' },
  ];
  const found = item.findStoreLink({ querySelectorAll: () => links });
  assert.equal(found.storeId, '1100223114');
  assert.equal(found.name, 'NailNest Store');
  assert.equal(found.link, links[1]);
});

test('findStoreLinkはstoreリンクが無ければnullを返す', () => {
  const item = loadContentItem();
  const found = item.findStoreLink({ querySelectorAll: () => [{ getAttribute: () => '/item/123.html', textContent: '' }] });
  assert.equal(found, null);
});

test('createButtonは未ブロックのstoreに「ブロック」ボタンを出す', async () => {
  const item = loadContentItem(makeFakeStorage({}));
  const button = await item.createButton('1100223114', 'NailNest Store');
  assert.equal(button.textContent, '🚫 このストアをブロック');
});

test('createButtonは既にブロック済みのstoreに「ブロック解除」ボタンを出す', async () => {
  const item = loadContentItem(makeFakeStorage({ 1100223114: { name: 'NailNest Store', addedAt: 0 } }));
  const button = await item.createButton('1100223114', 'NailNest Store');
  assert.equal(button.textContent, 'ブロック解除');
});

test('createButtonのクリックでブロック追加され表示がトグルする', async () => {
  const storage = makeFakeStorage({});
  const item = loadContentItem(storage);
  const button = await item.createButton('1100223114', 'NailNest Store');
  await button.fireClick();
  assert.deepEqual(storage._getSite('aliexpress'), { 1100223114: { name: 'NailNest Store', addedAt: 0 } });
  assert.equal(button.textContent, 'ブロック解除');
});

test('createButtonのクリックでブロック済みstoreは解除され表示が戻る', async () => {
  const storage = makeFakeStorage({ 1100223114: { name: 'NailNest Store', addedAt: 0 } });
  const item = loadContentItem(storage);
  const button = await item.createButton('1100223114', 'NailNest Store');
  await button.fireClick();
  assert.deepEqual(storage._getSite('aliexpress'), {});
  assert.equal(button.textContent, '🚫 このストアをブロック');
});
