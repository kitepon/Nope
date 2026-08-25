# Chrome Web Store listing copy

Source text for the Chrome Web Store developer dashboard **Store listing** and **Privacy practices** tabs. v2.0.1は一般公開済み（https://chromewebstore.google.com/detail/bodffbgmcokkhlibiehhelefknmbiaaf）。Dashboard save / resubmit is a separate gate. Updating this document does not resubmit the live store. This agent does not scrape or change the live store.

Default listing locale is **English**. Keep **Japanese** as an additional locale. Do not apply a store-highlight treatment, and do not add a marquee or wide promotional image.

Fact sources: `manifest.json`, `src/storage.js`, `src/mtop.js`, `src/mtop-main-relay.js`, `src/content-item.js`, `popup/popup.html`, `docs/adr/0001-ui-locale.md`, `docs/evidence/store-v2.0.1/`, and Chrome Web Store listing rules (checked 2026-08-15; locale contract added 2026-08-24 JST).

---

## Product name and URLs

- **Product name (English, default)**: Nope — Hide what you don't want to see
- **Product name (Japanese)**: Nope — 見たくないもの見せません
- **Homepage URL**: https://kitepon.dev/products/nope/
- **Support URL**: https://github.com/kitepon/Nope/issues
- **Privacy policy URL**: https://github.com/kitepon/Nope/blob/main/docs/store/privacy.md

---

## Single purpose

> Hide unwanted content on the pages you are viewing, using sources or keywords you choose.

**English (paste into the dashboard):**

Hide unwanted content on the pages you are viewing, using sources or keywords you choose.

**Japanese (paste into the Japanese locale):**

ユーザーが指定した発信元またはキーワードに基づいて、閲覧中の Web ページから不要なコンテンツを非表示にします。

This sentence summarizes the current implementation: seven service groups, eight surfaces, plus keyword blocking on the Yahoo News group. It is not a future promise.

The implementation spans several pages and the popup. Each piece is only a means to that one purpose.

- `src/content-search.js` (search results): hides matching cards
- `src/content-name.js` (news lists): hides matching cards by display name
- `src/content-item.js` (product pages): the control that adds or removes a store from the block list
- `popup/`: review, add, and remove sources and keywords, and choose the display mode

---

## 日本語の単一目的（ダッシュボード入力用）

> ユーザーが指定した発信元またはキーワードに基づいて、閲覧中の Web ページから不要なコンテンツを非表示にする。

---

## Permission justification（権限の正当化）

Chrome Web Store の権限一覧には `manifest.json` の `permissions` と `content_scripts.matches` の両方がホストアクセスとして表示される。実際の `manifest.json`（v2.0.1時点）は次の通り:

```json
"default_locale": "en",
"permissions": ["storage"],
"content_scripts": [
  { "matches": ["*://*.aliexpress.com/*"], "js": ["src/mtop-main-relay.js"], "world": "MAIN", "run_at": "document_start" },
  { "matches": ["*://*.aliexpress.com/*"], "js": ["src/md5.js", "src/storage.js", "src/i18n.js", "src/mtop.js", "src/content-item.js", "src/content-search.js", "src/content-aliexpress-init.js"], "run_at": "document_idle" },
  { "matches": ["*://search.rakuten.co.jp/*"], "js": ["src/storage.js", "src/i18n.js", "src/content-search.js", "src/adapters/rakuten.js"], "run_at": "document_idle" },
  { "matches": ["*://shopping.yahoo.co.jp/*"], "js": ["src/storage.js", "src/i18n.js", "src/content-search.js", "src/adapters/yahoo_shopping.js"], "run_at": "document_idle" },
  { "matches": ["*://www.youtube.com/*"], "js": ["src/storage.js", "src/i18n.js", "src/content-search.js", "src/adapters/youtube.js"], "run_at": "document_idle" },
  { "matches": ["*://auctions.yahoo.co.jp/*"], "js": ["src/storage.js", "src/i18n.js", "src/content-search.js", "src/adapters/yahoo_auction.js"], "run_at": "document_idle" },
  { "matches": ["*://www.amazon.co.jp/*"], "js": ["src/storage.js", "src/i18n.js", "src/content-search.js", "src/adapters/amazon.js"], "run_at": "document_idle" },
  { "matches": ["*://news.yahoo.co.jp/*"], "js": ["src/storage.js", "src/i18n.js", "src/keyword-filter.js", "src/content-name.js", "src/adapters/yahoo_news.js"], "run_at": "document_idle" },
  { "matches": ["*://www.yahoo.co.jp/*"], "js": ["src/storage.js", "src/i18n.js", "src/keyword-filter.js", "src/content-name.js", "src/adapters/yahoo_japan.js"], "run_at": "document_idle" }
]
```

**`src/content-aliexpress-init.js` について**: 共通エンジン `content-search.js` は AliExpress 以外の
entry でも読み込まれるため、AliExpress 既定アダプタの起動だけをこの専用 entry が担う。
共通エンジン末尾で無条件に起動していた実装は、他サイトで意図しない起動を招いたため撤去した
（`docs/evidence/v7-fix-a-double-start.md`）。

**注意**: `manifest.json` に `host_permissions` フィールドは存在しない。各ドメインは `content_scripts[].matches` としてのみ宣言されている（`host_permissions` の明示追加は t4-mtop で「不要と判明」として見送られた——`docs/evidence/t4-mtop.md` 参照）。Chrome Web Store の権限表示・審査上は `content_scripts.matches` も実質的にホストアクセスとして扱われるため、以下ではこれを「ホストアクセス（content script 経由）」と呼ぶ。

### `storage`

ブロック対象の発信元一覧（`chrome.storage.sync` の `blockedSources`。サイト別にキー分けされた構造）、キーワード一覧（同 `blockedKeywords`。Yahoo ニュース / Yahoo! JAPAN のサイト別配列）、表示モード設定（同 `displayMode`、既定値 `placeholder`）、発信元IDの別形式対応（同 `sourceAliases`。YouTubeのhandle→チャンネルID対応。blockedSourcesと同じく端末間同期が必要なため`sync`に置く）を端末間で同期して保持するために必要。加えて itemId→sourceId の解決結果キャッシュ（`chrome.storage.local` の `itemSourceCache`、`{siteKey}:{itemId}` 形式のキーでフラット保存）を保存するために必要。これらはすべて拡張の中核機能（非表示判定の高速化・ブロック対象の永続化）に直結し、他の権限では代替できない。

### ホストアクセス `*://*.aliexpress.com/*`（content script）

以下すべて AliExpress ドメイン上でのみ実行され、他ドメインでは一切動作しない。

- **検索結果ページ**（`content-search.js` + `aliexpress` アダプタ）: 商品カード（`a.search-card-item`）の href から productId を読み取り、ブロック対象ストアかどうか判定して非表示にするために必要。
- **商品ページ**（`content-item.js`）: ページ内のストアリンク（`a[href*="/store/"]`）から storeId を取得し、「このストアをブロック」ボタンを注入するために必要。
- **mtop API 中継**（`mtop.js` / `mtop-main-relay.js`）: 検索結果カードの href には storeId が含まれないため、productId→storeId の解決に AliExpress 自身の内部 API（`mtop.aliexpress.pdp.pc.query`、エンドポイント `acs.aliexpress.com`）を呼ぶ。**これは AliExpress 自身のエンドポイントであり、拡張の開発者を含むいかなる外部サーバーへも何も送信していない。** ブラウザの CORS 制約を避けるため、`content_scripts[].world:"MAIN"`（Chrome 111+ の正規機能）でページと同じコンテキストから JSONP リクエストを行う設計（`docs/evidence/t4-mtop.md` 参照）。

### ホストアクセス `*://search.rakuten.co.jp/*`（content script）

楽天市場の検索結果ページのみで実行される。

- **検索結果ページ**（`content-search.js` + `rakuten` アダプタ）: 商品カード（`.dui-card`）の`data-shop-id`から店舗IDを、`.content.merchant`から表示名を取得し、ブロック対象かどうか判定して非表示にするために必要。通常商品とCPC広告の双方をDOMだけで判定し、外部APIへのリクエストは行わない。

### ホストアクセス `*://shopping.yahoo.co.jp/*`（content script）

Yahoo!ショッピングの検索結果ページのみで実行される。

- **検索結果ページ**（`content-search.js` + `yahoo_shopping` アダプタ）: 商品カード内の`store.shopping.yahoo.co.jp/{storeId}/{item}.html`形式のリンクからstoreIdを取得し、ストアホームリンクから表示名を取得して、ブロック対象かどうか判定し非表示にするために必要。発信元の識別子はDOMから同期取得できるため、外部APIへのリクエストは行わない。

### ホストアクセス `*://www.youtube.com/*`（content script、検索結果・ホーム）

マッチパターンはYouTube全ページに及ぶが、動画カードが実在する検索結果ページとホームでのみ実質的に動作する。ホームと検索結果の双方で、同じチャンネルを正しくブロック・解除できることを実ブラウザで確認済み。

- **検索結果ページ・ホーム**（`content-search.js` + `youtube` アダプタ、パターンA）: 動画カード内のチャンネルリンク（`a[href*="/@"]` または `a[href*="/channel/"]`）からチャンネル識別子を取得し、ブロック対象かどうか判定して非表示にするために必要。
- **チャンネルID解決**: handle形式（`/@handle`）とチャンネルID形式（`/channel/UC...`）が同一チャンネルを指す場合に片方だけブロックが効かなくなる問題を避けるため、ユーザーがチャンネルをブロック/解除する操作をした時だけ（カードの表示・スキャンだけでは発生しない）、当該チャンネル自身のページ（`https://www.youtube.com/@{handle}` または `https://www.youtube.com/channel/{チャンネルID}`）を取得し、応答に含まれる`canonical link`から正本のチャンネルIDを解決する。**アクセス先はYouTube自身のドメインのみ。拡張の開発者サーバーへは何も送信しない。** 解決結果は`chrome.storage.sync`の`sourceAliases`に保存し（blockedSourcesと同じく端末間で共有し、同じhandleへの重複リクエストを他端末でも回避する）、解決に失敗した場合はブロック操作自体を提供しない（表示名などへの推測フォールバックはしない）。

### ホストアクセス `*://news.yahoo.co.jp/*`（content script）

Yahoo ニュースのニュース一覧ページのみで実行される。

- **ニュース一覧**（`content-name.js` + `yahoo_news` アダプタ、パターンB）: 記事カード（`ul.newsFeed_list > li`）内の出版社名テキスト（`time` の前の要素）でブロック対象かどうか判定して非表示にするために必要。DOM に出版社へのリンクが存在しないため表示名マッチを使用する（`nameOnly: true` エントリ）。キーワードフィルタ（`keyword-filter.js`）も同一エントリでロードし、指定キーワードを含む記事タイトルを追加でブロックできる。外部 API へのリクエストは行わない。

### ホストアクセス `*://www.yahoo.co.jp/*`（content script）

Yahoo! JAPAN のトップページのみで実行される。

- **トップページのニュースフィード**（`content-name.js` + `yahoo_japan` アダプタ、パターンB）: 記事カード（`article:has(cite):not(:has(article))`）内の `cite` 要素から出版社名を取得し、ブロック対象かどうか判定して非表示にするために必要。DOM に出版社へのリンクが存在しないため表示名マッチを使用する（`nameOnly: true` エントリ）。キーワードフィルタ（`keyword-filter.js`）も同一エントリでロードし、指定キーワードを含む記事タイトルを追加でブロックできる。外部 API へのリクエストは行わない。

### ホストアクセス `*://auctions.yahoo.co.jp/*`（content script）

ヤフオクの検索結果ページのみで実行される。

- **検索結果ページ**（`content-search.js` + `yahoo_auctions` アダプタ）: 出品カード（`li.Product`）の `data-auction-id` 属性からオークションIDを取得し、出品者を特定して非表示にするために必要。カード内に出品者リンクが存在しないため、オークション詳細ページを fetch して出品者 ID を解決する（**アクセス先は auctions.yahoo.co.jp のみ。拡張の開発者サーバーへは何も送信しない**）。解決結果はローカルキャッシュ（`chrome.storage.local`）に保存し、同じオークション ID への重複リクエストを回避する。

### ホストアクセス `*://www.amazon.co.jp/*`（content script）

Amazon.co.jp の検索結果ページのみで実行される。

- **検索結果ページ**（`content-search.js` + `amazon` アダプタ）: 商品カード（`div[data-component-type="s-search-result"]`）の `data-asin` 属性から ASIN を取得し、出品者を特定して非表示にするために必要。カード内に出品者リンクが存在しないため、商品詳細ページを fetch して出品者 ID を解決する（**アクセス先は amazon.co.jp のみ。拡張の開発者サーバーへは何も送信しない**）。解決結果はローカルキャッシュ（`chrome.storage.local`）に保存し、同じ ASIN への重複リクエストを回避する。

---

## Privacy declaration（プライバシー申告、要約）

詳細は `docs/store/privacy.md`（公開URL: https://github.com/kitepon/Nope/blob/main/docs/store/privacy.md）。ダッシュボードの **Privacy practices** タブでの申告方針:

- **Data handling**: 本拡張は、機能提供のために認証情報（AliExpressの`_m_h5_tk`トークン）、ウェブ履歴（現在の対応ページとカードURL）、ウェブサイト内容（タイトル・リンク・発信元情報）をブラウザ内で処理する。一部の公開識別子とAliExpress署名は閲覧対象サイト自身へ送信する。開発者・提供者はデータを収集・受信せず、無関係な第三者への送信もない。
- **Data usage 該当あり**: Authentication information / Web history / Website content。
- **Data usage 該当なし**: Personally identifiable info / Health info / Financial and payment info / Personal communications / Location / User activity。
- **Certify compliance**: Developer Program Policies への準拠を宣言する（該当時にチェック）。

### Remote code declaration

- **申告**: 「はい、リモートコードを使用しています」。
- **理由**: AliExpressのストアID解決APIがJSONPのみを返すため、その応答をAliExpressページの`MAIN` worldで実行する。このコンテキストはChrome拡張APIへアクセスできず、拡張側へはシリアライズしたAPI応答データだけを`CustomEvent`で返す。Chrome Web StoreのManifest V3追加要件が認める「拡張APIから隔離されたコンテキスト」の範囲に限定し、開発者サーバー由来のコードは一切読み込まない。

---

## Description

### Short description — English (132 characters or fewer)

> Hide sources and keywords you choose on supported search and list pages. Seven service groups, eight surfaces.

### Detailed description — English

> A Chrome extension that hides content from sources and keywords you choose, on the pages you are viewing.
>
> What it does
> - Block shops, channels, and publishers on the supported search and list pages
> - Add a source from the on-page block control
> - On Yahoo News and Yahoo! JAPAN, also block articles that contain a keyword you add
> - Review and remove blocked sources and keywords in the toolbar popup
> - Show blocked cards as a placeholder, or hide them and collapse the list
>
> Data
> - Page URLs, titles, and source identifiers are processed in the browser to decide what to hide
> - On AliExpress, a site-issued token is used only to sign product-to-store lookups
> - The extension does not send user data to developer servers or unrelated third parties
> - The block list and settings are stored with chrome.storage
> - Source-resolution requests go only to the site you are already viewing
>
> Coverage
> Seven service groups and eight surfaces. Surfaces, limits, and current behavior are on the product page and in the public source.

### 短い説明 — 日本語（132文字以内）

> 指定した発信元やキーワードのコンテンツを閲覧中のWebページから非表示にします。7サービス群・8対応面に対応。

### 詳細説明 — 日本語（実入力）

> 閲覧中のWebページから、指定した発信元やキーワードのコンテンツを非表示にするChrome拡張機能です。
>
> 【できること】
> - 対応サイトの検索結果や一覧ページで、指定したショップ・チャンネル・出版社のコンテンツを自動的にブロック
> - ページ上の「ブロック」ボタンから発信元を登録
> - Yahoo!ニュース／Yahoo! JAPANでは、指定キーワードを含む記事もブロック
> - 拡張アイコンのポップアップから、ブロック中の発信元やキーワードを確認・削除
> - ブロック済みコンテンツは、プレースホルダー表示または完全に非表示にして詰める表示から選択
>
> 【データの扱い】
> - ブロック判定のため、対応ページのURL・タイトル・発信元をブラウザ内で処理します
> - AliExpressでは、同サイト発行トークンを商品識別用の署名生成にのみ利用します
> - 開発者や無関係な第三者が運営するサーバーへユーザーデータを送信しません
> - ブロックリストと設定はchrome.storageを利用して保存します
> - 発信元の解決に必要な通信は、閲覧対象サイト自身のドメインに対してのみ行います
>
> 【対応範囲】
> 7サービス群・8対応面。対応面、制約、現在の動作状況は製品ページと公開sourceで確認できます。

**誇大表現・煽り文言の排除について**: 拡張内部の UI（トースト通知等、`src/content-item.js`）には煽情的な文言はない（「〇〇をブロックしました」「〇〇のブロックを解除しました」という淡々とした通知のみ）。

---

## Category / Language（カテゴリ・言語）

- **Category**: Tools（ショッピング・動画・ニュースを横断する汎用コンテンツフィルターであり、特定の買い物体験だけを主機能としないため。Chrome Web Store の現行カテゴリ定義では「他カテゴリに収まらないツール」に該当）
- **Language (default listing)**: English (`en`). Manifest `default_locale` is `en`. The UI follows the browser language (`ja*` → Japanese, otherwise English). See `docs/adr/0001-ui-locale.md`.
- **Additional listing locale**: Japanese (`ja`). Keep the Japanese name, descriptions, and screenshots.
- Do not apply a store-highlight treatment. Do not upload a marquee or wide promotional image.
- **Pricing**: 料金なし（アプリ内購入なし）
- **Visibility**: 公開
- **Regions**: すべての地域

---

## Graphic assets（実際の掲載順）

v2.0.1をChrome for Testing 152.0.7977.42へLoad unpackedし、実在するAliExpress商品面と検索面、実extension popupから取得した。機能や結果を生成しておらず、追加したのは見出し、実画面のcrop、同一画面の比較、事実説明だけである。raw captureと制作境界は`docs/evidence/store-v2.0.1/README.md`、完成素材は`assets/store/README.md`を正とする。

既定表示モードは`placeholder`であり、対象カードを消して一覧を詰めるのは利用者が`collapse`を選んだ場合だけである。

| # | シーン | 画像ファイル |
|---|--------|--------------|
| 1 | ブロック済みストアの商品を現行Nopeマスコットのplaceholderへ置換 | `assets/store/screenshot-01-placeholder.png` |
| 2 | 実在する対応商品ページへ追加された「このストアをブロック」操作 | `assets/store/screenshot-02-block-source.png` |
| 3 | popupでサイト別発信元、キーワード、表示モードを管理 | `assets/store/screenshot-03-manage.png` |
| 4 | 同じ検索面におけるplaceholderとcollapseの表示差 | `assets/store/screenshot-04-display-modes.png` |
| 5 | 7サービス群・8対応面、Nope専用account不要、開発者serverへ送信しない境界 | `assets/store/screenshot-05-supported-and-private.png` |

### English listing screenshots

English caption overlays use the same 2026-08-15 raw captures. In-page host UI may still be Japanese because those captures were taken on `ja.aliexpress.com`. Recapture of live pages is out of scope here (AliExpress blocks automated browsers).

| # | Scene | File |
|---|---|---|
| 1 | Blocked store cards replaced by the Nope mascot | `assets/store/en/screenshot-01-placeholder.png` |
| 2 | Block-this-store control on a real product page | `assets/store/en/screenshot-02-block-source.png` |
| 3 | English popup chrome (same blocked store as the 2026-08-15 capture; illustrated, not a new live session) | `assets/store/en/screenshot-03-manage.png` |
| 4 | Placeholder versus collapse on the same search page | `assets/store/en/screenshot-04-display-modes.png` |
| 5 | Seven service groups, eight surfaces, no Nope account, no developer server | `assets/store/en/screenshot-05-supported-and-private.png` |

5枚とも1280×800・8-bit RGB・アルファなしのPNG。旧名、QA用余白、debug表示、個人情報、account情報を含まない。

### Store icon / promotional image

- **Store icon（128×128）**: `assets/store/store-icon-128.png`
  - 現行Nope iconを96×96で中央配置し、四辺へ16pxの透明paddingを確保
- **Small promo tile（440×280）, Japanese listing**: `assets/store/small-promo-440x280.png`
- **Small promo tile（440×280）, English listing**: `assets/store/en/small-promo-440x280.png`
- **Marquee**: Do not create. Optional, and not a required field before publish. Do not add a wide promotional image.

v2.0.1のlistingはChrome Web Storeで一般公開済み。画像のDashboard保存、審査取消、再申請、publishはこのlisting契約の更新だけでは実施しない。
