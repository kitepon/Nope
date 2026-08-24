// Nope — ブロックリスト管理画面。
// サイト別にグルーピングしたブロック済み発信元の一覧・削除と、
// キーワードブロックの登録・削除・表示モード切替を行う。
// popup context は content script と別実行環境なので、CB_STORAGE を popup.html から個別に読み込む。

'use strict';

const CB_POPUP = (() => {
  /** @param {string} siteKey @returns {string} */
  function siteLabel(siteKey) {
    const label = CB_I18N.t(`site_${siteKey}`);
    return label === `site_${siteKey}` ? siteKey : label;
  }

  /** @param {number} timestamp @returns {string} */
  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString(CB_I18N.dateLocale());
  }

  /** addedAt降順。 @param {Record<string, {name: string, addedAt: number, nameOnly?: boolean}>} entries */
  function sortEntries(entries) {
    return Object.entries(entries).sort((a, b) => b[1].addedAt - a[1].addedAt);
  }

  /**
   * 1サイト分のグループ（ヘッダー＋エントリ一覧）要素を作る。
   * @param {string} siteKey
   * @param {Record<string, {name: string, addedAt: number, nameOnly?: boolean}>} entries
   * @param {(sourceId: string) => Promise<void>} onRemove
   */
  function renderSiteGroup(siteKey, entries, onRemove) {
    const group = document.createElement('div');
    group.className = 'cb-site-group';

    const header = document.createElement('div');
    header.className = 'cb-site-header';
    const count = Object.keys(entries).length;
    header.textContent = siteLabel(siteKey);
    const countSpan = document.createElement('span');
    countSpan.className = 'cb-site-count';
    countSpan.textContent = `(${count})`;
    header.append(countSpan);
    group.append(header);

    const ul = document.createElement('ul');
    ul.className = 'cb-site-entries';
    for (const [sourceId, info] of sortEntries(entries)) {
      ul.append(renderSourceRow(sourceId, info, onRemove));
    }
    group.append(ul);
    return group;
  }

  /**
   * 1エントリ行を作る。nameOnly の場合は警告バッジを付ける。
   * @param {string} sourceId
   * @param {{name: string, addedAt: number, nameOnly?: boolean}} info
   * @param {(sourceId: string) => Promise<void>} onRemove
   */
  function renderSourceRow(sourceId, info, onRemove) {
    const li = document.createElement('li');
    li.className = 'cb-source-row';

    const label = document.createElement('span');
    label.className = 'cb-source-label';
    label.textContent = info.name;
    label.title = `${sourceId} — ${formatDate(info.addedAt)}`;
    li.append(label);

    if (info.nameOnly) {
      const warning = document.createElement('span');
      warning.className = 'cb-name-warning';
      warning.textContent = CB_I18N.t('nameOnlyWarning');
      warning.title = CB_I18N.t('nameOnlyWarningTitle');
      li.append(warning);
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = CB_I18N.t('remove');
    removeBtn.addEventListener('click', () => onRemove(sourceId));
    li.append(removeBtn);
    return li;
  }

  /**
   * すべてのサイトのブロック済み発信元を描画する。
   * 登録なしのサイトは表示しない。全サイト0件なら空メッセージを出す。
   * @param {HTMLElement} containerEl
   */
  async function renderBlockedList(containerEl) {
    const allBlocked = await CB_STORAGE.getAllBlockedSources();
    containerEl.replaceChildren();

    const activeSites = Object.entries(allBlocked).filter(
      ([, entries]) => Object.keys(entries).length > 0
    );

    if (activeSites.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'cb-empty';
      empty.textContent = CB_I18N.t('emptyBlocked');
      containerEl.append(empty);
      return;
    }

    for (const [siteKey, entries] of activeSites) {
      containerEl.append(
        renderSiteGroup(siteKey, entries, async (sourceId) => {
          await CB_STORAGE.removeBlockedSource(siteKey, sourceId);
          await renderBlockedList(containerEl);
        })
      );
    }
  }

  /**
   * 選択中サイトのキーワードリストを描画する。
   * @param {HTMLElement} listEl
   * @param {string} siteKey
   */
  async function renderKeywordList(listEl, siteKey) {
    const keywords = await CB_STORAGE.getBlockedKeywords(siteKey);
    listEl.replaceChildren();

    if (keywords.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'cb-keyword-empty';
      empty.textContent = CB_I18N.t('emptyKeywords');
      listEl.append(empty);
      return;
    }

    for (const keyword of keywords) {
      const li = document.createElement('li');
      li.className = 'cb-keyword-row';

      const text = document.createElement('span');
      text.className = 'cb-keyword-text';
      text.textContent = keyword;
      li.append(text);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = CB_I18N.t('remove');
      removeBtn.addEventListener('click', async () => {
        await CB_STORAGE.removeBlockedKeyword(siteKey, keyword);
        await renderKeywordList(listEl, siteKey);
      });
      li.append(removeBtn);
      listEl.append(li);
    }
  }

  /** @param {Array<{value:string,checked:boolean,addEventListener:Function}>} radios */
  async function bindDisplayModeControl(radios, storage) {
    const current = await storage.getDisplayMode();
    for (const radio of radios) {
      radio.checked = radio.value === current;
      radio.addEventListener('change', async () => {
        if (radio.checked) await storage.setDisplayMode(radio.value);
      });
    }
  }

  function init() {
    CB_I18N.applyDocument(document);
    document.title = CB_I18N.t('extTitle');

    const blockedListEl = document.getElementById('blocked-list');
    const keywordSiteEl = document.getElementById('keyword-site');
    const keywordFormEl = document.getElementById('keyword-form');
    const keywordInputEl = document.getElementById('keyword-input');
    const keywordListEl = document.getElementById('keyword-list');
    const keywordStatusEl = document.getElementById('keyword-status');
    const clearCacheBtn = document.getElementById('clear-cache');
    const displayModeRadios = document.querySelectorAll('input[name="display-mode"]');

    const currentKeywordSite = () => keywordSiteEl.value;

    keywordFormEl.addEventListener('submit', async (event) => {
      event.preventDefault();
      const keyword = keywordInputEl.value.trim();
      if (!keyword) return;
      const site = currentKeywordSite();
      const keywords = await CB_STORAGE.getBlockedKeywords(site);
      if (keywords.includes(keyword)) {
        keywordStatusEl.textContent = CB_I18N.t('keywordAlreadyAdded');
        return;
      }
      await CB_STORAGE.addBlockedKeyword(site, keyword);
      keywordInputEl.value = '';
      keywordStatusEl.textContent = '';
      await renderKeywordList(keywordListEl, site);
    });

    keywordSiteEl.addEventListener('change', async () => {
      keywordStatusEl.textContent = '';
      await renderKeywordList(keywordListEl, currentKeywordSite());
    });

    clearCacheBtn.addEventListener('click', async () => {
      await CB_STORAGE.clearCache();
    });

    bindDisplayModeControl(displayModeRadios, CB_STORAGE);
    renderBlockedList(blockedListEl);
    renderKeywordList(keywordListEl, currentKeywordSite());
  }

  return {
    siteLabel,
    formatDate,
    sortEntries,
    renderSiteGroup,
    renderSourceRow,
    renderBlockedList,
    renderKeywordList,
    bindDisplayModeControl,
    init,
  };
})();

CB_POPUP.init();
