# Nope — 見たくないもの見せません

![Nopeの猫マスコットとkitepon.dev endorsement](assets/brand/nope-github-hero.png)

## 5秒でわかる

Nopeは、見たくない発信元や言葉を、対応する検索結果・一覧から隠す日本語UIのChrome拡張です。Webサービス側に委ねていた表示を、発信元またはキーワード単位で自分で選び直せます。

## 現在の配布状態

**v2.0.1はChrome Web Storeで公開済みです。** 一般利用者向けの導入は [Chrome Web Store](https://chromewebstore.google.com/detail/bodffbgmcokkhlibiehhelefknmbiaaf) から行ってください。公開sourceとこのREADMEも今すぐ読めます。

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

NopeはChrome向け、日本語UI、無料の拡張です。すべてのWebサイトやすべての表示面には対応しません。

## プライバシー・権限・制限

- API権限は`storage`のみです。対応面で機能を実行するため、各サービスを`content_scripts[].matches`へ宣言しています。
- ブロック対象・表示方法・Yahooニュース群のキーワードは`chrome.storage.sync`へ、発信元解決のcacheは`chrome.storage.local`へ保存します。
- 開発者のanalytics、tracking、backendへ閲覧情報やブロック設定を送信しません。発信元解決が必要な時だけ、閲覧中の対象サービス自身へ公開識別子を送信します。
- AliExpressのJSONP応答は同サイトの`MAIN` worldで実行します。このためChrome Web Storeのremote code申告は「はい」です。

詳しくは[プライバシーポリシー](docs/store/privacy.md)を読んでください。対応面の不具合は[Issue](https://github.com/kitepon/Nope/issues)で報告できます。日本語で受け付け、返信期限や英語supportは約束しません。

## 開発・テスト

```sh
node --test test/
node scripts/pack.mjs
```

`scripts/pack.mjs`は、manifest、実行時source、popup、icons、マスコット画像だけを含むZIPとstable unpacked面を`dist/`へ再生成します。配布物はChromeのLoad unpackedで開発者が確認できます。

設計・Store申告の詳細は[docs/store](docs/store/)を、対応サイトごとの実装は[src/adapters](src/adapters/)を参照してください。

## ライセンス

[MIT License](LICENSE)
