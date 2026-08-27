# r7-submit — Chrome Web Store 審査提出

実施日: 2026-08-12

追記（2026-08-27）: ライブCWSの現行公開packageはv2.0.2（日本語listingと英語listing）。この証跡は当時の提出記録であり、現行package versionではない。

追記（2026-08-25 JST）: 当時は次の提出版をv2.0.2とし、ライブCWSはなおv2.0.1一般公開済みと記載した。再審査中ではない。この証跡は当時の提出記録であり、現行package versionではない。

追記（2026-08-24）: 以下は当時の提出結果の記録。当時の現行はv2.0.1一般公開済み（https://chromewebstore.google.com/detail/bodffbgmcokkhlibiehhelefknmbiaaf）。再審査中ではない。

## 結果

Chrome Web StoreへNope v2.0.0を審査提出し、デベロッパーダッシュボードで
`ステータス: 審査待ち`および`アイテムを送信しました`を確認した。
審査合格後の自動公開は有効。

## 提出物

- アイテム名: Nope — 見たくないもの見せません
- アイテムID: `bodffbgmcokkhlibiehhelefknmbiaaf`
- バージョン: `2.0.0`
- ZIP: `dist/chromeblocker-v2.0.0.zip`
- ZIP SHA-256: `f608c6c9e1ad16e347b754c81707269ecf14920a059bb8c7e644a4e1caaaa6fe`
- 提出前GitHub HEAD: `bcc132a3b332d63c08eb00a9e2e6e2f8beb56696`
- 公開プライバシーポリシー: https://github.com/kitepon-rgb/Nope/blob/main/docs/store/privacy.md

提出前にローカルHEADと`origin/main`が一致すること、および公開URLへ
認証情報・ウェブ履歴・ウェブサイト内容の取扱いとLimited Use宣言が反映されたことを確認した。

## Chrome Web Store設定

- カテゴリ: ツール
- 言語: 日本語
- 料金: 料金なし、アプリ内購入なし
- 公開設定: 公開
- 販売地域: すべての地域
- ホームページ: https://kitepon.dev/
- サポート: https://github.com/kitepon-rgb/Nope/issues
- パブリッシャー連絡先: `kitepon@gmail.com`（確認済み）
- スクリーンショット: `ac3-placeholder.png`、`ac2-popup.png`、`ac5-collapse.png`、`ac3-unblock.png`

## プライバシー申告

- 取り扱うデータ: 認証に関する情報、ウェブ履歴、ウェブサイトのコンテンツ
- 取り扱わないデータ: 個人識別情報、健康情報、財務・支払情報、個人的コミュニケーション、位置情報、ユーザー活動ログ
- Limited Useの3項目をすべて表明
- リモートコード: 使用あり
  - AliExpressのJSONP応答だけをChrome拡張APIへアクセスできないページ`MAIN` worldで実行
  - isolated worldへは固定コールバックからシリアライズ済みAPI応答データだけを返す
  - 取得先は`https://acs.aliexpress.com/`のみで、開発者サーバー由来コードはない

## 受付証拠

最終確認ダイアログで自動公開を有効にしたまま`審査のため送信`を実行した。
ダッシュボードは次の2つを返した。

- `この 拡張機能 は審査のために送信されました。`
- `ステータス: 審査待ち`

