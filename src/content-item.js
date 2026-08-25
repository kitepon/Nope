// 商品ページ（*://*.aliexpress.com/item/*）にストアブロックボタンを注入する。
// storeId は a[href*="/store/"] の pathname から取る（mtop 非依存。実測: AGENTS.md参照）。
// 該当リンクは CSR 描画後に現れるため MutationObserver で待つ。
// CB_MD5・CB_STORAGE と同じく <script> 連結読み込み前提のグローバル公開（ビルド工程なし）。

'use strict';

const CB_ITEM = (() => {
  const STORE_LINK_SELECTOR = 'a[href*="/store/"]';
  const BUTTON_CLASS = 'cb-block-button';
  const TOAST_DURATION_MS = 2000;

  /** @param {string} href @returns {string|null} */
  function extractStoreId(href) {
    const match = href.match(/\/store\/(\d+)/);
    return match ? match[1] : null;
  }

  /** @param {{textContent: string}} link @param {string} storeId @returns {string} */
  function extractStoreName(link, storeId) {
    const cleaned = link.textContent.replace(/^販売者/, '').trim();
    return cleaned || `store:${storeId}`;
  }

  /** @param {{querySelectorAll: Function}} root */
  function findStoreLink(root) {
    for (const link of root.querySelectorAll(STORE_LINK_SELECTOR)) {
      const storeId = extractStoreId(link.getAttribute('href') || link.href || '');
      if (storeId) return { link, storeId, name: extractStoreName(link, storeId) };
    }
    return null;
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'cb-toast';
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#333', color: '#fff', padding: '8px 16px', borderRadius: '4px',
      zIndex: '2147483647', fontSize: '14px',
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), TOAST_DURATION_MS);
  }

  async function createButton(storeId, name) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = BUTTON_CLASS;
    Object.assign(button.style, {
      marginLeft: '8px', cursor: 'pointer', border: '1px solid #e53935',
      background: '#fff', color: '#e53935', borderRadius: '4px', padding: '4px 8px', fontSize: '12px',
    });

    async function refresh() {
      const blocked = await CB_STORAGE.getBlockedSources('aliexpress');
      button.textContent = blocked[storeId] ? CB_I18N.t('unblock') : CB_I18N.t('blockThisStore');
    }

    button.addEventListener('click', async () => {
      const blocked = await CB_STORAGE.getBlockedSources('aliexpress');
      if (blocked[storeId]) {
        await CB_STORAGE.removeBlockedSource('aliexpress', storeId);
        showToast(CB_I18N.t('unblockedToast', name));
      } else {
        await CB_STORAGE.addBlockedSource('aliexpress', storeId, name);
        showToast(CB_I18N.t('blockedToast', name));
      }
      await refresh();
    });

    await refresh();
    return button;
  }

  function init() {
    let injected = false;

    async function tryInject() {
      if (injected) return;
      const found = findStoreLink(document);
      if (!found) return;
      injected = true;
      const button = await createButton(found.storeId, found.name);
      found.link.insertAdjacentElement('afterend', button);
    }

    tryInject();
    const observer = new MutationObserver(() => {
      if (injected) { observer.disconnect(); return; }
      tryInject();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  return { extractStoreId, extractStoreName, findStoreLink, createButton, init };
})();

CB_ITEM.init();
