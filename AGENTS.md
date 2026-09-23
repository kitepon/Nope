<!-- このプロジェクトのエージェント指示の正本。 -->

# Nope

指定した発信元やキーワードのコンテンツを、対応する7サイトの検索結果・一覧から非表示にする Chrome 拡張機能（MV3）。工程正本は Lattice store（`.lattice/todo`、plan `nope-v2` / `chromeblocker-release`）。

## コアプロダクト修理の裁定（オーナー 2026-08-10）

ChromeBlocker 開発中に踏んだコアプロダクト（Lattice・peertable 等）の不具合は、回避せず**本体側で修理する**。本体 clone は本プロジェクトの並列フォルダ（`../Lattice`、`../peertable`）にあり、`.claude/settings.local.json` の `additionalDirectories` で参照可。修理後は `npm install -g <clone>` でこの端末へ適用する。push はオーナーの明示指示時のみ。

## 実地調査で確定した技術事実（2026-08-10）

- 検索カード `a.search-card-item` に storeId は無い。productId→storeId は mtop API `mtop.aliexpress.pdp.pc.query`（署名: md5(`${token}&${t}&${appKey}&${data}`)、token=cookie `_m_h5_tk` 前半、appKey=12574478）で解決する。
- 商品ページの DOM には `a[href*="/store/"]` がある（CSR 描画後のみ。素の fetch はシェル HTML）。
- mtop リクエストの実URL形（2026-08-10 実測、agent-browser network capture）: `GET https://acs.aliexpress.com/h5/mtop.aliexpress.pdp.pc.query/1.0/?jsv=2.5.1&appKey=12574478&t=<epoch_ms>&sign=<md5>&api=mtop.aliexpress.pdp.pc.query&type=originaljsonp&v=1.0&timeout=15000&dataType=originaljsonp&callback=mtopjsonp<N>&data=<urlencoded_json>`。`data` JSON: `{"productId":"<id>","_lang":"ja_JP","_currency":"JPY","country":"JP","province":"","city":"","channel":"","pdp_ext_f":"","pdpNPI":"","sourceType":"","clientType":"pc","ext":"{\"foreverRandomToken\":\"<32桁hex>\",\"site\":\"jpn\",\"crawler\":false,\"x-m-biz-bx-region\":\"\",\"signedIn\":false,\"host\":\"ja.aliexpress.com\"}"}`。
- **AliExpress のbot対策（recaptcha punish/`FAIL_SYS_USER_VALIDATE`）は自動化ブラウザ（agent-browser headless/headed 双方）からの直接アクセスを高確率でブロックする**（2026-08-10 実測: 数回の商品ページ・mtop直叩き試行後、検索結果ページ自体も Captcha Interception にリダイレクトされる状態になった）。実ユーザーの拡張機能実行時（cookie・閲覧履歴が蓄積された通常セッション）でも同じ壁に当たるかは未確認——mtop.js の実装はこの経路が塞がれる前提でフォールバック（DOM `a[href*="/store/"]` 解析等）を持つ必要があるか、要検討。
- mtop レスポンスの storeId フィールド名は **2026-08-10 時点で未確定**（bot対策により実レスポンス本体を取得できていない）。取得できたのは `FAIL_SYS_USER_VALIDATE` エラーレスポンスの形のみ: `{"ret":["FAIL_SYS_USER_VALIDATE","RGV587_ERROR::SM::..."],"data":{"url":"...punish...","dialogSize":{...}},"dialogSize":{...}}`。
- 詳細は Lattice plan 各 task の設計メモが正本。

## 実地調査で確定した技術事実（2026-08-11・実ブラウザ実測）

配布物 v2.0.0 の smoke と v7 検証で実測した。詳細は `docs/evidence/` の各記述子が正本。

- **Yahoo!ショッピング**: ストアリンクは `https://store.shopping.yahoo.co.jp/{storeId}/{item}.html?...`。
  **末尾スラッシュではない**（`[href$="/"]` を要求する selector は一致0本になる）。
  商品カードの子要素も `SearchResult_SearchResultItem__*` を共有するため、カードは
  `SearchResult_SearchResult__*` 直下だけを対象にする。表示名は商品リンクではなく、pathname が
  `/{storeId}/` のストアホームリンクから取得する（実Chrome実測 2026-08-12）。
- **Amazon**: 検索結果の約 8 割は Amazon 直販で、**マーケットプレイス出品者が存在しない**。
  そうした商品は `#sellerProfileTriggerId`・`a[href*="seller="]`・`#merchant-info` が
  **CSR 後の実 DOM にも無い**（商品ページの表示は `販売元: Amazon.co.jp`）。
  静的 HTML から「出品者不在」と「構造変更」を区別する手段は現状ない。
  同じASINが検索面に複数カードとして同時表示され、SPA再描画でcard要素だけ交換される場合がある。
  非同期解決結果はASIN単位で共有しつつ、登録UI・表示制御は接続中の全カードへ適用する
  （実Chrome実測 2026-08-12）。
- **YouTube 視聴ページ**: `span.ytAttributedStringHost` は実測順で **index 0 が動画タイトル、
  index 1 がチャンネル名**。
- **ヤフオク**: 検索カードに出品者情報は無く、詳細ページ（`/jp/auction/{id}`）は SSR で
  `fetch()` でも `/seller/{id}` を含む HTML が返る。CORS・bot 遮断なし。
- **楽天市場**: 検索カード `.dui-card` の `data-shop-id` は通常商品と CPC 広告の両方にある。
  CPC 広告のショップリンクは `grp*.ias.rakuten.co.jp/redirect_rpp/` へ変換されるため、
  `www.rakuten.co.jp/{slug}/` のリンクだけを正本にすると先頭広告群を解決できない。
  発信元IDは `data-shop-id`、表示名は `.content.merchant` を使う（実Chrome実測 2026-08-12）。
- **AliExpress は自動化ブラウザからは解決不能**（`FAIL_SYS_USER_VALIDATE / RGV587_ERROR`）。
  実ユーザーの通常セッションで同じ壁に当たるかは**未確認**。

## 開発体制の作法（2026-08-11 に踏んだ穴）

- **円卓の席は `launch-seat.sh`（peertable の正規経路）で立てる。** aiterm の `pty_open` で
  直接立てると、socket・セッション名・sandbox が規約から外れ、稼働状態の観測・room 発言・
  git commit が全部塞がる。
- **`fixture` が green でも実ブラウザで動く証拠にならない。** fixture は実装者が書くので、
  実 DOM を誤解していれば fixture も同じ誤解を含む。アダプタの完了判定に実ブラウザ実測を含める。
