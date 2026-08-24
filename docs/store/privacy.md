# Nope privacy policy

Last updated: 2026-08-24 (JST)

Public URL (Chrome Web Store): https://github.com/kitepon/Nope/blob/main/docs/store/privacy.md

This page is the single privacy-policy URL for both the English and Japanese store listings. The Japanese text follows the English text.

Nope — Hide what you don't want to see ("the extension") processes the page content and URLs of supported sites in the browser so it can decide what to hide. On AliExpress it briefly reads the token part of that site's `_m_h5_tk` cookie, only to sign a product-to-store lookup. The developer does not collect or receive this data. There is no analytics, advertising, or tracking traffic, and no developer server.

The placeholder and popup footer include a fixed link to `kitepon.dev` so the operator is visible. The link uses only `utm_source=nope`, `utm_medium=chrome_extension`, `utm_campaign=nope-brand-link`, and a fixed `utm_content` for placement. It does not include the page you were viewing, block targets, keywords, the current URL, query, or fragment.

Data the extension handles in order to provide the feature, using Chrome Web Store categories:

- **Authentication information**: the token part of AliExpress `_m_h5_tk`, used only to sign the product-to-store request, not stored by the extension, sent only to AliExpress over HTTPS.
- **Web history**: the URL of the supported page you are viewing and URLs inside list cards, used only to identify the surface and the source. The extension does not build, store, or send a browsing-history list.
- **Website content**: titles, links, and source identifiers on product, video, and article cards, used only to decide what to hide and what to show.

It does not handle names, addresses, email, health, financial, payment, personal communications, or location data. It does not record clicks, mouse position, scroll, or keystrokes.

Stored data stays in `chrome.storage` on the user's device (and Chrome sync destinations). There is no developer backend. See the Japanese table below for keys and sync scope.

Network requests for source resolution go only to the site you are already viewing (AliExpress, Yahoo Auctions, Amazon.co.jp, YouTube). Other supported sites use the visible DOM only.

The UI language follows the browser (`ja*` → Japanese, otherwise English). That choice does not change what data is processed.

---

# Nope — 見たくないもの見せません プライバシーポリシー

最終更新日: 2026-08-24

公開 URL（Chrome Web Store 申告用）: https://github.com/kitepon/Nope/blob/main/docs/store/privacy.md

Chrome Web Store デベロッパーダッシュボードの「Privacy practices」タブでの申告は、このページの内容と食い違わせないこと。

## 取り扱うデータ

Nope — 見たくないもの見せません（以下「本拡張」）は、ブロック対象を判定するため、閲覧中の対応サイトに表示されたページ内容とURLをブラウザ内で処理します。AliExpressでは、商品IDからストアIDを解決する署名を作るため、同サイトが発行した`_m_h5_tk` Cookieのトークン部分をブラウザ内で一時的に読み取ります。

本拡張の開発者は、これらのデータを収集・受信しません。本拡張にアクセス解析・広告・トラッキング用の通信はなく、開発者が運営するサーバーや、閲覧対象サイトと無関係な第三者のサーバーも使用しません。

ブロック後のplaceholderとpopup footerには、運営主体を示すため`kitepon.dev`への固定リンクがあります。リンクは`utm_source=nope`、`utm_medium=chrome_extension`、`utm_campaign=nope-brand-link`と、表示位置を表す固定の`utm_content`だけを付けます。閲覧先、ブロック対象、キーワード、現在URL、query、fragmentはリンクへ含めず、extension内の行動やブロック設定を計測しません。

Chrome Web Storeの分類に沿うと、本拡張が機能提供のために取り扱うデータは次の3種類です。

- **認証に関する情報**: AliExpressの`_m_h5_tk` Cookieに含まれるトークン部分。商品IDからストアIDを解決するリクエストの署名生成にだけ使用し、本拡張のストレージへ保存しません。送信先はAliExpress自身のHTTPSエンドポイントだけです。
- **ウェブ履歴**: 現在表示している対応サイトのURLと、一覧カードに含まれる商品・動画・記事等のURL。対応面の判定と発信元の識別にだけ使用し、閲覧履歴の一覧を作成・保存・送信しません。
- **ウェブサイトのコンテンツ**: 商品・動画・記事カードのタイトル、リンク、発信元ID・表示名など。ブロック判定と画面表示にだけ使用します。

氏名、住所、メールアドレス、健康情報、財務・支払情報、個人的コミュニケーション、位置情報は取り扱いません。クリック、マウス位置、スクロール、キーストローク等の利用状況を記録・収集しません。

- 開発者または無関係な第三者が運営するサーバーへの送信: なし
- 広告・アクセス解析・トラッキングへの利用: なし
- 第三者への販売・提供: なし

本拡張によるユーザーデータの利用は、限定的使用（Limited Use）の要件を含むChrome Web Store User Data Policyに準拠します。取り扱うデータは上記の単一用途の提供だけに使い、信用力の判断、融資、広告、販売、または単一用途と無関係な目的には使用・転送しません。

## 保存するデータとその保存先

本拡張が保存するデータは、すべてブラウザ標準の `chrome.storage` API を使い、ユーザーの端末（および Google アカウント同期先）にのみ保存されます。開発者のサーバーは存在せず、本拡張は一切のバックエンドを持ちません。

| データ | 保存先 | 内容 | 同期範囲 |
|--------|--------|------|----------|
| ブロック対象の発信元一覧 | `chrome.storage.sync`（キー `blockedSources`） | サイト別に登録したストア・出品者・チャンネル・出版社の ID、表示名、登録日時 | ユーザーの Google アカウントでログインした端末間 |
| ブロック対象のキーワード | `chrome.storage.sync`（キー `blockedKeywords`） | Yahoo ニュース / Yahoo! JAPAN でユーザーが登録したキーワード | 同上 |
| 表示モード設定 | `chrome.storage.sync`（キー `displayMode`） | ブロック済みカードを「プレースホルダー表示」「完全非表示」のどちらにするかの選択 | 同上 |
| 発信元IDの別形式対応 | `chrome.storage.sync`（キー `sourceAliases`） | YouTubeのチャンネルhandle（`@xxx`）とチャンネルID（`UCxxx`）の対応関係（ユーザーがブロック/解除操作をした時だけ解決・保存） | ユーザーの Google アカウントでログインした端末間 |
| 発信元の解決キャッシュ | `chrome.storage.local`（キー `itemSourceCache`） | サイトと商品・オークションIDから解決した発信元IDの対応（最大5000件、超過分は古いものから自動削除） | この端末のみ（同期されない） |

`chrome.storage.sync` は Chrome 標準の同期ストレージであり、Google アカウントを介した同期はブラウザ自身が行います。本拡張がこのデータを別途どこかへ送信することはありません。

## 対応サイト自身へのネットワーク通信

検索結果カードだけでは発信元を識別できない次のサイトで、閲覧中のサービス自身へ公開識別子を問い合わせます。

| サイト | 送信先 | リクエストへ追加する識別子 | 目的 | タイミング |
|---|---|---|---|---|
| AliExpress | `https://acs.aliexpress.com/` の内部API `mtop.aliexpress.pdp.pc.query` | 商品ID | ストアIDの解決 | 検索結果表示時（カードごと自動） |
| ヤフオク | `https://auctions.yahoo.co.jp/jp/auction/{オークションID}` | URLに含まれるオークションID | 詳細ページから出品者IDを解決 | 検索結果表示時（カードごと自動） |
| Amazon.co.jp | `https://www.amazon.co.jp/dp/{ASIN}` | URLに含まれるASIN | 詳細ページから販売者IDを解決 | 検索結果表示時（カードごと自動） |
| YouTube | `https://www.youtube.com/@{handle}` または `https://www.youtube.com/channel/{チャンネルID}` | URLに含まれるチャンネルのhandleまたはチャンネルID | handle形式とチャンネルID形式の対応関係を、チャンネル自身のページ応答（`canonical link`）から解決するため | ユーザーがチャンネルをブロック/解除操作した時のみ（検索結果・ホームの表示だけでは発生しない） |

この通信について、誤解を避けるため明確にしておきます。

- **送信先は閲覧中のサービス自身のドメインだけ**です。本拡張の開発者や、閲覧中のサービスと無関係な第三者のサーバーへ送信しません。
- **本拡張がリクエストへ追加する識別子は、表示中のページに含まれる公開の商品ID・オークションID・チャンネル識別子だけ**です。AliExpressでは同サイトの`_m_h5_tk`トークンから生成した署名も追加します。本拡張が氏名・メールアドレス・住所・支払い情報を読み取って送信することはありません。通常のページアクセスと同様に、ブラウザが対象サービス自身のCookieや標準ヘッダーを自動付与する場合があります。
- AliExpress の問い合わせはページのコンテキスト内（`content_scripts[].world:"MAIN"`）で署名付きJSONPとして行い、ヤフオク・Amazon.co.jp・YouTube は同一オリジンの公開ページ（商品詳細ページ／チャンネルページ）を取得します。
- 解決した発信元IDは上記の `itemSourceCache` に、YouTubeのチャンネルID対応関係は `sourceAliases` にのみ保存され、他の宛先へ転送されません。
- YouTubeのみ、通信はユーザーの明示的なブロック/解除操作をきっかけに発生します。AliExpress・ヤフオク・Amazon.co.jpの問い合わせは検索結果の表示時に自動的に発生します。
- 楽天市場・Yahoo!ショッピング・Yahoo ニュース・Yahoo! JAPAN は表示中の DOM だけで判定し、発信元解決のための追加通信を行いません。

## Chrome Web Store「Privacy practices」タブでの申告方針

ダッシュボードの申告項目と、この文書の内容が一致するようにする。

- **Single purpose**: `docs/store/listing.md` の宣言文をそのまま使用
- **Permission justification**: `storage` と `content_scripts[].matches` に宣言した全ホストについて、`docs/store/listing.md` の該当節をそのまま使用
- **Data usage のチェック項目**: 次の3種類を、端末内または閲覧対象サイト自身との通信で取り扱うものとして申告する
  - Authentication information
  - Web history
  - Website content
- **Data usage の非該当項目**: 以下は「該当しない（取り扱わない）」として申告する
  - Personally identifiable information
  - Health information
  - Financial and payment information
  - Personal communications
  - Location
  - User activity（キー操作・クリック等の収集は行っていない。ボタンクリックはローカルの `chrome.storage` 更新のトリガーとしてのみ使われ、どこにも送信・記録されない）
- **"I do not sell or transfer user data..." 等の certification 項目**: すべて事実として該当するのでチェックする
- **ユーザーデータの取り扱い**: 本拡張は上記3分類を機能提供のために端末内で処理し、一部を閲覧対象サイト自身へ送信するものとして申告する。開発者はデータを収集・受信せず、無関係な第三者への送信もない。対応サイト自身への発信元解決通信は、上記の送信先・識別子・目的を Permission justification 側にも記載する（`listing.md` 参照）

## 変更履歴

- 2026-08-10: r6-store-listing にて新規作成
- 2026-08-11: v2.0.0 の7サイト対応、現行ストレージキー、同一サイトへの発信元解決通信へ更新
- 2026-08-11: YouTube（yt-home-search）へhandle→チャンネルID解決の通信を追加（ブロック/解除操作時のみ）
- 2026-08-12: Chrome Web Store公式定義に合わせ、端末内処理を含むデータ取り扱い（認証情報・ウェブ履歴・ウェブサイト内容）を明示
- 2026-08-15: v2.0.1の固定campaignによる`kitepon.dev` root linkを追記。extension内analyticsを追加しない境界を明記
- 2026-08-24: 英語本文を同じURLへ追加。UI locale契約（`ja*`は日本語、それ以外は英語）を追記。利用者数は記載しない
