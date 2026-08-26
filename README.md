# Nope — Hide what you don't want to see

**日本語は下にあります。** [日本語セクションへ](#nope--見たくないもの見せません)

![Nope cat-ear mascot with the kitepon.dev endorsement](assets/brand/nope-github-hero.png)

## In 5 seconds

Nope is a Chrome extension that hides sources and words you do not want to see, on the supported search and list pages. You choose those sources or keywords yourself, instead of leaving the page layout to the site.

The UI follows the browser language: Japanese for `ja*`, English otherwise (`docs/adr/0001-ui-locale.md`).

## Current distribution

**v2.0.2 is the next ship.** It includes the English-default UI (Japanese for `ja*`) already on `main`. The live Chrome Web Store is still **v2.0.1** until that update is submitted. Install the current public build from the [Chrome Web Store](https://chromewebstore.google.com/detail/bodffbgmcokkhlibiehhelefknmbiaaf). The public source and this README are the 2.0.2 package.

Developers who want to inspect the source should use **Develop and test** below. Load unpacked is a developer check, not the install path for people using the product.

## How to use it

1. On a supported search or list page, block a source you do not want to see.
2. Choose whether blocked cards become a placeholder or disappear and collapse.
3. Open the Nope popup from the Chrome toolbar to manage sources by site, Yahoo News keywords, and the display mode.

Keyword blocking is only on Yahoo News and Yahoo! JAPAN. Other surfaces block by source.

## Before and after

Before (the source is unblocked):

![AliExpress search results showing product cards](docs/evidence/r5-smoke-restored.png)

After (the same search page, with that source replaced by the Nope placeholder):

![AliExpress search results with the target source replaced by the Nope placeholder](docs/evidence/r5-smoke-blocked.png)

Only cards whose source can be identified are hidden. Cards that the site DOM no longer exposes, or whose source cannot be resolved, stay visible.

## Seven service groups, eight surfaces

| Service group | Surfaces | What you can block |
|---|---|---|
| AliExpress | Search results, product page | Store |
| Rakuten Ichiba | Search results | Shop |
| Yahoo! Shopping | Search results | Store |
| Yahoo Auctions | Search results | Seller |
| Amazon.co.jp | Search results | Marketplace seller |
| YouTube | Search results, Home | Channel |
| Yahoo News group | Yahoo News, Yahoo! JAPAN | Publisher, keyword |

Nope is a free Chrome extension. It does not cover every website or every surface on the sites above.

## Privacy, permissions, limits

- The only API permission is `storage`. Each service is declared in `content_scripts[].matches` so the feature can run on that surface.
- Blocked sources, display mode, and Yahoo News keywords are stored in `chrome.storage.sync`. Source-resolution cache is stored in `chrome.storage.local`.
- The extension does not send browsing data or block settings to developer analytics, tracking, or a backend. When a source must be resolved, it sends a public identifier only to the site you are already viewing.
- AliExpress JSONP responses run in that site's `MAIN` world. The Chrome Web Store remote-code declaration is therefore "yes".

Read the [privacy policy](docs/store/privacy.md). Report surface bugs in [Issues](https://github.com/kitepon/Nope/issues). Japanese and English reports are accepted. There is no promised reply window.

## Develop and test

```sh
node --test test/
node scripts/pack.mjs
```

`scripts/pack.mjs` rebuilds a ZIP and a stable unpacked tree in `dist/` with the manifest, runtime source, popup, icons, locale catalogs, and mascot images. Developers can load that unpacked tree in Chrome.

Store-listing copy is in [docs/store](docs/store/). Per-site adapters are in [src/adapters](src/adapters/). Locale selection is in [docs/adr/0001-ui-locale.md](docs/adr/0001-ui-locale.md).

## License

[MIT License](LICENSE)

---

# Nope — 見たくないもの見せません

## 5秒でわかる

Nopeは、見たくない発信元や言葉を、対応する検索結果・一覧から隠すChrome拡張です。UIはブラウザ言語に従います（`ja*`は日本語、それ以外は英語）。Webサービス側に委ねていた表示を、発信元またはキーワード単位で自分で選び直せます。

## 現在の配布状態

**次の提出版はv2.0.2です。** 英語default UI（`ja*`は日本語）を含めます。ライブのChrome Web Storeは、その更新を提出するまで**v2.0.1のまま**です。現在の公開版は [Chrome Web Store](https://chromewebstore.google.com/detail/bodffbgmcokkhlibiehhelefknmbiaaf) から導入してください。公開sourceとこのREADMEはv2.0.2のpackageです。

開発者がsourceから確認する場合は、下の「開発・テスト」を使ってください。Load unpackedは開発者向けの確認手順であり、一般利用者向けの導入手順ではありません。

## 30秒の使い方

1. 対応する検索結果・一覧で、見たくない発信元をブロックします。
2. ブロック済みカードはプレースホルダーに置き換えるか、完全に隠して詰めるかを選べます。
3. ChromeのツールバーにあるNopeのpopupで、サイト別の発信元、Yahooニュース群のキーワード、表示方法を管理します。

キーワードブロックはYahoo!ニュースとYahoo! JAPANだけに対応します。その他の対応面では発信元単位のブロックです。

## ブロック前後

ブロック前（対象の発信元を解除した表示）:

![AliExpressの検索結果に商品カードが表示されている状態](docs/evidence/r5-smoke-restored.png)

ブロック後（同じ検索面で対象の発信元をNopeのplaceholderへ置換）:

![AliExpressの検索結果で対象の発信元がNopeのplaceholderへ置き換わった状態](docs/evidence/r5-smoke-blocked.png)

発信元の識別ができたカードだけを対象にします。対応サイトのDOM変更や、発信元を解決できないカードは隠しません。

## 対応する7サービス群・8対応面

| サービス群 | 対応面 | ブロック対象 |
|---|---|---|
| AliExpress | 検索結果・商品ページ | ストア |
| 楽天市場 | 検索結果 | 店舗 |
| Yahoo!ショッピング | 検索結果 | 出品ストア |
| ヤフオク | 検索結果 | 出品者 |
| Amazon.co.jp | 検索結果 | マーケットプレイス販売者 |
| YouTube | 検索結果 | チャンネル |
| Yahooニュース群 | Yahoo!ニュース・Yahoo! JAPAN | 出版社・キーワード |

NopeはChrome向け、無料の拡張です。すべてのWebサイトやすべての表示面には対応しません。

## プライバシー・権限・制限

- API権限は`storage`のみです。対応面で機能を実行するため、各サービスを`content_scripts[].matches`へ宣言しています。
- ブロック対象・表示方法・Yahooニュース群のキーワードは`chrome.storage.sync`へ、発信元解決のcacheは`chrome.storage.local`へ保存します。
- 開発者のanalytics、tracking、backendへ閲覧情報やブロック設定を送信しません。発信元解決が必要な時だけ、閲覧中の対象サービス自身へ公開識別子を送信します。
- AliExpressのJSONP応答は同サイトの`MAIN` worldで実行します。このためChrome Web Storeのremote code申告は「はい」です。

詳しくは[プライバシーポリシー](docs/store/privacy.md)を読んでください。対応面の不具合は[Issue](https://github.com/kitepon/Nope/issues)で報告できます。日本語と英語で受け付けます。返信期限は約束しません。

## 開発・テスト

```sh
node --test test/
node scripts/pack.mjs
```

`scripts/pack.mjs`は、manifest、実行時source、popup、icons、locale catalog、マスコット画像だけを含むZIPとstable unpacked面を`dist/`へ再生成します。配布物はChromeのLoad unpackedで開発者が確認できます。

設計・Store申告の詳細は[docs/store](docs/store/)を、対応サイトごとの実装は[src/adapters](src/adapters/)を、locale契約は[docs/adr/0001-ui-locale.md](docs/adr/0001-ui-locale.md)を参照してください。

## ライセンス

[MIT License](LICENSE)
