// AliExpress 検索結果ページで、ブロック済みストアの商品カードを displayMode に応じて2モードで処理する。
// 実証済み: カードは a.search-card-item、href の /item/(\d+)\.html から productId。
// カード自体にストア情報は無いため productId→storeId は CB_MTOP.resolveStoreId（cache優先）で解決する。
// 外側ラッパ（[class*="search-item-card-wrapper"] → .card-out-wrapper → parentElement の優先順で探索）を対象に、
// placeholder モード（既定）では中身をマスコット画像（assets/mascot-blocked.png、chrome.runtime.getURL経由で
// 拡張同梱リソースとして参照。web_accessible_resourcesへの登録が必要）を使ったプレースホルダーへ差し替え、
// collapse モードでは wrapper ごと display:none で完全に消す（displayMode は CB_STORAGE 経由で購読・即時再適用）。
// mtop への同時リクエストは 2 並列・間隔300ms に抑える（サーバ負荷/bot対策への配慮）。
// MutationObserver で無限スクロールと SPA 遷移に追従し、blockedSources/displayMode の onChanged で即時再適用する。
// 解決失敗カードは表示のままにし console.warn する（静かなフォールバック禁止＝黙って消さない）。
// CB_MD5・CB_STORAGE・CB_MTOP と同じく <script> 連結読み込み前提のグローバル公開（ビルド工程なし）。

'use strict';

const CB_SEARCH = (() => {
  const CARD_SELECTOR = 'a.search-card-item';
  const SEARCH_ITEM_CARD_WRAPPER_SELECTOR = '[class*="search-item-card-wrapper"]';
  const WRAPPER_SELECTOR = '.card-out-wrapper';
  const CONCURRENCY = 2;
  const INTERVAL_MS = 300;
  const DEFAULT_MODE = 'placeholder';
  const PLACEHOLDER_CLASS = 'cb-blocked-placeholder';

  // オーナー確定のマスコット画像（assets/mascot-source.pngをカード表示サイズへリサイズ済み）。
  // 拡張同梱リソースを chrome.runtime.getURL() 経由で参照する（外部URL禁止）。
  const MASCOT_IMAGE_PATH = 'assets/mascot-blocked.png';
  const MASCOT_HOVER_IMAGE_PATH = 'assets/mascot-blocked-hover.png';
  const MASCOT_DISPLAY_SIZE = 120;
  const BRAND_URL = 'https://kitepon.dev/?utm_source=nope&utm_medium=chrome_extension&utm_campaign=nope-brand-link&utm_content=blocked-placeholder';

  // kitepon.dev ブランド正典（color-system.md）の適用値。
  const COLOR_ORANGE = '#ef8d32'; // Discovery Orange: 枠・識別色
  const COLOR_ORANGE_DEEP = '#a84400'; // Deep Orange: 11px以下のlabel・解除ボタン文字
  const COLOR_INK = '#111b35'; // Ink: 本文（ストア名）
  const COLOR_WHITE = '#fffef9'; // White: card背景

  // docs/design-youtube-surfaces.md §3: dom_id resolver への resolver.register オプトインで
  // 未ブロックカードへ hover/focus 登録トグルボタンを注入する（content-name.js の
  // ensureSourceButton と同じUX）。resolver.register が無いアダプタ（rakuten等）は無関係。
  const REGISTER_BUTTON_CLASS = 'cb-search-register-button';

  // bell裁定2026-08-11[107]（オーナー実Chrome実測: カード内button挿入だと、YouTubeの管理DOM
  // 再描画でカードごと破棄されボタンも消える。初期23個→再描画後0個）。
  // resolver.register.mode === 'floating' のアダプタ（現状YouTubeのみ）だけ、カード内へは挿入せず
  // document.body直下に1個だけ生成する共有ボタンをhover/focus中のカードへ追従させる。
  // 既存のカード内挿入方式（ensureRegisterButton/applyRegisterButton、rakuten等が使う可能性のある
  // 汎用経路）はこの節の下に温存し、一切変更しない。
  const FLOATING_INSET_PX = 8;

  /** @returns {string} 拡張同梱のマスコット画像URL（chrome.runtime.getURL経由） */
  function getMascotImageUrl() {
    return chrome.runtime.getURL(MASCOT_IMAGE_PATH);
  }

  /** @returns {string} hover/focus時のマスコット画像URL */
  function getMascotHoverImageUrl() {
    return chrome.runtime.getURL(MASCOT_HOVER_IMAGE_PATH);
  }

  /** @param {any} art @returns {any} */
  function buildBrandLink(art) {
    const link = document.createElement('a');
    link.href = BRAND_URL;
    link.target = '_blank';
    link.rel = 'noopener';
    link.title = 'kitepon.dev';
    link.setAttribute('aria-label', CB_I18N.t('openBrand'));
    Object.assign(link.style, {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      lineHeight: '0', cursor: 'pointer', borderRadius: '8px',
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
      // カード本来の遷移だけを止め、kitepon.devリンクの既定動作は維持する。
      if (event && event.stopPropagation) event.stopPropagation();
    });
    link.appendChild(art);
    return link;
  }

  // placeholder挿入時に隠した元の子要素のdisplay値を退避しておく（DOM要素へ直接プロパティを生やさない）。
  const originalChildStateByWrapper = new WeakMap();

  /** @param {string} href @returns {string|null} */
  function extractProductId(href) {
    const match = (href || '').match(/\/item\/(\d+)\.html/);
    return match ? match[1] : null;
  }

  /** @param {{closest?: Function, parentElement?: any}} link @returns {any} */
  function findWrapper(link) {
    const bySearchCard = link.closest && link.closest(SEARCH_ITEM_CARD_WRAPPER_SELECTOR);
    if (bySearchCard) return bySearchCard;
    const byCardOut = link.closest && link.closest(WRAPPER_SELECTOR);
    if (byCardOut) return byCardOut;
    return link.parentElement || null;
  }

  /**
   * wrapperの元の子要素を退避してdisplay:noneで隠す（二重退避防止）。
   * docs/design-youtube-surfaces.md §5: 実測できた高さがあればwrapper自体に固定して
   * レイアウト崩れを防ぐ（content-name.jsのhideOriginalChildrenと同じロジック）。
   * 実測できない/0の場合はwrapperの高さには触れず、placeholder側の固定minHeightに任せる
   * （既存サイトの見た目は変えない）。
   * @param {any} wrapper
   */
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

  /** 退避した元の子要素のdisplayと、固定した高さを復元する。 @param {any} wrapper */
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

  /** @param {string} [sourceName] @param {Function} [onUnblock] @returns {any} */
  function buildPlaceholderElement(sourceName, onUnblock) {
    const el = document.createElement('div');
    el.className = PLACEHOLDER_CLASS;
    Object.assign(el.style, {
      minHeight: '220px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '12px', textAlign: 'center',
      backgroundColor: COLOR_WHITE, border: `1px solid ${COLOR_ORANGE}`,
      borderRadius: '8px', boxSizing: 'border-box',
    });

    const art = document.createElement('img');
    art.src = getMascotImageUrl();
    art.width = MASCOT_DISPLAY_SIZE;
    art.height = MASCOT_DISPLAY_SIZE;
    art.alt = ''; // 情報はlabel/ストア名側で伝えるため装飾画像として扱う
    art.ariaHidden = 'true';
    el.appendChild(buildBrandLink(art));

    const label = document.createElement('p');
    label.textContent = 'BLOCKED';
    Object.assign(label.style, {
      fontSize: '10px', letterSpacing: '0.14em', color: COLOR_ORANGE_DEEP,
      margin: '8px 0 0', fontWeight: 'bold',
    });
    el.appendChild(label);

    if (sourceName) {
      const nameEl = document.createElement('p');
      nameEl.textContent = sourceName; // XSS防止のためtextContentで入れる（innerHTMLに混ぜない）
      Object.assign(nameEl.style, { color: COLOR_INK, margin: '4px 0 0' });
      el.appendChild(nameEl);
    }

    const unblockBtn = document.createElement('button');
    unblockBtn.type = 'button';
    unblockBtn.textContent = CB_I18N.t('unblock');
    Object.assign(unblockBtn.style, {
      marginTop: '8px', border: `1px solid ${COLOR_ORANGE}`, color: COLOR_ORANGE_DEEP,
      backgroundColor: 'transparent', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
    });
    unblockBtn.addEventListener('click', (event) => {
      // カード全体が a タグのため、放置すると遷移してしまう。
      if (event) {
        if (event.preventDefault) event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
      }
      if (onUnblock) onUnblock();
    });
    el.appendChild(unblockBtn);

    return el;
  }

  /** @param {any} wrapper @param {string} [sourceName] @param {Function} [onUnblock] */
  function insertPlaceholder(wrapper, sourceName, onUnblock) {
    if (wrapper.querySelector && wrapper.querySelector(`.${PLACEHOLDER_CLASS}`)) return; // 二重挿入防止
    hideOriginalChildren(wrapper);
    const placeholder = buildPlaceholderElement(sourceName, onUnblock);
    if (wrapper.appendChild) wrapper.appendChild(placeholder);
  }

  /** @param {any} wrapper */
  function removePlaceholder(wrapper) {
    const placeholder = wrapper.querySelector && wrapper.querySelector(`.${PLACEHOLDER_CLASS}`);
    if (placeholder && placeholder.remove) placeholder.remove();
    restoreOriginalChildren(wrapper);
  }

  // docs/design-youtube-surfaces.md §3: 未ブロックカードへhover/focusで現れる登録トグルボタン。
  // content-name.js の ensureSourceButton と同じUX（opacity 0→1、position:absolute top-right）。

  /**
   * @param {any} doc @param {Map<any, any>} buttonByCard @param {any} card @param {any} anchor
   * @param {string} sourceId @param {string} sourceName @param {string} siteKey @param {any} storage
   * @param {Function} [resolveBeforeToggle] クリック時にsourceIdを確定させる非同期関数（省略時はsourceIdをそのまま使う）。
   *   rejectしたらブロック状態を変更せずonResolutionFailedを呼ぶ（部分登録禁止）。
   * @param {Function} [onResolutionFailed] resolveBeforeToggleが失敗した時に呼ぶ（可視エラーへの切替）。
   * @param {Function} onToggled
   */
  function ensureRegisterButton(doc, buttonByCard, card, anchor, sourceId, sourceName, siteKey, storage, resolveBeforeToggle, onResolutionFailed, onToggled) {
    let button = buttonByCard.get(card);
    if (button) return button;

    button = doc.createElement('button');
    button.type = 'button';
    button.className = REGISTER_BUTTON_CLASS;
    const label = sourceName || sourceId;
    button.title = CB_I18N.t('toggleBlock', label);
    if (button.setAttribute) button.setAttribute('aria-label', CB_I18N.t('toggleBlock', label));
    Object.assign(button.style, {
      position: 'absolute', top: '6px', right: '6px', zIndex: '2147483646',
      cursor: 'pointer', border: `1px solid ${COLOR_ORANGE}`, background: COLOR_WHITE,
      color: COLOR_ORANGE_DEEP, borderRadius: '4px', padding: '4px 8px', fontSize: '12px',
      opacity: '0', pointerEvents: 'none', transition: 'opacity 120ms ease',
    });
    if (!anchor.style.position) anchor.style.position = 'relative';

    const show = () => { button.style.opacity = '1'; button.style.pointerEvents = 'auto'; };
    const hide = () => { button.style.opacity = '0'; button.style.pointerEvents = 'none'; };
    if (anchor.addEventListener) {
      anchor.addEventListener('mouseenter', show);
      anchor.addEventListener('mouseleave', hide);
    }
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
        if (current[sourceId]) {
          // 既にこのIDでブロック済み: 解除は既知IDだけで完結する。もう一方の形式のalias解決は不要
          // （解除のために新たな通信を要求しない）。
          await storage.removeBlockedSource(siteKey, sourceId);
        } else {
          let resolvedSourceId = sourceId;
          if (resolveBeforeToggle) {
            try {
              resolvedSourceId = await resolveBeforeToggle();
            } catch (err) {
              console.warn(`content-search: クリック時の識別子解決に失敗しました siteKey=${siteKey}`, err);
              if (onResolutionFailed) onResolutionFailed();
              return;
            }
          }
          await storage.addBlockedSource(siteKey, resolvedSourceId, sourceName);
        }
        if (onToggled) await onToggled();
      } finally {
        button.disabled = false;
      }
    });

    if (anchor.appendChild) anchor.appendChild(button);
    buttonByCard.set(card, button);
    return button;
  }

  const RESOLUTION_ERROR_CLASS = 'cb-search-register-error';

  /**
   * resolver.canonicalize が失敗したカードへ、常時可視のエラーバッジを出す（登録操作は提供しない）。
   * docs/design-youtube-surfaces.md §2/§4-A: 部分登録へフォールバックせず、失敗をユーザーへ明示する。
   * @param {any} doc @param {Map<any, any>} badgeByCard @param {any} card @param {any} anchor
   */
  function ensureResolutionErrorBadge(doc, badgeByCard, card, anchor, entityLabel) {
    let badge = badgeByCard.get(card);
    if (badge) return badge;

    badge = doc.createElement('span');
    badge.className = RESOLUTION_ERROR_CLASS;
    badge.textContent = CB_I18N.t('resolutionFailed');
    badge.title = CB_I18N.t('resolutionFailedTitle', CB_I18N.entity(entityLabel));
    Object.assign(badge.style, {
      position: 'absolute', top: '6px', right: '6px', zIndex: '2147483646',
      border: '1px solid #b3261e', background: COLOR_WHITE, color: '#b3261e',
      borderRadius: '4px', padding: '4px 8px', fontSize: '11px', pointerEvents: 'none',
    });
    if (!anchor.style.position) anchor.style.position = 'relative';

    if (anchor.appendChild) anchor.appendChild(badge);
    badgeByCard.set(card, badge);
    return badge;
  }

  /**
   * 登録ボタンの表示/非表示を切り替える。ブロック中は隠す（未ブロックカードだけに出す）。
   * 識別子解決に失敗したカードは、ボタンの代わりに常時可視のエラーバッジを出す。
   * @param {{doc: any, buttonByCard: Map<any, any>, errorBadgeByCard: Map<any, any>, card: any,
   *   wrapper: any, resolveAnchor?: (card: any) => any, sourceId: string, sourceName: string,
   *   siteKey: string, storage: any, blocked: boolean, entityLabel?: string, resolutionFailed?: boolean,
   *   resolveBeforeToggle?: Function, onResolutionFailed?: Function, onToggled: Function}} deps
   */
  function applyRegisterButton(deps) {
    const {
      doc, buttonByCard, errorBadgeByCard, card, wrapper, resolveAnchor,
      sourceId, sourceName, siteKey, storage, blocked, entityLabel = 'channel', resolutionFailed,
      resolveBeforeToggle, onResolutionFailed, onToggled,
    } = deps;
    // アダプタがカード種別に応じたアンカーを自分で判定する（例: YouTubeは検索#dismissible／
    // ホーム#content を同じ関数内で優先順に試す）。指定が無い/見つからなければcard自体を使う。
    const anchor = (resolveAnchor && resolveAnchor(wrapper)) || wrapper;

    if (resolutionFailed) {
      const existingButton = buttonByCard.get(card);
      if (existingButton) existingButton.style.display = 'none';
      ensureResolutionErrorBadge(doc, errorBadgeByCard, card, anchor, entityLabel);
      return;
    }

    const existing = buttonByCard.get(card);
    if (blocked) {
      if (existing) existing.style.display = 'none';
      return;
    }
    const button = ensureRegisterButton(
      doc, buttonByCard, card, anchor, sourceId, sourceName, siteKey, storage,
      resolveBeforeToggle, onResolutionFailed, onToggled,
    );
    button.style.display = '';
    // docs/design-youtube-surfaces.md §3-3: 表示テキストは毎回のapply時に反映する
    // （content-name.jsのapplySourceButtonと同じ「呼ばれるたびにtextContentを設定する」パターン。
    // このブロックには常にblocked=falseの時しか到達しないが、CB_NAMEとの実装対称性のため
    // 分岐を残す——2026-08-11実Chrome smokeでtextContent未設定＝空欄ボタンの欠陥が出たため、
    // 「作る時に一度だけ」ではなく「出す時に毎回」設定する形にした）。
    button.textContent = blocked ? CB_I18N.t('unblock') : CB_I18N.t('blockThisEntity', CB_I18N.entity(entityLabel));
  }

  // ---- floating button方式（bell裁定[107]）: resolver.register.mode === 'floating' のアダプタだけ使う ----
  // カード内挿入(ensureRegisterButton/applyRegisterButton、上記)とは完全に独立した経路。
  // init()呼び出しごとに1組の状態を持つ（複数カードで1個のbuttonを共有する）。

  let floatingButton = null;
  let floatingHoverCard = null;
  let floatingHoverCtx = null;
  // bell裁定[133] B: 表示理由をpointer/focusで区別する。focus起因で表示中は、
  // card外の無関係なpointermoveでは隠さない（keyboardでTab focusしたボタンがマウスの
  // ジッターで消えるのを防ぐ）。focusout/blurで理由が消えた時だけ幾何判定またはhideへ戻す。
  let floatingHoverReason = null; // 'pointer' | 'focus' | null

  function hideFloatingButtonNow() {
    if (floatingButton) floatingButton.style.display = 'none';
    floatingHoverCard = null;
    floatingHoverCtx = null;
    floatingHoverReason = null;
  }

  /**
   * カード配下の「茶色いhover外周ハイライト」（`yt-touch-feedback-shape`、オーナー実測: カード各辺
   * より12px外側）のrectを探す。候補が複数ある場合（内部のメニューボタン用の小さいshape等）は、
   * card rect全体を包含するものだけを採用する。無ければnullを返しcard rectへfallbackさせる
   * （オーナー実測 2026-08-11: card L264 R722.33 T283.80 B619.61、
   * outer shape L252 R734.33 T271.80 B631.61）。
   * @param {any} card @returns {{left:number, top:number, right:number, bottom:number}|null}
   */
  function findOuterHighlightRect(card) {
    if (typeof card.getBoundingClientRect !== 'function' || typeof card.querySelectorAll !== 'function') return null;
    const cardRect = card.getBoundingClientRect();
    const shapes = card.querySelectorAll('yt-touch-feedback-shape');
    for (const shape of shapes) {
      if (typeof shape.getBoundingClientRect !== 'function') continue;
      const shapeRect = shape.getBoundingClientRect();
      // card rect全体を包含する候補だけを採用する（内部のmenuボタン等の小さいshapeを除外）。
      if (shapeRect.left <= cardRect.left && shapeRect.top <= cardRect.top
          && shapeRect.right >= cardRect.right && shapeRect.bottom >= cardRect.bottom) {
        return shapeRect;
      }
    }
    return null;
  }

  /** position:fixedのCSS right/bottomはlayout viewport（documentElement.clientWidth/Height、
   * スクロールバー幅を含まない）基準で解決される。window.innerWidth/Heightはvisual viewport
   * （スクロールバー込み）なので、これを使うとbuttonがスクロールバー幅ぶん内側へ寄る誤差が出る
   * （オーナー実機実測2026-08-11・bell裁定[147]: innerWidth=1710 vs clientWidth=1695、差15px）。
   * documentElementが無い/0の場合だけwindow.innerWidth/Heightへfallbackする。 */
  function getLayoutViewportSize(doc) {
    const docEl = doc && doc.documentElement;
    const win = typeof window !== 'undefined' ? window : null;
    const width = (docEl && docEl.clientWidth) || (win && win.innerWidth) || 0;
    const height = (docEl && docEl.clientHeight) || (win && win.innerHeight) || 0;
    return { width, height };
  }

  function positionFloatingButtonOverCard(doc, card) {
    if (!floatingButton || typeof card.getBoundingClientRect !== 'function') return;
    const rect = findOuterHighlightRect(card) || card.getBoundingClientRect();
    const { width: viewportWidth, height: viewportHeight } = getLayoutViewportSize(doc);
    floatingButton.style.top = '';
    floatingButton.style.left = '';
    floatingButton.style.right = `${Math.max(0, viewportWidth - rect.right + FLOATING_INSET_PX)}px`;
    floatingButton.style.bottom = `${Math.max(0, viewportHeight - rect.bottom + FLOATING_INSET_PX)}px`;
  }

  /**
   * pointer click時は共有buttonが保持していたctxを信用せず、実クリック地点（またはbutton中心）の
   * 下にある登録済みcardをelementsFromPointで再同定する。YouTubeのhover preview/DOM更新により
   * buttonの見た目とfloatingHoverCtxがずれた時、別チャンネルを登録する事故を防ぐ。
   * keyboard activation(detail===0)はfocusinで確定したcardを使う。
   */
  function resolveFloatingClickTarget(doc, event) {
    const current = floatingHoverCard && floatingHoverCtx
      ? { card: floatingHoverCard, ctx: floatingHoverCtx }
      : null;
    const pointerActivation = event && Number(event.detail) > 0;
    if (!pointerActivation) return current;
    if (!doc || typeof doc.elementsFromPoint !== 'function') return null;

    const points = [];
    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      points.push({ x: event.clientX, y: event.clientY });
    }
    if (floatingButton && typeof floatingButton.getBoundingClientRect === 'function') {
      const rect = floatingButton.getBoundingClientRect();
      points.push({ x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 });
    }

    for (const point of points) {
      const elements = doc.elementsFromPoint(point.x, point.y) || [];
      // 通常のChromeでは祖先card自体もelementsFromPointへ含まれるため、まず直接一致を優先する。
      for (const element of elements) {
        if (!floatingRegisteredCards.has(element)) continue;
        const ctx = floatingContextByCard.get(element);
        if (ctx) return { card: element, ctx };
      }
      // DOM構造差でcard自身が列挙されない場合だけ、列挙要素を包含する登録済みcardを探す。
      for (const element of elements) {
        for (const card of floatingRegisteredCards) {
          if (typeof card.contains !== 'function' || !card.contains(element)) continue;
          const ctx = floatingContextByCard.get(card);
          if (ctx) return { card, ctx };
        }
      }
    }
    return null;
  }

  /** クリック時のブロック/解除処理。ensureRegisterButtonのクリックハンドラと同じ契約
   * （安定IDのクリック時解決・部分登録禁止・即時反映）を、クリック地点で再同定したctxで実行する。 */
  async function handleFloatingButtonClick(doc, event) {
    if (event) {
      if (event.preventDefault) event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
    }
    const button = floatingButton;
    const target = resolveFloatingClickTarget(doc, event);
    if (!target) {
      console.warn('content-search: クリック地点の対象カードを再同定できませんでした。誤登録を防ぐため操作を中止します');
      if (button) {
        button.textContent = CB_I18N.t('targetUnconfirmed');
        button.title = CB_I18N.t('targetUnconfirmedTitle');
        button.disabled = true;
      }
      return;
    }
    const { card } = target;
    let { ctx } = target;
    if (ctx && typeof ctx.refreshBeforeToggle === 'function') {
      try {
        ctx = await ctx.refreshBeforeToggle();
      } catch (err) {
        console.warn('content-search: クリック直前の対象カード再検証に失敗しました。誤登録を防ぐため操作を中止します', err);
        button.textContent = CB_I18N.t('targetUnconfirmed');
        button.title = CB_I18N.t('targetRecheckFailedTitle');
        button.disabled = true;
        return;
      }
    }
    if (!ctx || ctx.resolutionFailed) return;
    if (card !== floatingHoverCard || ctx !== floatingHoverCtx) {
      showFloatingButtonForCard(doc, card, ctx, floatingHoverReason || 'pointer');
    }
    button.disabled = true;
    let keepDisabled = false;
    try {
      const current = await ctx.storage.getBlockedSources(ctx.siteKey);
      if (current[ctx.sourceId]) {
        await ctx.storage.removeBlockedSource(ctx.siteKey, ctx.sourceId);
      } else {
        let resolvedSourceId = ctx.sourceId;
        if (ctx.resolveBeforeToggle) {
          try {
            resolvedSourceId = await ctx.resolveBeforeToggle();
          } catch (err) {
            console.warn(`content-search: クリック時の識別子解決に失敗しました siteKey=${ctx.siteKey}`, err);
            keepDisabled = true;
            if (ctx.onResolutionFailed) ctx.onResolutionFailed();
            return;
          }
        }
        await ctx.storage.addBlockedSource(ctx.siteKey, resolvedSourceId, ctx.sourceName);
      }
      if (ctx.onToggled) await ctx.onToggled();
    } finally {
      if (!keepDisabled) button.disabled = false;
    }
  }

  function ensureFloatingButton(doc) {
    if (floatingButton) return floatingButton;
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = REGISTER_BUTTON_CLASS;
    Object.assign(button.style, {
      position: 'fixed', zIndex: '2147483647',
      cursor: 'pointer', border: `1px solid ${COLOR_ORANGE}`, background: COLOR_WHITE,
      color: COLOR_ORANGE_DEEP, borderRadius: '4px', padding: '4px 8px', fontSize: '12px',
      display: 'none',
    });
    // bell裁定[127]: mouse hoverの判定はdocument-level pointermoveの幾何判定に一本化した
    // （button自身のmouseleaveには依存しない。isPointInRectがbutton矩形も見るため、
    // pointerがbutton上にある間は自動的に維持される）。
    // bell裁定[119]: keyboardでbutton→cardへ戻るfocus移動もhover同様に保持する
    // （relatedTargetが直前のhover対象カードなら隠さない）。
    button.addEventListener('blur', (event) => {
      if (event && event.relatedTarget === floatingHoverCard) return;
      // bell裁定[133] B: focus理由が消えたら、直近のpointer位置で幾何判定へ戻す。
      floatingHoverReason = null;
      if (floatingPointerX === null || floatingPointerY === null) {
        hideFloatingButtonNow();
        return;
      }
      evaluateFloatingPointerHover(doc);
    });
    button.addEventListener('click', (event) => handleFloatingButtonClick(doc, event));
    if (doc.body && doc.body.appendChild) doc.body.appendChild(button);
    floatingButton = button;
    return button;
  }

  function showFloatingButtonForCard(doc, card, ctx, reason) {
    const button = ensureFloatingButton(doc);
    floatingHoverCard = card;
    floatingHoverCtx = ctx;
    floatingHoverReason = reason || 'pointer';
    positionFloatingButtonOverCard(doc, card);
    button.style.display = '';
    if (ctx.resolutionFailed) {
      const label = CB_I18N.t('identifierFailedAria');
      button.textContent = CB_I18N.t('resolutionFailed');
      button.title = CB_I18N.t('resolutionFailedTitle', CB_I18N.entity(ctx.entityLabel));
      if (button.setAttribute) button.setAttribute('aria-label', label);
      button.disabled = true;
    } else {
      const label = ctx.sourceName || ctx.sourceId;
      button.textContent = ctx.blocked ? CB_I18N.t('unblock') : CB_I18N.t('blockThisEntity', CB_I18N.entity(ctx.entityLabel));
      button.title = CB_I18N.t('toggleBlock', label);
      if (button.setAttribute) button.setAttribute('aria-label', CB_I18N.t('toggleBlock', label));
      button.disabled = false;
    }
  }

  const floatingContextByCard = new WeakMap();
  const floatingHoverAttached = new WeakSet();
  // bell裁定[127]: mouse hoverの判定はcard自身のmouseenter/mouseleaveに依存せず、
  // document-level pointermoveの幾何判定を正本にする（YouTube自身が生成するpreview overlay等が
  // card DOM構造の外側にあっても、pointer位置がcard矩形内である限りhoverを継続させるため）。
  // floatingRegisteredCardsはpointermove判定時に走査する対象カードの集合。
  const floatingRegisteredCards = new Set();

  /** disconnectしたカードをfloatingRegisteredCardsから取り除く（bell裁定[133] A・
   * mashiro監査[132]の確定欠陥修正）。強参照Setに残り続けるとGCされず、pointermoveのたびの
   * 走査コストも消えない。isConnectedのチェックだけを行い、getBoundingClientRectは呼ばない
   * （disconnect済み要素への再アクセスを避ける）。 */
  function pruneFloatingRegisteredCards() {
    for (const card of floatingRegisteredCards) {
      if (card.isConnected === false) floatingRegisteredCards.delete(card);
    }
  }

  /** カードへfocus保持リスナーを一度だけ付け、最新のctxをfloatingContextByCardへ保持する。
   * mouse hoverはpointermoveの幾何判定（evaluateFloatingPointerHover）が担当するため、
   * mouseenter/mouseleaveリスナーはここでは登録しない（bell裁定[127]）。
   * 現在floating buttonが対象カードを表示中なら内容を即時反映する（blocked状態の変化等に追従）。 */
  function applyFloatingRegisterButton(doc, card, wrapper, ctx) {
    floatingContextByCard.set(card, ctx);
    floatingRegisteredCards.add(card);
    ensureFloatingButton(doc); // hover前でもbody直下に(非表示で)1個だけ存在させる

    if (floatingHoverCard === card) {
      if (ctx.blocked && !ctx.resolutionFailed) {
        hideFloatingButtonNow();
      } else {
        // 表示中の理由（pointer/focus）は変えず、内容だけ最新化する。
        showFloatingButtonForCard(doc, card, ctx, floatingHoverReason);
      }
    }

    if (floatingHoverAttached.has(card)) return;
    floatingHoverAttached.add(card);

    const handleFocusIn = () => {
      const latestCtx = floatingContextByCard.get(card);
      if (!latestCtx) return;
      if (latestCtx.blocked && !latestCtx.resolutionFailed) return; // ブロック済みはplaceholder側の解除ボタンに委ねる
      showFloatingButtonForCard(doc, card, latestCtx, 'focus');
    };
    const handleFocusOut = (event) => {
      if (event && event.relatedTarget === floatingButton) return;
      // bell裁定[133] B: focus理由が消えたら、直近のpointer位置で幾何判定へ戻す
      // （pointerがまだcard/button矩形内ならそのまま表示維持、外なら隠す）。
      floatingHoverReason = null;
      if (floatingPointerX === null || floatingPointerY === null) {
        hideFloatingButtonNow();
        return;
      }
      evaluateFloatingPointerHover(doc);
    };
    if (wrapper.addEventListener) {
      wrapper.addEventListener('focusin', handleFocusIn);
      wrapper.addEventListener('focusout', handleFocusOut);
    }
  }

  /** @returns {boolean} 点(x,y)が矩形rect内にあるか */
  function isPointInRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  let floatingPointerX = null;
  let floatingPointerY = null;
  let floatingPointerRafScheduled = false;

  /** document-level pointermoveの幾何判定本体（bell裁定[127]）。
   * button矩形内→維持、現在のhover対象カード矩形内→維持、他の登録済みカード矩形内→切り替え、
   * どれにも該当しなければ隠す。card自身のmouseenter/mouseleaveイベントは一切見ない。 */
  function evaluateFloatingPointerHover(doc) {
    floatingPointerRafScheduled = false;
    // bell裁定[133] B: focus起因で表示中は、card外の無関係なpointermoveで隠さない。
    // focusout側がfloatingHoverReasonをnullへ戻してからこの関数を明示的に呼び直す。
    if (floatingHoverReason === 'focus') return;
    if (floatingPointerX === null || floatingPointerY === null) return;

    if (floatingButton && floatingButton.style.display !== 'none'
        && typeof floatingButton.getBoundingClientRect === 'function'
        && isPointInRect(floatingPointerX, floatingPointerY, floatingButton.getBoundingClientRect())) {
      return;
    }

    if (floatingHoverCard && typeof floatingHoverCard.getBoundingClientRect === 'function'
        && isPointInRect(floatingPointerX, floatingPointerY, floatingHoverCard.getBoundingClientRect())) {
      return;
    }

    for (const card of floatingRegisteredCards) {
      if (card.isConnected === false) continue;
      if (typeof card.getBoundingClientRect !== 'function') continue;
      const ctx = floatingContextByCard.get(card);
      if (!ctx || (ctx.blocked && !ctx.resolutionFailed)) continue;
      if (isPointInRect(floatingPointerX, floatingPointerY, card.getBoundingClientRect())) {
        showFloatingButtonForCard(doc, card, ctx, 'pointer');
        return;
      }
    }

    if (floatingHoverCard) hideFloatingButtonNow();
  }

  /** pointermoveのたびに毎回評価すると重いので、rAF（無ければsetTimeout）で1フレームに間引く。
   * bell裁定[133] C: window.requestAnimationFrameを変数へ代入して呼ぶとreceiverが外れ
   * unbound呼び出しになる（実装によってはIllegal invocationで例外）。必ずwindow経由で呼ぶ。 */
  function handleFloatingPointerMove(doc) {
    return (event) => {
      floatingPointerX = event.clientX;
      floatingPointerY = event.clientY;
      if (floatingPointerRafScheduled) return;
      floatingPointerRafScheduled = true;
      const schedule = (typeof window !== 'undefined' && window.requestAnimationFrame)
        ? (fn) => window.requestAnimationFrame(fn)
        : (fn) => setTimeout(fn, 16);
      schedule(() => evaluateFloatingPointerHover(doc));
    };
  }

  /** floating buttonの対象カードがdisconnect/不可視/viewport外になっていないか確認する
   * （bell裁定[107][119]）。widthやheightだけでなく、scroll移動でカードがviewport外へ完全に
   * 出た場合（bottom<=0やtop>=innerHeight等）も「もう見えていない」として扱う。 */
  function isFloatingTargetVisible(card) {
    if (card.isConnected === false) return false;
    if (typeof card.getBoundingClientRect !== 'function') return true;
    const rect = card.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const win = typeof window !== 'undefined' ? window : null;
    const viewportWidth = (win && win.innerWidth) || 0;
    const viewportHeight = (win && win.innerHeight) || 0;
    return rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
  }

  /**
   * @param {{style: {display: string}}} wrapper @param {boolean} blocked
   * @param {{mode?: string, storeName?: string, onUnblock?: Function}} [options]
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

    // placeholder モード: wrapper自体は常に表示のままにし、中身をプレースホルダーで覆う。
    wrapper.style.display = '';
    if (blocked) {
      insertPlaceholder(wrapper, opts.storeName, opts.onUnblock);
    } else {
      removePlaceholder(wrapper);
    }
  }

  // itemId→sourceId 解決を 2並列・間隔300msに抑えるキュー。
  // resolveStoreId は注入可能にして純粋にテストできるようにする。
  /** @param {{resolveStoreId: Function, concurrency?: number, intervalMs?: number, onIdle?: Function}} options */
  function createResolveQueue({ resolveStoreId, concurrency = CONCURRENCY, intervalMs = INTERVAL_MS, onIdle }) {
    const pending = [];
    let active = 0;
    let timer = null;

    function scheduleNext() {
      if (timer) return;
      timer = setTimeout(() => { timer = null; pump(); }, intervalMs);
    }

    function pump() {
      if (active >= concurrency || pending.length === 0) return;
      const job = pending.shift();
      active += 1;
      resolveStoreId(job.productId)
        .then((storeId) => job.onSettled(storeId, null))
        .catch((err) => job.onSettled(null, err))
        .finally(() => {
          active -= 1;
          if (pending.length) scheduleNext();
          else if (active === 0 && onIdle) onIdle();
        });
      if (pending.length && active < concurrency) scheduleNext();
    }

    /** @param {string} productId @param {(storeId: string|null, err: any) => void} onSettled */
    function enqueue(productId, onSettled) {
      pending.push({ productId, onSettled });
      pump();
    }

    return { enqueue };
  }

  /** @param {{pathname?: string}} pageLocation */
  function isAliExpressSearchPage(pageLocation) {
    return /^\/w(?:\/|$)/.test(pageLocation.pathname || '');
  }

  // AliExpress アダプタ（パターンC: 非同期解決）。
  // cardSelector は manifest.json content_scripts.matches に対応する面のカード要素。
  const ALIEXPRESS_ADAPTER = {
    siteKey: 'aliexpress',
    cardSelector: CARD_SELECTOR,
    // manifestは商品詳細のcontent-item.jsと共用なので広く注入するが、検索エンジンは一覧面だけで起動する。
    isTargetPage: isAliExpressSearchPage,
    getWrapper: (card) => findWrapper(card),
    resolver: {
      type: 'async_resolve',
      getItemId: (card) => extractProductId(card.getAttribute ? card.getAttribute('href') : card.href),
    },
  };

  /** @param {{document?: any, storage?: any, mtop?: any, adapter?: any}} [deps] */
  function init(deps) {
    const doc = (deps && deps.document) || document;
    const storage = (deps && deps.storage) || CB_STORAGE;
    const adapter = (deps && deps.adapter) || ALIEXPRESS_ADAPTER;
    const { siteKey, cardSelector, getWrapper, resolver } = adapter;
    if (!resolver || !['dom_id', 'async_resolve'].includes(resolver.type)) {
      throw new Error(`content-search: 未対応のresolver.typeです siteKey=${siteKey} type=${resolver && resolver.type}`);
    }

    // 同じ itemId が検索面の複数カードに現れることがある（Amazon の通常枠＋別枠など）。
    // itemId→単一cardでは片方だけに登録UI・ブロック表示が適用されるため、全インスタンスを保持する。
    const asyncCardsByItemId = new Map();
    const asyncStartedItemIds = new Set();
    const sourceIdByItemId = new Map();
    const sourceNameByItemId = new Map();
    const directCardInfo = new Map();
    const registerButtonByCard = new Map();
    const errorBadgeByCard = new Map();
    // docs/design-youtube-surfaces.md §2: resolver.canonicalize が居るアダプタでは、生のsourceId
    // （handle形式等）を正本ID（UC形式）へ解決してから保存・照合する。
    // room裁定2026-08-11（[46][51][52]）: 通信は「見るだけ」で発生してはならない。
    // スキャン時（カード描画時）は sourceAliases（chrome.storage.sync、端末間で共有）の
    // 既知の対応を参照するだけで、未知なら「未確認」のまま表示する（fetchしない）。
    // 実際にfetchが起きるのは、ユーザーが登録ボタンをクリックした時だけ。
    let sourceAliases = {};
    let blockedSources = {};
    let displayMode = DEFAULT_MODE;
    let resolvedSourceCount = 0;
    let noSourceCount = 0;
    let noSourceWarningSent = false;

    function warnIfAllSourcesMissing() {
      const policy = resolver.noSourceWarning;
      if (!policy || noSourceWarningSent || resolvedSourceCount > 0) return;
      const minimum = Number.isInteger(policy.minAttempts) ? policy.minAttempts : 1;
      if (noSourceCount < minimum) return;
      noSourceWarningSent = true;
      console.warn(
        `${policy.message || 'content-search: source不在が全件で続いています。resolver構造変更の可能性があります'} `
        + `siteKey=${siteKey} noSource=${noSourceCount} resolved=${resolvedSourceCount}`
      );
    }

    let queue = null;
    if (resolver.type === 'async_resolve') {
      let resolveSource;
      if (typeof resolver.resolveSource === 'function') {
        resolveSource = async (itemId) => {
          const source = await resolver.resolveSource(itemId);
          // nullはadapterが明示した「このitemに発信元が存在しない」という正常系。
          // undefinedやsourceId欠落は契約違反なので従来どおりthrowして個別warnへ送る。
          if (source === null) return null;
          if (!source || !source.sourceId) {
            throw new Error(`content-search: resolverがsourceIdを返しませんでした siteKey=${siteKey} itemId=${itemId}`);
          }
          await storage.setCachedSource(siteKey, itemId, source.sourceId, source.sourceName);
          return source;
        };
      } else {
        // AliExpressだけは既存のCB_MTOPが解決とキャッシュ保存を担当する。
        const mtop = (deps && deps.mtop) || CB_MTOP;
        resolveSource = async (itemId) => {
          const sourceId = await mtop.resolveStoreId(itemId);
          if (!sourceId) {
            throw new Error(`content-search: mtopがsourceIdを返しませんでした siteKey=${siteKey} itemId=${itemId}`);
          }
          return { sourceId, sourceName: '' };
        };
      }
      queue = createResolveQueue({ resolveStoreId: resolveSource, onIdle: warnIfAllSourcesMissing });
    }

    function isBlocked(sourceId) {
      return !!blockedSources[sourceId];
    }

    /** @param {string} sourceId @param {string} [sourceName] @returns {{mode: string, storeName: string, onUnblock: Function}} */
    function buildVisibilityOptions(sourceId, sourceName) {
      const info = blockedSources[sourceId];
      return {
        mode: displayMode,
        storeName: info ? info.name : (sourceName || ''),
        onUnblock: () => storage.removeBlockedSource(siteKey, sourceId),
      };
    }

    function applyKnown(itemId) {
      const sourceId = sourceIdByItemId.get(itemId);
      const sourceName = sourceNameByItemId.get(itemId) || '';
      const cards = asyncCardsByItemId.get(itemId);
      if (!sourceId || !cards) return;
      const blocked = isBlocked(sourceId);
      for (const [card, wrapper] of cards) {
        applyVisibility(wrapper, blocked, buildVisibilityOptions(sourceId, sourceName));
        if (resolver.register && card) {
          applyRegisterButton({
            doc, buttonByCard: registerButtonByCard, errorBadgeByCard, card, wrapper,
            resolveAnchor: resolver.register.anchor,
            sourceId, sourceName, siteKey, storage, blocked,
            entityLabel: resolver.register.entityLabel,
            onToggled: async () => {
              blockedSources = await storage.getBlockedSources(siteKey);
              applyKnown(itemId);
            },
          });
        }
      }
    }

    // 生sourceIdの正本ID（UC形式）を、既知のalias（同期済み）だけから引く。fetchはしない。
    // UC形式は既に正本。未知のhandle形式はnull（「まだ確認していない」）を返す。
    function knownCanonicalId(rawSourceId) {
      if (!resolver.canonicalize) return rawSourceId;
      if (rawSourceId.startsWith('UC')) return rawSourceId;
      return sourceAliases[rawSourceId] || null;
    }

    // このUC IDに対応する既知のhandleが既にsourceAliasesにあるか（逆引き）。
    function hasKnownHandleFor(canonicalUCId) {
      return Object.values(sourceAliases).includes(canonicalUCId);
    }

    // クリック時だけ呼ばれる。両方向とも「既知ならfetchしない・未知なら実チャンネル応答で解決し
    // sourceAliases（chrome.storage.sync、端末間共有）へ保存する・失敗はthrow」という対称な契約。
    // room裁定[55][58]: UC起点のブロックだけ済ませてhandle側を学習しないと、後で同じチャンネルが
    // handle形式カードとして現れた時に「片方だけ再出現する」。canonicalBaseUrl不在をhandleなしと
    // 推測してはいけない（findHandleAlias側でthrowする）。
    async function resolveAliasOnDemand(rawSourceId) {
      if (rawSourceId.startsWith('UC')) {
        if (hasKnownHandleFor(rawSourceId)) return rawSourceId;
        const handle = await resolver.findHandleAlias(rawSourceId);
        sourceAliases = await storage.setSourceAlias(siteKey, handle, rawSourceId);
        return rawSourceId;
      }
      const known = sourceAliases[rawSourceId];
      if (known) return known;
      const canonicalId = await resolver.canonicalize(rawSourceId);
      sourceAliases = await storage.setSourceAlias(siteKey, rawSourceId, canonicalId);
      return canonicalId;
    }

    // resolver.register.mode === 'floating' の時だけ、カード内挿入(applyRegisterButton)ではなく
    // 共有floating buttonの経路(applyFloatingRegisterButton)を使う（bell裁定[107]）。
    const isFloatingRegister = !!(resolver.register && resolver.register.mode === 'floating');

    function applyDirectCard(card) {
      const info = directCardInfo.get(card);
      if (!info) return;

      if (info.resolutionFailed) {
        applyVisibility(info.wrapper, false, { mode: displayMode });
        if (resolver.register) {
          const ctx = {
            siteKey, storage, sourceId: info.rawSourceId, sourceName: info.sourceName,
            blocked: false, resolutionFailed: true,
            entityLabel: resolver.register.entityLabel,
          };
          if (isFloatingRegister) {
            applyFloatingRegisterButton(doc, card, info.wrapper, ctx);
          } else {
            applyRegisterButton({
              doc, buttonByCard: registerButtonByCard, errorBadgeByCard, card, wrapper: info.wrapper,
              resolveAnchor: resolver.register.anchor, onToggled: async () => {}, ...ctx,
            });
          }
        }
        return;
      }

      // displaySourceId は null のことがある（handle形式でaliasがまだ未確認）。
      // その場合は誤ってブロック済みと見せない安全側の既定（未ブロック表示）にする。
      const displaySourceId = info.sourceId;
      const blocked = displaySourceId !== null && isBlocked(displaySourceId);
      applyVisibility(
        info.wrapper, blocked,
        displaySourceId !== null ? buildVisibilityOptions(displaySourceId, info.sourceName) : { mode: displayMode },
      );

      if (resolver.register) {
        const ctx = {
          siteKey, storage,
          sourceId: displaySourceId !== null ? displaySourceId : info.rawSourceId,
          sourceName: info.sourceName,
          blocked,
          entityLabel: resolver.register.entityLabel,
          // ブロック操作をする時だけ、もう一方の形式のaliasを解決してから正本IDで登録する
          // （解除は既知IDだけで完結するので不要——click handler側でブロック時だけ呼ぶ）。
          resolveBeforeToggle: resolver.canonicalize ? async () => {
            const canonicalId = await resolveAliasOnDemand(info.rawSourceId);
            directCardInfo.set(card, { ...info, sourceId: canonicalId });
            return canonicalId;
          } : undefined,
          onResolutionFailed: resolver.canonicalize ? () => {
            directCardInfo.set(card, { ...info, resolutionFailed: true });
            applyDirectCard(card);
          } : undefined,
          // YouTubeは同じcard要素の内部だけを別動画へ差し替える。クリック直前にresolverを
          // 再実行し、初回scan時のctxで別チャンネルを登録しない（オーナー実Chrome差し戻し）。
          refreshBeforeToggle: isFloatingRegister ? () => {
            const refreshed = handleDirectCard(card);
            if (!refreshed) throw new Error(`content-search: 現在のカードから発信元を取得できません siteKey=${siteKey}`);
            return refreshed;
          } : undefined,
          onToggled: async () => {
            blockedSources = await storage.getBlockedSources(siteKey);
            applyDirectCard(card);
          },
        };
        if (isFloatingRegister) {
          applyFloatingRegisterButton(doc, card, info.wrapper, ctx);
        } else {
          applyRegisterButton({
            doc, buttonByCard: registerButtonByCard, errorBadgeByCard, card, wrapper: info.wrapper,
            resolveAnchor: resolver.register.anchor, ...ctx,
          });
        }
      }
    }

    function handleDirectCard(card) {
      const source = resolver.getSource(card);
      const previous = directCardInfo.get(card);
      if (!source) {
        if (previous) {
          applyVisibility(previous.wrapper, false, { mode: displayMode });
          directCardInfo.delete(card);
          floatingContextByCard.delete(card);
          floatingRegisteredCards.delete(card);
          if (floatingHoverCard === card) hideFloatingButtonNow();
        }
        return null;
      }
      const wrapper = getWrapper(card);
      if (!wrapper) return null;

      // YouTubeはcard要素を維持したまま内部の動画・チャンネルだけ差し替えるため、element identity
      // だけでは処理済み判定にできない。生ID・表示名・wrapperが同じ時だけ既存ctxを再利用する。
      if (previous
          && previous.rawSourceId === source.sourceId
          && previous.sourceName === source.sourceName
          && previous.wrapper === wrapper) {
        return floatingContextByCard.get(card) || null;
      }

      // 同期通信は一切しない。既知aliasの参照だけ（未知ならsourceId: null=「未確認」のまま表示）。
      directCardInfo.set(card, {
        rawSourceId: source.sourceId,
        sourceId: knownCanonicalId(source.sourceId),
        sourceName: source.sourceName,
        wrapper,
      });
      applyDirectCard(card);
      return floatingContextByCard.get(card) || null;
    }

    function handleAsyncCard(card) {
      const itemId = resolver.getItemId(card);
      if (!itemId) return;
      const wrapper = getWrapper(card);
      let cards = asyncCardsByItemId.get(itemId);
      if (!cards) {
        cards = new Map();
        asyncCardsByItemId.set(itemId, cards);
      }

      // SPA再描画で切断された旧カードを強参照し続けない。Amazonでは同じASINの接続中カードが
      // 複数存在しうるため、element identityが違うだけでは削除しない。
      for (const knownCard of cards.keys()) {
        if (knownCard !== card && knownCard.isConnected === false) {
          cards.delete(knownCard);
          registerButtonByCard.delete(knownCard);
          errorBadgeByCard.delete(knownCard);
        }
      }

      const previousWrapper = cards.get(card);
      if (previousWrapper === wrapper) return;
      if (previousWrapper) {
        const oldButton = registerButtonByCard.get(card);
        if (oldButton && oldButton.remove) oldButton.remove();
        registerButtonByCard.delete(card);
        errorBadgeByCard.delete(card);
      }
      cards.set(card, wrapper);

      // 解決済みitemの新しいDOMインスタンスには、通信せず既知結果をその場で適用する。
      if (sourceIdByItemId.has(itemId)) {
        applyKnown(itemId);
        return;
      }
      // 同一itemIdの重複カード／再描画で解決要求を重ねない。進行中callbackは最新のcardsへ適用する。
      if (asyncStartedItemIds.has(itemId)) return;
      asyncStartedItemIds.add(itemId);

      storage.getCachedSource(siteKey, itemId).then((cached) => {
        if (cached) {
          const cachedSource = typeof cached === 'string'
            ? { sourceId: cached, sourceName: '' }
            : cached;
          // 旧版のID-only cacheでは登録時に正しい発信元名を保存できない。登録UIを持つ
          // async adapterだけは一度再解決して、名称を含む新cacheへ更新する。
          if (!resolver.register || cachedSource.sourceName) {
            sourceIdByItemId.set(itemId, cachedSource.sourceId);
            sourceNameByItemId.set(itemId, cachedSource.sourceName || '');
            applyKnown(itemId);
            return;
          }
        }
        queue.enqueue(itemId, (source, err) => {
          if (err) {
            console.warn(`content-search: sourceId解決に失敗しました siteKey=${siteKey} itemId=${itemId}`, err);
            return;
          }
          if (source === null) {
            noSourceCount += 1;
            return;
          }
          resolvedSourceCount += 1;
          const { sourceId, sourceName } = source;
          sourceIdByItemId.set(itemId, sourceId);
          sourceNameByItemId.set(itemId, sourceName || '');
          applyKnown(itemId);
        });
      });
    }

    function scan(root) {
      const handleCard = resolver.type === 'dom_id' ? handleDirectCard : handleAsyncCard;
      const cards = root.querySelectorAll(cardSelector);
      // 初回0件はYouTube等のCSR遅延描画や正当な空結果でも発生するため、
      // selector破損とは判定しない。後続MutationObserverのscanで描画済みカードを処理する。
      for (const card of cards) handleCard(card);

      // floating buttonの対象カードがdisconnect/不可視/viewport外になっていたら隠す（bell裁定[107][119]）。
      // isFloatingRegisterでないアダプタではfloatingHoverCardは常にnullなので無害。
      if (floatingHoverCard && !isFloatingTargetVisible(floatingHoverCard)) {
        hideFloatingButtonNow();
      }
      // bell裁定[133] A（mashiro監査[132]の確定欠陥）: YouTubeの管理DOM再描画でdisconnectした
      // 旧カードがfloatingRegisteredCardsに強参照のまま残り続け、pointermoveのたびの走査コストと
      // メモリ両方が増え続けていた。scanのたびにdisconnect済みを間引く。
      if (isFloatingRegister) pruneFloatingRegisteredCards();
    }

    async function start() {
      // content scriptのmatchは同一サイトの詳細面まで含む。対象外面のカード0件は正常なので、
      // storage・監視・初回0件警告を開始しない。locationを持たないfixtureは従来契約で動かす。
      if (typeof adapter.isTargetPage === 'function'
          && doc.location
          && !adapter.isTargetPage(doc.location)) {
        return;
      }
      blockedSources = await storage.getBlockedSources(siteKey);
      displayMode = await storage.getDisplayMode();
      if (resolver.canonicalize) sourceAliases = await storage.getSourceAliases(siteKey);
      // floating buttonはhover/focus中のカードのrectへ追従する。scroll/resizeで再計算する
      // （bell裁定[107]）。カードがviewport外へ出ていたら位置決めせず隠す（bell裁定[119]:
      // scroll中にrepositionがMath.max(0)でviewport端へ張り付かせてしまう不具合の修正）。
      // isFloatingRegisterでないアダプタでは登録しない。
      if (isFloatingRegister && typeof window !== 'undefined' && window.addEventListener) {
        const reposition = () => {
          if (!floatingHoverCard) return;
          if (!isFloatingTargetVisible(floatingHoverCard)) {
            hideFloatingButtonNow();
            return;
          }
          positionFloatingButtonOverCard(doc, floatingHoverCard);
        };
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
      }
      // mouse hoverの判定はdocument-level pointermoveの幾何判定を正本にする（bell裁定[127]）。
      // card自身のmouseenter/mouseleaveには依存しないため、YouTube自身が生成するpreview overlay
      // 等がcard DOM構造の外側にあってもpointer位置さえcard矩形内なら誤って隠れない。
      if (isFloatingRegister && doc.addEventListener) {
        doc.addEventListener('pointermove', handleFloatingPointerMove(doc));
      }
      scan(doc);

      const observer = new MutationObserver(() => scan(doc));
      observer.observe(doc.body, { childList: true, subtree: true });

      storage.onBlockedSourcesChanged(siteKey, (next) => {
        blockedSources = next;
        for (const itemId of sourceIdByItemId.keys()) applyKnown(itemId);
        for (const card of directCardInfo.keys()) applyDirectCard(card);
      });

      storage.onDisplayModeChanged((next) => {
        displayMode = next;
        for (const itemId of sourceIdByItemId.keys()) applyKnown(itemId);
        for (const card of directCardInfo.keys()) applyDirectCard(card);
      });

      // 他端末からの同期、または同一ページ内の別カードのクリックで新しくaliasが判明したら、
      // 「未確認」のまま表示していたカードへ反映する（このリスナー自体は通信を発生させない）。
      if (resolver.canonicalize && storage.onSourceAliasesChanged) {
        storage.onSourceAliasesChanged(siteKey, (next) => {
          sourceAliases = next;
          for (const [card, info] of directCardInfo.entries()) {
            if (info.sourceId !== null) continue;
            const canonicalId = knownCanonicalId(info.rawSourceId);
            if (canonicalId) {
              directCardInfo.set(card, { ...info, sourceId: canonicalId });
              applyDirectCard(card);
            }
          }
        });
      }
    }

    return { start, scan };
  }

  return {
    extractProductId,
    findWrapper,
    applyVisibility,
    createResolveQueue,
    isAliExpressSearchPage,
    init,
  };
})();
