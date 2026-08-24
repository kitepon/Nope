# ChromeBlocker リリース工程（plan: chromeblocker-release）

MVP（plan `chromeblocker-mvp`、p1-foundation accepted）の後継工程。目的は2つ——**ブロック済みカードの表示改善**と、**Chrome Web Store 経由での配布**（Mac への導入と自動更新を効かせる）。

公開結果（2026-08-24時点）: v2.0.1はChrome Web Storeで一般公開済み（Public）。当初裁定の unlisted ではなく、listing契約どおり公開で出ている。https://chromewebstore.google.com/detail/bodffbgmcokkhlibiehhelefknmbiaaf

## 決定済み事項（オーナー裁定 2026-08-10）

- ブロック済みカードは既定で「猫があっかんべーするプレースホルダー」に置き換える。完全に消して空間を詰めるモードは popup で切替可能にする
- GitHub は **public repo** で作成する
- ストア公開の可視性は **unlisted**（検索に載らない・リンク限定）。ただし unlisted でも初回 $5 のデベロッパー登録は必須で、支払いはオーナーが行う

## 実測で確定している事実（疑わないこと）

- 検索結果の DOM 階層: flex コンテナ > `.search-item-card-wrapper-gallery`（幅288px の flex アイテム） > `le_lr` > `.card-out-wrapper` > `a.search-card-item`
- 現行 `src/content-search.js` は `.card-out-wrapper` を `display:none` にしており、外側 flex アイテムの枠が残るため空間が詰まらない
- `.search-item-card-wrapper-gallery` を `display:none` にすると後続カードが前へ詰まる（座標シフトを実測済み）
- 拡張のロードは `agent-browser --headed --extension "C:/Users/kite_/Documents/Program/ChromeBlocker"` で可能。AliExpress の bot 壁は現在通過可能

## タスク

### r1-placeholder — ブロック表示の2モード実装

`src/storage.js` に displayMode API（`getDisplayMode` 既定 `"placeholder"` / `setDisplayMode` / `onDisplayModeChanged`、sync キー `displayMode`）を追加。`src/content-search.js` の `findWrapper` 優先順を flex アイテム優先へ変更し、`applyVisibility` を placeholder / collapse の2モードへ拡張。popup に切替 UI を追加。unit test を追随させて全 green。

### r2-placeholder-verify — 実ブラウザ実測

placeholder 表示・解除ボタン・collapse 切替時の空間詰め（座標シフト）を実検索ページで確認し、evidence を整備する。

### r3-icons — アイコンと版数

猫キャラを流用した 16/48/128px の PNG を作り `manifest.json` に `icons` を追加、version を `1.0.0` へ上げる。

### r4-github — public repo 作成と push

`gh repo create`（public）→ remote 追加 → push。README（機能・スクリーンショット・導入手順・プライバシー記述）を整備する。

### r5-package — 配布 ZIP と配布物 smoke

配布 ZIP 生成スクリプト（同梱するのは `manifest.json` `src/` `popup/` `icons/` のみ。`.lattice/` `.team/` `docs/` `test/` は除外）。生成した ZIP を展開して Load unpacked で起動する配布物 smoke まで行う。

### r6-store-listing — ストア掲載物

スクリーンショット（1280x800）、日本語の説明文、単一目的宣言、プライバシー申告文（データ収集なし・保存は chrome.storage のみ）を用意する。

### r7-submit — 提出と公開

オーナーによるデベロッパー登録と $5 支払いの後、ZIP アップロード・掲載情報入力・unlisted で提出。審査通過後、Mac へストア経由でインストールして smoke を取る。

## 依存

- r2 は r1 の後
- r5 は r2 と r3 の後
- r6 は r2 の後
- r7 は r4・r5・r6 の後
- r3・r4 は着手時点で独立（並列可）
