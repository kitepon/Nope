// popup.js の純粋ロジック（並び替え・サイトグルーピング・キーワードリスト）を検証する。
// 実際のDOM描画・拡張ロードはブラウザ実測停止指示により保留（AGENTS.md参照）。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { loadI18n } from './helpers/vm-i18n.mjs';

const SRC = path.join(import.meta.dirname, '..', 'popup', 'popup.js');

function makeFakeElement() {
  const listeners = {};
  const el = {
    textContent: '',
    title: '',
    className: '',
    type: '',
    children: [],
    append(...items) { el.children.push(...items); },
    addEventListener(type, handler) { listeners[type] = handler; },
    fireClick() { return listeners.click?.(); },
  };
  return el;
}

function makeFakeListEl() {
  const el = makeFakeElement();
  el.replaceChildren = () => { el.children = []; };
  return el;
}

function makeFakeStorage(initialBlocked = {}, initialKeywords = {}) {
  const blocked = { ...initialBlocked };
  const keywords = { ...initialKeywords };
  return {
    async getAllBlockedSources() {
      const out = {};
      for (const [k, v] of Object.entries(blocked)) out[k] = { ...v };
      return out;
    },
    async getBlockedSources(siteKey) { return { ...(blocked[siteKey] ?? {}) }; },
    async addBlockedSource(siteKey, sourceId, name) {
      if (!blocked[siteKey]) blocked[siteKey] = {};
      blocked[siteKey][sourceId] = { name, addedAt: 0 };
    },
    async removeBlockedSource(siteKey, sourceId) {
      if (blocked[siteKey]) delete blocked[siteKey][sourceId];
    },
    async getBlockedKeywords(siteKey) { return [...(keywords[siteKey] ?? [])]; },
    async addBlockedKeyword(siteKey, keyword) {
      if (!keywords[siteKey]) keywords[siteKey] = [];
      if (!keywords[siteKey].includes(keyword)) keywords[siteKey].push(keyword);
      return keywords[siteKey];
    },
    async removeBlockedKeyword(siteKey, keyword) {
      if (keywords[siteKey]) keywords[siteKey] = keywords[siteKey].filter((k) => k !== keyword);
      return keywords[siteKey] ?? [];
    },
    async getDisplayMode() { return 'placeholder'; },
    async setDisplayMode() {},
    _blocked: blocked,
    _keywords: keywords,
  };
}

function loadPopup(storage) {
  const context = vm.createContext({
    document: {
      documentElement: { lang: 'en' },
      title: '',
      getElementById: () => makeFakeListEl(),
      createElement: () => makeFakeElement(),
      querySelectorAll: () => [],
    },
    CB_STORAGE: storage ?? {
      getAllBlockedSources: async () => ({}),
      getBlockedKeywords: async () => [],
      getDisplayMode: async () => 'placeholder',
    },
  });
  loadI18n(context, 'ja');
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  return vm.runInContext('CB_POPUP', context);
}

test('sortEntriesはaddedAt降順に並べる', () => {
  const popup = loadPopup();
  const entries = {
    100: { name: 'old', addedAt: 1000 },
    200: { name: 'new', addedAt: 3000 },
    300: { name: 'mid', addedAt: 2000 },
  };
  const sorted = popup.sortEntries(entries);
  assert.deepEqual(Array.from(sorted, ([id]) => id), ['200', '300', '100']);
});

test('formatDateは文字列を返す', () => {
  const popup = loadPopup();
  const formatted = popup.formatDate(1786000000000);
  assert.equal(typeof formatted, 'string');
  assert.ok(formatted.length > 0);
});

test('siteLabelは主要サイトの日本語表示名を返す', () => {
  const popup = loadPopup();
  assert.equal(popup.siteLabel('aliexpress'), 'AliExpress');
  assert.equal(popup.siteLabel('youtube'), 'YouTube');
  assert.equal(popup.siteLabel('yahoo_news'), 'Yahoo ニュース');
  assert.equal(popup.siteLabel('yahoo_japan'), 'Yahoo! JAPAN');
});

test('renderBlockedListはブロック中の発信元がない時に空メッセージを出す', async () => {
  const popup = loadPopup(makeFakeStorage({}));
  const containerEl = makeFakeListEl();
  await popup.renderBlockedList(containerEl);
  assert.equal(containerEl.children.length, 1);
  assert.ok(containerEl.children[0].textContent.includes('ブロック中の発信元はありません'));
});

test('renderBlockedListはサイト別グループを描画する', async () => {
  const storage = makeFakeStorage({
    aliexpress: { '111': { name: 'AliStore', addedAt: 1000 } },
    rakuten: { 'shopA': { name: '楽天店A', addedAt: 2000 } },
  });
  const popup = loadPopup(storage);
  const containerEl = makeFakeListEl();
  await popup.renderBlockedList(containerEl);
  // 2サイト分のグループが生成される
  assert.equal(containerEl.children.length, 2);
});

test('renderBlockedListはエントリが0のサイトを表示しない', async () => {
  const storage = makeFakeStorage({
    aliexpress: { '111': { name: 'AliStore', addedAt: 1000 } },
    rakuten: {},
  });
  const popup = loadPopup(storage);
  const containerEl = makeFakeListEl();
  await popup.renderBlockedList(containerEl);
  assert.equal(containerEl.children.length, 1);
});

test('renderSourceRowはnameOnlyエントリに改名・同名誤ブロックの警告を付ける', () => {
  const popup = loadPopup();
  const row = popup.renderSourceRow(
    '西スポWEB OTTO!',
    { name: '西スポWEB OTTO!', addedAt: 1000, nameOnly: true },
    async () => {}
  );
  const warning = row.children.find((child) => child.className === 'cb-name-warning');
  assert.ok(warning, '表示名判定の警告が見つからない');
  assert.match(warning.textContent, /改名/);
  assert.match(warning.textContent, /同名の別発信元/);
  assert.match(warning.title, /解除/);
  assert.match(warning.title, /誤ってブロック/);
});

test('renderSourceRowはIDベースエントリにバッジを付けない', () => {
  const popup = loadPopup();
  const row = popup.renderSourceRow(
    'aidort',
    { name: '愛度楽天市場店', addedAt: 1000 },
    async () => {}
  );
  const hasWarning = row.children.some((child) => child.className === 'cb-name-warning');
  assert.ok(!hasWarning, 'IDベースエントリに表示名判定の警告が付いている');
});

test('renderKeywordListはキーワードがない時に空メッセージを出す', async () => {
  const storage = makeFakeStorage({}, {});
  const popup = loadPopup(storage);
  const listEl = makeFakeListEl();
  await popup.renderKeywordList(listEl, 'yahoo_news');
  assert.equal(listEl.children.length, 1);
  assert.ok(listEl.children[0].textContent.includes('キーワードは登録されていません'));
});

test('renderKeywordListはキーワードの一覧を描画する', async () => {
  const storage = makeFakeStorage({}, { yahoo_news: ['フェイクニュース', 'PR'] });
  const popup = loadPopup(storage);
  const listEl = makeFakeListEl();
  await popup.renderKeywordList(listEl, 'yahoo_news');
  assert.equal(listEl.children.length, 2);
  const texts = listEl.children.map((li) => li.children[0]?.textContent);
  assert.ok(texts.includes('フェイクニュース'));
  assert.ok(texts.includes('PR'));
});

function makeFakeRadio(value) {
  const listeners = {};
  return {
    value,
    checked: false,
    addEventListener(type, handler) { listeners[type] = handler; },
    fireChange() { return listeners.change(); },
  };
}

test('bindDisplayModeControlは現在のdisplayModeに応じてラジオのcheckedを設定する', async () => {
  const popup = loadPopup();
  const radios = [makeFakeRadio('placeholder'), makeFakeRadio('collapse')];
  const storage = { getDisplayMode: async () => 'collapse', setDisplayMode: async () => {} };
  await popup.bindDisplayModeControl(radios, storage);
  assert.equal(radios[0].checked, false);
  assert.equal(radios[1].checked, true);
});

test('bindDisplayModeControlはラジオのchangeでsetDisplayModeを呼ぶ', async () => {
  const popup = loadPopup();
  let savedMode = null;
  const radios = [makeFakeRadio('placeholder'), makeFakeRadio('collapse')];
  const storage = { getDisplayMode: async () => 'placeholder', setDisplayMode: async (mode) => { savedMode = mode; } };
  await popup.bindDisplayModeControl(radios, storage);
  radios[1].checked = true;
  await radios[1].fireChange();
  assert.equal(savedMode, 'collapse');
});

test('bindDisplayModeControlはcheckedでないラジオのchangeではsetDisplayModeを呼ばない', async () => {
  const popup = loadPopup();
  let called = false;
  const radios = [makeFakeRadio('placeholder'), makeFakeRadio('collapse')];
  const storage = { getDisplayMode: async () => 'placeholder', setDisplayMode: async () => { called = true; } };
  await popup.bindDisplayModeControl(radios, storage);
  await radios[1].fireChange();
  assert.equal(called, false);
});
