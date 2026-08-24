# Chrome Web Store assets — Nope v2.0.1

Chrome Web Storeへそのまま入力する完成素材。2026-08-15のChrome Web Store公式要件に合わせ、screenshotは最大5枚の1280×800、small promoは440×280、Store iconは128×128で作成した。marqueeは任意なので今回の必須成果へ加えていない。

## 完成素材

| file | 寸法 / 色形式 | 内容 | SHA-256 |
|---|---|---|---|
| `screenshot-01-placeholder.png` | 1280×800 / 8-bit RGB | 実在AliExpress検索面で、ブロック済みストアを現行Nope mascotへ置換 | `879287e348cc8c68fb6ce07cce0e2e5cc9da9949fe56704f37bd3b72083f0f24` |
| `screenshot-02-block-source.png` | 1280×800 / 8-bit RGB | 実在AliExpress商品面へ追加された発信元ブロック操作 | `dc5fe7893bef9b85d21b1c8d0df20b22fe1d49cc647062d940d8e830897e1f30` |
| `screenshot-03-manage.png` | 1280×800 / 8-bit RGB | 実extension popupの表示モード、発信元、キーワード管理 | `b5a0ec4c274b6a2f1eaa4c61d0f5589a4adc20c5b4040a7a9142c9262e1ad070` |
| `screenshot-04-display-modes.png` | 1280×800 / 8-bit RGB | 同一検索面のplaceholder / collapse実画面比較 | `79072d638e233b92a8be0ea420e1fded5771956f4af400500d762f92978f40b3` |
| `screenshot-05-supported-and-private.png` | 1280×800 / 8-bit RGB | 7サービス群・8対応面、Nope専用account、開発者serverへの送信境界 | `8ff8e687bc187885a8901455acda28139c8d1cb7b06bc9433e63d69675f496da` |
| `small-promo-440x280.png` | 440×280 / 8-bit RGB | Nope product identityを主役にしたsmall promo | `67a177a591e67b4e2b3b74d6d65302826b0c1a6e96c614b239a3ca7cd301a722` |
| `store-icon-128.png` | 128×128 / 8-bit RGBA | 現行iconを96×96で中央配置、四辺16px透明padding | `97fb9cb09d14f28c4512bea706dfc63206c6c7ac03f805e2b4af930e78c9ee08` |

## 制作境界

- 機能画面と結果は`docs/evidence/store-v2.0.1/`の実ブラウザcaptureだけを使った。
- 見出し、crop、同一画面の左右比較、事実説明だけを追加した。生成UI、架空の結果、利用者数、評価、効果保証は加えていない。
- 旧名ChromeBlocker、QA用余白、debug表示、個人情報、account情報を完成素材へ残していない。
- 5枚目のprivacy表現は「Nope専用account不要」「開発者serverへ送信しない」とし、発信元解決で閲覧中のサービス自身へ通信する事実を同じ画面に残した。「通信なし」にはしていない。
- product identityはNope mascotと禁止記号を先に置いた。mascot内の`kitepon.dev`は承認済みmaster endorsementであり、新しい合成logoは作っていない。

raw captureはRootSitePromotionの`scripts/capture-nope-store-raw.mjs`、Store用書出しは同`render-nope-store-assets.mjs`で再現する。v2.0.1の完成素材はChrome Web Storeで一般公開済み。このREADMEの更新だけではライブCWSへの再提出にならない。marquee（Featured / ワイド）は作成しない。
