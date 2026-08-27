# Chrome Web Store 提出チェックリスト

ライブCWSの現行公開packageはv2.0.2（英語default UI、`ja*`は日本語。日本語listingと英語listing）。公開URL: https://chromewebstore.google.com/detail/bodffbgmcokkhlibiehhelefknmbiaaf

この文書はv2.0.2提出の正本。Dashboard操作はこの文書の更新だけでは実施済みにならない。ライブCWSへの再提出は別の操作gateで行う。

## 前提（Dashboard操作前に揃っているべきもの）

- [x] `manifest.json`と配布packageはversion `2.0.2`
- [x] public repo、README、Privacy、Support、Release assetが正規owner `kitepon`で到達可能
- [x] 配布ZIPのallowlist、再現可能hash、Load unpacked、7サービス群・8対応面のpackage smokeを確認済み
- [x] Store screenshot 5枚、Store icon、small promo tileを`assets/store/`へ作成済み
- [x] Chrome Web Storeデベロッパー登録済み

## 提出前の最終整合確認

- [ ] `manifest.json` の `version` と、アップロードする ZIP 内の `manifest.json` の `version` が一致している
- [ ] `permissions` が `["storage"]` のみであること（増えていたら `docs/store/listing.md` の Permission justification を更新してから提出する）
- [ ] `content_scripts[].matches` が `docs/store/listing.md` の v2.0.2 manifest 抜粋と一致すること（対象ドメインが増減していたら listing.md / privacy.md を更新してから提出する）
- [ ] `docs/store/listing.md` のSingle purpose、説明文、permission、privacy、graphic assetsが最新の実装と食い違っていないか目視確認

## Store listing タブ入力

`docs/store/listing.md` の内容をそのまま転記する。

- [ ] Single purpose description
- [ ] Category: Tools
- [ ] Language: English (en) as the default listing locale, plus Japanese (ja)
- [ ] English short / detailed description from `docs/store/listing.md`
- [ ] English screenshots from `assets/store/en/` if the English locale is being filled
- [ ] Short description（132文字以内。現在実装の価値と7サービス群・8対応面を過不足なく記載）
- [ ] Detailed description
- [ ] Screenshots（1280×800、`docs/store/listing.md`の5枚を表の順序でアップロード）
- [ ] Store icon: `assets/store/store-icon-128.png`（128×128）
- [ ] Small promo tile: `assets/store/small-promo-440x280.png`（440×280）
- [ ] Homepage URL: https://kitepon.dev/products/nope/
- [ ] Support URL: https://github.com/kitepon/Nope/issues
- [ ] Marqueeは任意のため未入力。未作成を必須素材の欠落と扱わない

## Privacy practices タブ入力

`docs/store/privacy.md` の「Chrome Web Store『Privacy practices』タブでの申告方針」節の通りに入力する。

- [ ] Single purpose（listing.md と同一文面）
- [ ] Permission justification（`storage` / `content_scripts[].matches` に宣言した全ホストそれぞれ）
- [ ] Data usage: Authentication information / Web history / Website contentを、端末内処理を含む取り扱いとして申告
- [ ] Personally identifiable information / Health / Financial and payment / Personal communications / Location / User activityは非該当
- [ ] 開発者はデータを収集・受信しないが、端末内処理と閲覧対象サービス自身への通信があるため「user dataを一切取り扱わない」とは申告しない
- [ ] Certify compliance にチェック
- [ ] プライバシーポリシー URL: push 済み repo 内 `docs/store/privacy.md` の GitHub 上の表示URL（raw ではなく blob 表示のURLを推奨。要判断: README からのリンクと同一URLにするか確認）

## Distribution（公開範囲）設定

- [ ] Visibility: **Public**
- [ ] Pricing: 無料（アプリ内購入なし）
- [ ] Regions: すべての地域
- [ ] ZIP アップロード: `node scripts/pack.mjs`が生成した`dist/nope-v2.0.2.zip`（Load unpacked smoke 済みのもの）

## 提出後

v2.0.1の審査は通過し、当時のlistingは一般公開済みだった。v2.0.2も一般公開済み。再審査中ではない。公開後の確認項目は次の通り。

- [ ] 審査ステータスの確認（Chrome Web Store は審査に数日〜数週間かかることがある。P0 ではなく通常の外部完了待ちとして扱う）
- [ ] 審査通過後、Mac へストア経由でインストールし、以下の smoke を実施:
  - [ ] 7サービス群・8対応面の代表ページで、各adapterの対象cardと登録経路が動作する
  - [ ] AliExpress 商品ページの「このストアをブロック」ボタンが動作する
  - [ ] Yahoo ニュース / Yahoo! JAPAN でキーワードブロックが動作する
  - [ ] ポップアップでサイト別ブロックリストとキーワードの一覧・追加・削除ができる
  - [ ] 表示モード切替（プレースホルダー / 完全非表示）が動作する
- [ ] smoke結果を現行campaignのrelease evidenceへ記録し、監査後に工程をcloseする

## 審査で刺さりやすい点（v2.0.1時点の自己評価、要注意）

- **同一サイトへの発信元解決通信**: AliExpress の内部APIに加え、ヤフオクの商品詳細ページ、Amazon.co.jp の商品詳細ページを取得する。送信先・識別子・キャッシュ先を `privacy.md` / `listing.md` の Permission justification と食い違わせないこと。
- **`content_scripts[].world:"MAIN"` の使用**: 比較的新しい機能（Chrome 111+）で、審査員によっては「main world で何をしているか」を個別に見られる可能性がある。`mtop-main-relay.js` は JSONP 実行の中継のみで、DOM 改変や外部送信は行っていないことを説明できるようにしておく。
- **`host_permissions` フィールドが無いこと**: design memo は「host permission」と表現していたが、実装は `content_scripts.matches` のみで `host_permissions` は宣言していない（`listing.md` に食い違いとして明記済み）。ダッシュボードの権限一覧でどちらの扱いで表示されるかは r7 提出時に実物のダッシュボード画面で確認すること（要判断: 表示のされ方次第で説明文の言い回しを微調整する必要が出るかもしれない）。
