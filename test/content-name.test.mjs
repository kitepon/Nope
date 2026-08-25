import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { loadI18n } from './helpers/vm-i18n.mjs';

const SRC = path.join(import.meta.dirname, '..', 'src', 'content-name.js');
const BRAND_URL = 'https://kitepon.dev/?utm_source=nope&utm_medium=chrome_extension&utm_campaign=nope-brand-link&utm_content=blocked-placeholder';

class FakeMutationObserver {
  observe() {}
}

function makeElement(tagName) {
  const element = {
    tagName,
    className: '',
    style: { display: '' },
    children: [],
    listeners: {},
    attributes: {},
    parent: null,
    textContent: '',
    appendChild(child) { child.parent = element; element.children.push(child); return child; },
    addEventListener(type, handler) { element.listeners[type] = handler; },
    setAttribute(name, value) { element.attributes[name] = value; },
    querySelector(selector) {
      const className = selector.startsWith('.') ? selector.slice(1) : selector;
      return element.children.find((child) => child.className === className) || null;
    },
    remove() {
      if (!element.parent) return;
      element.parent.children = element.parent.children.filter((child) => child !== element);
      element.parent = null;
    },
  };
  return element;
}

function findDescendant(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children || []) {
    const found = findDescendant(child, predicate);
    if (found) return found;
  }
  return null;
}

function loadContentName(cards, storage, consoleImpl = console) {
  const body = makeElement('body');
  const document = {
    body,
    createElement: (tag) => makeElement(tag),
    querySelectorAll: () => cards,
  };
  const context = vm.createContext({
    document,
    MutationObserver: FakeMutationObserver,
    setTimeout: () => 0,
    console: consoleImpl,
    chrome: { runtime: { getURL: (assetPath) => `chrome-extension://test/${assetPath}` } },
    CB_STORAGE: storage,
    CB_KEYWORD_FILTER: { matchesAny: () => false },
  });
  loadI18n(context, 'ja');
  vm.runInContext(readFileSync(SRC, 'utf8'), context);
  return { contentName: vm.runInContext('CB_NAME', context), document };
}

test('content-nameは初回スキャン0件を遅延描画として扱いwarnしない', async () => {
  const warnings = [];
  const storage = makeStorage();
  const { contentName } = loadContentName([], storage, {
    ...console,
    warn: (...args) => warnings.push(args),
  });

  await contentName.init({ storage, adapter: adapterFor(new Map()) }).start();

  assert.equal(warnings.length, 0, '正常なCSR遅延描画を拡張機能エラーとして記録している');
});

function makeStorage(initial = {}, initialKeywords = []) {
  let blocked = { ...initial };
  let keywords = [...initialKeywords];
  let sourceListener = null;
  let keywordListener = null;
  const additions = [];
  const keywordRemovals = [];
  return {
    additions,
    keywordRemovals,
    setBlocked(next) { blocked = { ...next }; },
    emitBlocked(next) { blocked = { ...next }; sourceListener(blocked); },
    async getBlockedSources() { return blocked; },
    async addBlockedSource(...args) {
      additions.push(args);
      const [, sourceId, name] = args;
      blocked = { ...blocked, [sourceId]: { name, nameOnly: args[3], addedAt: 1 } };
    },
    async removeBlockedSource(_siteKey, sourceId) {
      const next = { ...blocked };
      delete next[sourceId];
      blocked = next;
    },
    async getBlockedKeywords() { return [...keywords]; },
    async removeBlockedKeyword(siteKey, keyword) {
      keywordRemovals.push([siteKey, keyword]);
      keywords = keywords.filter((item) => item !== keyword);
    },
    async getDisplayMode() { return 'placeholder'; },
    onBlockedSourcesChanged(_siteKey, handler) { sourceListener = handler; },
    onBlockedKeywordsChanged(_siteKey, handler) { keywordListener = handler; },
    emitKeywords(next) { keywords = [...next]; keywordListener(keywords); },
    onDisplayModeChanged() {},
  };
}

function adapterFor(names) {
  return {
    siteKey: 'yahoo_news',
    cardSelector: '.card',
    getWrapper: (card) => card,
    resolver: { getSource: (card) => ({ sourceName: names.get(card) }) },
  };
}

test('Pattern Bは各未ブロックカードへhover/focus表示の発信元ボタンを注入する', async () => {
  const first = makeElement('article');
  const second = makeElement('article');
  const names = new Map([[first, '発信元A'], [second, '発信元B']]);
  const storage = makeStorage();
  const { contentName } = loadContentName([first, second], storage);

  await contentName.init({ storage, adapter: adapterFor(names) }).start();

  for (const card of [first, second]) {
    const button = card.querySelector('.cb-source-block-button');
    assert.ok(button);
    assert.equal(button.style.opacity, '0');
    assert.equal(button.style.pointerEvents, 'none');
    card.listeners.mouseenter();
    assert.equal(button.style.opacity, '1');
    card.listeners.mouseleave();
    assert.equal(button.style.opacity, '0');
    button.listeners.focus();
    assert.equal(button.style.opacity, '1');
    button.listeners.blur();
    assert.equal(button.style.opacity, '0');
  }
});

test('Pattern BボタンはnameOnly=trueで登録し、toast後にplaceholderだけを表示する', async () => {
  const card = makeElement('article');
  const names = new Map([[card, '西スポWEB OTTO!']]);
  const storage = makeStorage();
  const { contentName, document } = loadContentName([card], storage);
  await contentName.init({ storage, adapter: adapterFor(names) }).start();

  const button = card.querySelector('.cb-source-block-button');
  let prevented = false;
  let stopped = false;
  await button.listeners.click({
    preventDefault: () => { prevented = true; },
    stopPropagation: () => { stopped = true; },
  });

  assert.deepEqual(storage.additions, [['yahoo_news', '西スポWEB OTTO!', '西スポWEB OTTO!', true]]);
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  const placeholder = card.querySelector('.cb-blocked-placeholder');
  assert.ok(placeholder);
  assert.ok(findDescendant(placeholder, (el) => el.textContent === '発信元：西スポWEB OTTO!'));
  assert.ok(findDescendant(placeholder, (el) => el.textContent === '発信元ブロック解除'));
  assert.equal(button.style.display, 'none');
  assert.ok(document.body.children.some((child) => child.className === 'cb-toast'
    && child.textContent.includes('ブロックしました')));
});

test('Pattern B placeholderはロゴ込み画像全体をkitepon.devリンクにしhover/focus画像を切り替える', async () => {
  const card = makeElement('article');
  const sourceName = '西スポWEB OTTO!';
  const storage = makeStorage({ [sourceName]: { name: sourceName, nameOnly: true } });
  const { contentName } = loadContentName([card], storage);

  await contentName.init({ storage, adapter: adapterFor(new Map([[card, sourceName]])) }).start();

  const placeholder = card.querySelector('.cb-blocked-placeholder');
  const brandLink = findDescendant(placeholder, (element) => element.tagName === 'a');
  assert.ok(brandLink);
  assert.equal(brandLink.href, BRAND_URL);
  assert.equal(brandLink.target, '_blank');
  assert.equal(brandLink.rel, 'noopener');
  assert.equal(brandLink.attributes['aria-label'], 'kitepon.dev を開く');
  assert.equal(brandLink.children.length, 1);
  const art = brandLink.children[0];
  assert.equal(art.src, 'chrome-extension://test/assets/mascot-blocked.png');

  brandLink.listeners.mouseenter();
  assert.equal(art.src, 'chrome-extension://test/assets/mascot-blocked-hover.png');
  brandLink.listeners.focus();
  brandLink.listeners.mouseleave();
  assert.equal(art.src, 'chrome-extension://test/assets/mascot-blocked-hover.png');
  brandLink.listeners.blur();
  assert.equal(art.src, 'chrome-extension://test/assets/mascot-blocked.png');
});

test('Pattern Bのブロック済みカードは注入ボタンを出さず、解除後に初めて出す', async () => {
  const card = makeElement('article');
  const sourceName = '発信元A';
  const names = new Map([[card, sourceName]]);
  const storage = makeStorage({ [sourceName]: { name: sourceName, nameOnly: true, addedAt: 1 } });
  const { contentName } = loadContentName([card], storage);
  await contentName.init({ storage, adapter: adapterFor(names) }).start();

  assert.ok(card.querySelector('.cb-blocked-placeholder'));
  assert.equal(card.querySelector('.cb-source-block-button'), null);

  storage.emitBlocked({});
  assert.equal(card.querySelector('.cb-blocked-placeholder'), null);
  assert.ok(card.querySelector('.cb-source-block-button'));
});

test('キーワード一致は該当語を理由表示し、解除ボタンでそのキーワードを削除する', async () => {
  const card = makeElement('article');
  card.getBoundingClientRect = () => ({ height: 184 });
  const names = new Map([[card, '日刊スポーツ']]);
  const storage = makeStorage({}, ['玉川徹']);
  const adapter = {
    ...adapterFor(names),
    getTitle: () => '玉川徹氏が番組でコメント',
  };
  const keywordFilter = {
    matchesAny: (text, keywords) => keywords.some((keyword) => text.includes(keyword)),
  };
  const { contentName } = loadContentName([card], storage);

  await contentName.init({ storage, keywordFilter, adapter }).start();

  const placeholder = card.querySelector('.cb-blocked-placeholder');
  assert.ok(placeholder);
  assert.equal(card.style.height, '184px');
  assert.equal(placeholder.style.height, '100%');
  assert.ok(findDescendant(placeholder, (el) => el.textContent === 'キーワード：「玉川徹」'));
  assert.equal(findDescendant(placeholder, (el) => el.textContent === '発信元：日刊スポーツ'), null);

  const button = findDescendant(placeholder, (el) => el.textContent === 'キーワード解除');
  assert.ok(button);
  await button.listeners.click({ preventDefault() {}, stopPropagation() {} });

  assert.deepEqual(storage.keywordRemovals, [['yahoo_news', '玉川徹']]);
  assert.equal(card.querySelector('.cb-blocked-placeholder'), null);
  assert.equal(card.style.height, '');
  assert.ok(card.querySelector('.cb-source-block-button'));
});
