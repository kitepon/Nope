// パターンB（表示名のみ）コンテンツスクリプトエンジン。
// Yahoo ニュース / Yahoo! JAPAN の2面で使用。
// 依存: CB_STORAGE, CB_KEYWORD_FILTER（連結読み込み順は v8a-manifest が管理する）
// パターンC（非同期解決）エンジン content-search.js とは別ファイル。
// 理由: パターンBは同期解決なので async queue が不要。面ごとに別 content_scripts エントリで動く。
// applyVisibility 系は content-search.js と同等のロジックをここにも持つ（共通化は将来課題）。
// CB_SEARCH と同じく <script> 連結読み込み前提のグローバル公開（ビルド工程なし・MV3 content_scripts）。

'use strict';

const CB_NAME = (() => {
  const DEFAULT_MODE = 'placeholder';
  const PLACEHOLDER_CLASS = 'cb-blocked-placeholder';
  const SOURCE_BUTTON_CLASS = 'cb-source-block-button';
  const TOAST_CLASS = 'cb-toast';
  const TOAST_DURATION_MS = 2000;
  const MASCOT_IMAGE_PATH = 'assets/mascot-blocked.png';
  const MASCOT_HOVER_IMAGE_PATH = 'assets/mascot-blocked-hover.png';
  const MASCOT_DISPLAY_SIZE = 64;
  const BRAND_URL = 'https://kitepon.dev/?utm_source=nope&utm_medium=chrome_extension&utm_campaign=nope-brand-link&utm_content=blocked-placeholder';

  // kitepon.dev ブランド正典（color-system.md）。content-search.js と同値を維持すること。
  const COLOR_ORANGE = '#ef8d32';
  const COLOR_ORANGE_DEEP = '#a84400';
  const COLOR_INK = '#111b35';
  const COLOR_WHITE = '#fffef9';

  function getMascotImageUrl() {
    return chrome.runtime.getURL(MASCOT_IMAGE_PATH);
  }

  function getMascotHoverImageUrl() {
    return chrome.runtime.getURL(MASCOT_HOVER_IMAGE_PATH);
  }

  function buildBrandLink(art) {
    const link = document.createElement('a');
    link.href = BRAND_URL;
    link.target = '_blank';
    link.rel = 'noopener';
    link.title = 'kitepon.dev';
    link.setAttribute('aria-label', CB_I18N.t('openBrand'));
    Object.assign(link.style, {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      lineHeight: '0', cursor: 'pointer', borderRadius: '8px', flexShrink: '1',
    });
    let hovered = false;
    let focused = false;
    const updateArt = () => {
      art.src = hovered || focused ? getMascotHoverImageUrl() : getMascotImageUrl();
    };
    link.addEventListener('mouseenter', () => { hovered = true; updateArt(); });
    link.addEventListener('mouseleave', () => { hovered = false; updateArt(); });
    link.addEventListener('focus', () => { focused = true; updateArt(); });
    link.addEventListener('blur', () => { focused = false; updateArt(); });
    link.addEventListener('click', (event) => {
      if (event && event.stopPropagation) event.stopPropagation();
    });
    link.appendChild(art);
    return link;
  }

  const originalChildStateByWrapper = new WeakMap();

  function hideOriginalChildren(wrapper) {
    if (originalChildStateByWrapper.has(wrapper)) return;
    const children = Array.from(wrapper.children || []);
    const childStates = children.map((child) => ({ child, display: child.style ? child.style.display : '' }));
    const rectHeight = typeof wrapper.getBoundingClientRect === 'function'
      ? wrapper.getBoundingClientRect().height
      : 0;
    const measuredHeight = rectHeight || wrapper.offsetHeight || 0;
    originalChildStateByWrapper.set(wrapper, {
      childStates,
      height: wrapper.style.height || '',
      boxSizing: wrapper.style.boxSizing || '',
      overflow: wrapper.style.overflow || '',
    });
    if (measuredHeight > 0) {
      wrapper.style.height = `${Math.round(measuredHeight)}px`;
      wrapper.style.boxSizing = 'border-box';
      wrapper.style.overflow = 'hidden';
    }
    for (const { child } of childStates) {
      if (child.style) child.style.display = 'none';
    }
  }

  function restoreOriginalChildren(wrapper) {
    const state = originalChildStateByWrapper.get(wrapper);
    if (!state) return;
    for (const { child, display } of state.childStates) {
      if (child.style) child.style.display = display;
    }
    wrapper.style.height = state.height;
    wrapper.style.boxSizing = state.boxSizing;
    wrapper.style.overflow = state.overflow;
    originalChildStateByWrapper.delete(wrapper);
  }

  function buildPlaceholderElement(reason, onUnblock) {
    const reasonType = reason && reason.type === 'keyword' ? 'keyword' : 'source';
    const reasonValue = reason && typeof reason === 'object' ? reason.value : reason;
    const el = document.createElement('div');
    el.className = PLACEHOLDER_CLASS;
    Object.assign(el.style, {
      width: '100%', height: '100%', minHeight: '48px', display: 'flex', flexDirection: 'row',
      gap: '12px', alignItems: 'center', justifyContent: 'center', padding: '8px', textAlign: 'left',
      backgroundColor: COLOR_WHITE, border: `1px solid ${COLOR_ORANGE}`,
      borderRadius: '8px', boxSizing: 'border-box',
    });

    const art = document.createElement('img');
    art.src = getMascotImageUrl();
    art.width = MASCOT_DISPLAY_SIZE;
    art.height = MASCOT_DISPLAY_SIZE;
    art.alt = '';
    art.ariaHidden = 'true';
    Object.assign(art.style, {
      width: `${MASCOT_DISPLAY_SIZE}px`, height: `${MASCOT_DISPLAY_SIZE}px`,
      maxWidth: '24%', maxHeight: 'calc(100% - 8px)', objectFit: 'contain', flexShrink: '1',
    });
    el.appendChild(buildBrandLink(art));

    const content = document.createElement('div');
    Object.assign(content.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      justifyContent: 'center', minWidth: '0',
    });
    el.appendChild(content);

    const label = document.createElement('p');
    label.textContent = 'BLOCKED';
    Object.assign(label.style, {
      fontSize: '10px', letterSpacing: '0.14em', color: COLOR_ORANGE_DEEP,
      margin: '0', fontWeight: 'bold',
    });
    content.appendChild(label);

    if (reasonValue) {
      const reasonEl = document.createElement('p');
      reasonEl.textContent = reasonType === 'keyword'
        ? CB_I18N.t('keywordReason', reasonValue)
        : CB_I18N.t('sourceReason', reasonValue);
      Object.assign(reasonEl.style, { color: COLOR_INK, margin: '2px 0 0', fontSize: '12px' });
      content.appendChild(reasonEl);
    }

    const unblockBtn = document.createElement('button');
    unblockBtn.type = 'button';
    unblockBtn.textContent = reasonType === 'keyword' ? CB_I18N.t('unblockKeyword') : CB_I18N.t('unblockSource');
    Object.assign(unblockBtn.style, {
      marginTop: '4px', border: `1px solid ${COLOR_ORANGE}`, color: COLOR_ORANGE_DEEP,
      backgroundColor: 'transparent', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
    });
    unblockBtn.addEventListener('click', async (event) => {
      if (event) {
        if (event.preventDefault) event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
      }
      if (!onUnblock) return;
      unblockBtn.disabled = true;
      try {
        await onUnblock();
      } catch (error) {
        console.warn(`content-name: ${reasonType}ブロック解除に失敗しました value=${reasonValue}`, error);
        unblockBtn.textContent = CB_I18N.t('unblockFailed');
        unblockBtn.disabled = false;
      }
    });
    content.appendChild(unblockBtn);

    return el;
  }

  function insertPlaceholder(wrapper, reason, onUnblock) {
    const existing = wrapper.querySelector && wrapper.querySelector(`.${PLACEHOLDER_CLASS}`);
    if (existing && existing.remove) existing.remove();
    hideOriginalChildren(wrapper);
    const placeholder = buildPlaceholderElement(reason, onUnblock);
    if (wrapper.appendChild) wrapper.appendChild(placeholder);
  }

  function removePlaceholder(wrapper) {
    const placeholder = wrapper.querySelector && wrapper.querySelector(`.${PLACEHOLDER_CLASS}`);
    if (placeholder && placeholder.remove) placeholder.remove();
    restoreOriginalChildren(wrapper);
  }

  /**
   * @param {any} wrapper
   * @param {boolean} blocked
   * @param {{mode?: string, reason?: {type: 'source'|'keyword', value: string}, sourceName?: string, onUnblock?: Function}} [options]
   */
  function applyVisibility(wrapper, blocked, options) {
    if (!wrapper || !wrapper.style) return;
    const opts = options || {};
    const mode = opts.mode || DEFAULT_MODE;

    if (mode === 'collapse') {
      removePlaceholder(wrapper);
      wrapper.style.display = blocked ? 'none' : '';
      return;
    }

    wrapper.style.display = '';
    if (blocked) {
      insertPlaceholder(wrapper, opts.reason || opts.sourceName, opts.onUnblock);
    } else {
      removePlaceholder(wrapper);
    }
  }

  // ---- パターンBエンジン本体 ----

  /** @param {{document?: any, storage?: any, keywordFilter?: any, adapter: any}} deps */
  function init(deps) {
    const doc = (deps && deps.document) || document;
    const storage = (deps && deps.storage) || CB_STORAGE;
    const keywordFilter = (deps && deps.keywordFilter) || CB_KEYWORD_FILTER;
    const adapter = deps && deps.adapter;
    if (!adapter) throw new Error('content-name: init の deps.adapter が必要です');

    const { siteKey, cardSelector, getWrapper, resolver, getTitle } = adapter;

    const processedCards = new Set();
    const cardInfo = new Map(); // card -> { sourceName, wrapper }
    const buttonByCard = new Map();
    let blockedSources = {};
    let blockedKeywords = [];
    let displayMode = DEFAULT_MODE;
    let firstScanDone = false;

    function isSourceBlocked(sourceName) {
      return !!blockedSources[sourceName];
    }

    function findMatchingKeyword(card) {
      if (!blockedKeywords.length || !getTitle) return null;
      const title = getTitle(card);
      if (!title) return null;
      return blockedKeywords.find((keyword) => keywordFilter.matchesAny(title, [keyword])) || null;
    }

    function showToast(message) {
      const toast = doc.createElement('div');
      toast.className = TOAST_CLASS;
      toast.textContent = message;
      Object.assign(toast.style, {
        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        background: COLOR_INK, color: COLOR_WHITE, padding: '8px 16px', borderRadius: '4px',
        zIndex: '2147483647', fontSize: '14px',
      });
      doc.body.appendChild(toast);
      setTimeout(() => toast.remove(), TOAST_DURATION_MS);
    }

    function ensureSourceButton(card, sourceName, wrapper) {
      let button = buttonByCard.get(card);
      if (button) return button;

      button = doc.createElement('button');
      button.type = 'button';
      button.className = SOURCE_BUTTON_CLASS;
      button.title = CB_I18N.t('toggleBlock', sourceName);
      button.setAttribute('aria-label', CB_I18N.t('toggleBlock', sourceName));
      Object.assign(button.style, {
        position: 'absolute', top: '6px', right: '6px', zIndex: '2147483646',
        cursor: 'pointer', border: `1px solid ${COLOR_ORANGE}`, background: COLOR_WHITE,
        color: COLOR_ORANGE_DEEP, borderRadius: '4px', padding: '4px 8px', fontSize: '12px',
        opacity: '0', pointerEvents: 'none', transition: 'opacity 120ms ease',
      });
      if (!wrapper.style.position) wrapper.style.position = 'relative';

      const show = () => { button.style.opacity = '1'; button.style.pointerEvents = 'auto'; };
      const hide = () => { button.style.opacity = '0'; button.style.pointerEvents = 'none'; };
      wrapper.addEventListener('mouseenter', show);
      wrapper.addEventListener('mouseleave', hide);
      button.addEventListener('focus', show);
      button.addEventListener('blur', hide);

      button.addEventListener('click', async (event) => {
        if (event) {
          if (event.preventDefault) event.preventDefault();
          if (event.stopPropagation) event.stopPropagation();
        }
        button.disabled = true;
        try {
          const current = await storage.getBlockedSources(siteKey);
          if (current[sourceName]) {
            await storage.removeBlockedSource(siteKey, sourceName);
            showToast(CB_I18N.t('unblockedToast', sourceName));
          } else {
            await storage.addBlockedSource(siteKey, sourceName, sourceName, true);
            showToast(CB_I18N.t('blockedToast', sourceName));
          }
          blockedSources = await storage.getBlockedSources(siteKey);
          for (const knownCard of processedCards) applyCardVisibility(knownCard);
        } catch (error) {
          console.warn(`content-name: 発信元ブロック操作に失敗しました siteKey=${siteKey} sourceName=${sourceName}`, error);
          showToast(CB_I18N.t('blockFailedToast', sourceName));
        } finally {
          button.disabled = false;
        }
      });

      wrapper.appendChild(button);
      buttonByCard.set(card, button);
      return button;
    }

    function applySourceButton(card, sourceName, wrapper, blocked) {
      const existing = buttonByCard.get(card);
      if (blocked) {
        if (existing) existing.style.display = 'none';
        return;
      }
      const button = ensureSourceButton(card, sourceName, wrapper);
      button.style.display = '';
      button.textContent = isSourceBlocked(sourceName) ? CB_I18N.t('unblock') : CB_I18N.t('blockThisSource');
    }

    function buildOptions(reason) {
      return {
        mode: displayMode,
        reason,
        onUnblock: async () => {
          if (reason.type === 'keyword') {
            await storage.removeBlockedKeyword(siteKey, reason.value);
            blockedKeywords = await storage.getBlockedKeywords(siteKey);
            showToast(CB_I18N.t('unblockedKeywordToast', reason.value));
          } else {
            await storage.removeBlockedSource(siteKey, reason.value);
            blockedSources = await storage.getBlockedSources(siteKey);
            showToast(CB_I18N.t('unblockedToast', reason.value));
          }
          for (const knownCard of processedCards) applyCardVisibility(knownCard);
        },
      };
    }

    function applyCardVisibility(card) {
      const info = cardInfo.get(card);
      if (!info) return;
      const { sourceName, wrapper } = info;
      const sourceBlocked = isSourceBlocked(sourceName);
      const matchedKeyword = findMatchingKeyword(card);
      const reason = sourceBlocked
        ? { type: 'source', value: sourceName }
        : matchedKeyword
          ? { type: 'keyword', value: matchedKeyword }
          : null;
      const blocked = !!reason;
      applyVisibility(wrapper, blocked, reason ? buildOptions(reason) : { mode: displayMode });
      applySourceButton(card, sourceName, wrapper, blocked);
    }

    function processCard(card) {
      if (processedCards.has(card)) return;
      processedCards.add(card);

      const result = resolver.getSource(card);
      if (!result) return;
      const { sourceName } = result;
      const wrapper = getWrapper(card);
      if (!wrapper) return;

      cardInfo.set(card, { sourceName, wrapper });
      applyCardVisibility(card);
    }

    function scan(root) {
      const cards = root.querySelectorAll(cardSelector);
      // 初回0件はCSR遅延描画や正当な空結果でも発生するため、selector破損とは判定しない。
      // 後続MutationObserverのscanで描画済みカードを処理する。
      for (const card of cards) processCard(card);
    }

    async function start() {
      [blockedSources, blockedKeywords, displayMode] = await Promise.all([
        storage.getBlockedSources(siteKey),
        storage.getBlockedKeywords(siteKey),
        storage.getDisplayMode(),
      ]);
      scan(doc);

      const observer = new MutationObserver(() => scan(doc));
      observer.observe(doc.body, { childList: true, subtree: true });

      storage.onBlockedSourcesChanged(siteKey, (next) => {
        blockedSources = next;
        for (const card of processedCards) applyCardVisibility(card);
      });

      storage.onBlockedKeywordsChanged(siteKey, (next) => {
        blockedKeywords = next;
        for (const card of processedCards) applyCardVisibility(card);
      });

      storage.onDisplayModeChanged((next) => {
        displayMode = next;
        for (const card of processedCards) applyCardVisibility(card);
      });
    }

    return { start, scan };
  }

  return { applyVisibility, init };
})();
