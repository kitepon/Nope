// Nope — UI locale helper.
// Catalogs live here so content scripts and popup share one lookup without a build step.
// Browser language comes from chrome.i18n.getUILanguage() when the extension API exists,
// otherwise navigator.language. Shipped locales: en (default) and ja.
// Contract: docs/adr/0001-ui-locale.md

'use strict';

const CB_I18N = (() => {
  const DEFAULT_LOCALE = 'en';
  const SUPPORTED = Object.freeze(['en', 'ja']);

  const ENTITY_KEYS = Object.freeze({
    store: 'entityStore',
    shop: 'entityShop',
    seller: 'entitySeller',
    channel: 'entityChannel',
    source: 'entitySource',
    ストア: 'entityStore',
    ショップ: 'entityShop',
    出品者: 'entitySeller',
    チャンネル: 'entityChannel',
    発信元: 'entitySource',
  });

  const MESSAGES = {
    en: {
      extName: 'Nope — Hide what you don\'t want to see',
      extDescription: 'Hide content from sources and keywords you choose, on the supported search and list pages.',
      extTitle: 'Nope',
      displayModeLegend: 'Blocked item display',
      displayModePlaceholder: 'Replace with placeholder',
      displayModeCollapse: 'Hide and collapse',
      site_aliexpress: 'AliExpress',
      site_rakuten: 'Rakuten Ichiba',
      site_yahoo_shopping: 'Yahoo! Shopping',
      site_yahoo_auctions: 'Yahoo Auctions',
      site_amazon: 'Amazon',
      site_youtube: 'YouTube',
      site_yahoo_news: 'Yahoo News',
      site_yahoo_japan: 'Yahoo! JAPAN',
      keywordPlaceholder: 'Keyword',
      addKeyword: 'Add',
      clearCache: 'Clear cache',
      remove: 'Remove',
      nameOnlyWarning: 'Matched by display name. Renames and other sources with the same name can miss or over-block',
      nameOnlyWarningTitle: 'This block uses the display name. A rename removes the block, and another source with the same name may be blocked by mistake',
      emptyBlocked: 'No blocked sources',
      emptyKeywords: 'No keywords yet',
      keywordAlreadyAdded: 'Already added',
      entityStore: 'store',
      entityShop: 'shop',
      entitySeller: 'seller',
      entityChannel: 'channel',
      entitySource: 'source',
      unblock: 'Unblock',
      blockThisEntity: '🚫 Block this $1',
      blockThisStore: '🚫 Block this store',
      blockThisSource: '🚫 Block this source',
      toggleBlock: 'Toggle block for $1',
      blockedToast: 'Blocked $1',
      unblockedToast: 'Unblocked $1',
      blockFailedToast: 'Could not change the block for $1',
      unblockedKeywordToast: 'Removed keyword “$1”',
      unblockFailed: 'Could not unblock',
      openBrand: 'Open kitepon.dev',
      keywordReason: 'Keyword: “$1”',
      sourceReason: 'Source: $1',
      unblockKeyword: 'Unblock keyword',
      unblockSource: 'Unblock source',
      resolutionFailed: 'Could not resolve identifier',
      resolutionFailedTitle: 'Block is unavailable for this $1 (identifier lookup failed. Reload the page to retry.)',
      targetUnconfirmed: 'Could not confirm the target',
      targetUnconfirmedTitle: 'Block cancelled because the target card could not be confirmed',
      targetRecheckFailedTitle: 'Block cancelled because the target card could not be rechecked',
      identifierFailedAria: 'Identifier lookup failed',
    },
    ja: {
      extName: 'Nope — 見たくないもの見せません',
      extDescription: '指定した発信元やキーワードをもとに、検索結果や一覧から見たくないコンテンツを隠します。',
      extTitle: 'Nope',
      displayModeLegend: 'ブロック済みの表示',
      displayModePlaceholder: 'ブロック表示に置き換え',
      displayModeCollapse: '非表示にして詰める',
      site_aliexpress: 'AliExpress',
      site_rakuten: '楽天市場',
      site_yahoo_shopping: 'Yahoo!ショッピング',
      site_yahoo_auctions: 'ヤフオク',
      site_amazon: 'Amazon',
      site_youtube: 'YouTube',
      site_yahoo_news: 'Yahoo ニュース',
      site_yahoo_japan: 'Yahoo! JAPAN',
      keywordPlaceholder: 'キーワード',
      addKeyword: '追加',
      clearCache: 'キャッシュクリア',
      remove: '削除',
      nameOnlyWarning: '⚠ 表示名で判定：改名・同名の別発信元に注意',
      nameOnlyWarningTitle: '表示名でブロックしているため、発信元が改名すると解除され、同名の別発信元も誤ってブロックする可能性があります',
      emptyBlocked: 'ブロック中の発信元はありません',
      emptyKeywords: 'キーワードは登録されていません',
      keywordAlreadyAdded: 'すでに登録済みです',
      entityStore: 'ストア',
      entityShop: 'ショップ',
      entitySeller: '出品者',
      entityChannel: 'チャンネル',
      entitySource: '発信元',
      unblock: 'ブロック解除',
      blockThisEntity: '🚫 この$1をブロック',
      blockThisStore: '🚫 このストアをブロック',
      blockThisSource: '🚫 発信元をブロック',
      toggleBlock: '$1 のブロックを切り替える',
      blockedToast: '$1 をブロックしました',
      unblockedToast: '$1 のブロックを解除しました',
      blockFailedToast: '$1 のブロック操作に失敗しました',
      unblockedKeywordToast: 'キーワード「$1」を解除しました',
      unblockFailed: '解除に失敗しました',
      openBrand: 'kitepon.dev を開く',
      keywordReason: 'キーワード：「$1」',
      sourceReason: '発信元：$1',
      unblockKeyword: 'キーワード解除',
      unblockSource: '発信元ブロック解除',
      resolutionFailed: '⚠ 識別子解決に失敗',
      resolutionFailedTitle: 'この$1のブロック操作は利用できません（識別子の解決に失敗しました。ページを再読み込みすると再試行します）',
      targetUnconfirmed: '⚠ 対象を確認できません',
      targetUnconfirmedTitle: '対象カードを確認できなかったため、ブロック操作を中止しました',
      targetRecheckFailedTitle: '対象カードを再確認できなかったため、ブロック操作を中止しました',
      identifierFailedAria: '識別子解決に失敗しました',
    },
  };

  function normalizeLanguageTag(lang) {
    if (lang == null) return '';
    return String(lang).trim().replace(/_/g, '-').toLowerCase();
  }

  /**
   * ja and ja-* select Japanese. Any other tag, including empty, selects English
   * until another catalog ships.
   * @param {string|null|undefined} lang
   * @returns {'en'|'ja'}
   */
  function selectLocale(lang) {
    const tag = normalizeLanguageTag(lang);
    if (tag === 'ja' || tag.startsWith('ja-')) return 'ja';
    return DEFAULT_LOCALE;
  }

  function detectLanguage() {
    if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getUILanguage === 'function') {
      try {
        const ui = chrome.i18n.getUILanguage();
        if (ui) return ui;
      } catch (_err) {
        // chrome.i18n can exist as a stub in tests without getUILanguage.
      }
    }
    if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
    return DEFAULT_LOCALE;
  }

  let currentLocale = selectLocale(detectLanguage());

  function setLocale(lang) {
    currentLocale = selectLocale(lang);
    return currentLocale;
  }

  function format(template, substitutions) {
    if (template == null) return '';
    if (substitutions == null || substitutions.length === 0) return String(template);
    return String(template).replace(/\$(\d+)/g, (_, n) => {
      const value = substitutions[Number(n) - 1];
      return value == null ? '' : String(value);
    });
  }

  function t(key, ...substitutions) {
    const catalog = MESSAGES[currentLocale] || MESSAGES[DEFAULT_LOCALE];
    const template = (catalog && catalog[key]) || MESSAGES[DEFAULT_LOCALE][key] || key;
    return format(template, substitutions);
  }

  function entity(entityLabel) {
    const key = ENTITY_KEYS[entityLabel] || ENTITY_KEYS.channel;
    return t(key);
  }

  function localeTag() {
    return currentLocale === 'ja' ? 'ja' : 'en';
  }

  function dateLocale() {
    return currentLocale === 'ja' ? 'ja-JP' : 'en';
  }

  function applyDocument(doc) {
    const root = doc && doc.documentElement;
    if (root) root.lang = localeTag();
    if (!doc || typeof doc.querySelectorAll !== 'function') return localeTag();
    for (const el of doc.querySelectorAll('[data-i18n]')) {
      el.textContent = t(el.getAttribute('data-i18n'));
    }
    for (const el of doc.querySelectorAll('[data-i18n-placeholder]')) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    }
    return localeTag();
  }

  return {
    DEFAULT_LOCALE,
    SUPPORTED,
    MESSAGES,
    ENTITY_KEYS,
    selectLocale,
    detectLanguage,
    setLocale,
    t,
    entity,
    getLocale: () => currentLocale,
    localeTag,
    dateLocale,
    applyDocument,
  };
})();
