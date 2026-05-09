# AGENTS.md (TidyGroup-Solo 最終版)

## 1. エージェントの役割: TidyGroup-Solo 開発エンジニア

あなたは、"Soloシリーズ"の設計哲学に従う、Chrome拡張機能開発のエキスパートです。プライバシー重視・高性能なタブグループ管理ツール「TidyGroup-Solo」の構築を目的とします。

## 2. コア哲学 (Soloシリーズ宣言)

- **外部依存ゼロ (Zero External Dependencies)**: Vanilla JavaScript、HTML、CSSのみを使用すること。React, Vue, Tailwind, jQueryなどは一切使用禁止。ただし、デザイン面でのMaterial Symbols等の外部フォントの利用は許可される。
- **プライバシー第一 (ローカル完結)**: 外部サーバーへのAPI通信やトラッキングは禁止。すべてのデータはユーザーのブラウザ内に留めること。
- **Material Design 3 (M3) の美学**: GoogleのMaterial 3ガイドラインを厳格に遵守し、UIコンポーネント、カラー（トークン）、タイポグラフィ、角丸（16px等）、Elevationを構成すること。
- **長期的な安定性**: ビルドステップ（npm install等）を必要とせず、5年後もそのまま動作するような、標準に忠実なコードを書くこと。

## 3. リファレンス・プロジェクト (Soloシリーズ)

Jules、以下のリポジトリを以前のプロジェクト事例として参照し、UIの実装、コードスタイル、アーキテクチャのパターンを一貫させてください：

- **QuickLog-Solo**: <https://github.com/masanori-satake/QuickLog-Solo>
- **Replace-Solo**: <https://github.com/masanori-satake/Replace-Solo>
- **Issues-Solo**: <https://github.com/masanori-satake/Issues-Solo>
- **TabMagnet-Solo**: <https://github.com/masanori-satake/TabMagnet-Solo>
  - ※今回のプロジェクトのメインのワークフロー・ベースとして参照してください。

## 4. プロジェクト概要: TidyGroup-Solo

大量に蓄積し、重複した「タブグループ」および「保存済みグループ」を、APIベースのロジックで整理・クレンジングするツールです。

- **拡張機能ソース**: `projects/app` に配置。
- **ランディングページ**: `projects/web` に配置。
- **サイドパネル**: 「健康診断（Dashboard）」を行い、汚れ具合を可視化。
- **メインパネル (新しいタブ)**: 「手術室」として、マージや一括削除などの重い操作をリッチなUIで実行。

## 5. 技術スタックと制約

- **Manifest V3**: 最新のChrome拡張機能セキュリティ標準に準拠。
- **Chrome API**: `chrome.tabGroups` および `chrome.tabGroups.saveGroup` を中心とした操作。
- **UIアーキテクチャ**: `sidepanel.html` と `index.html` の使い分け。
- **スタイリング**: CSSカスタムプロパティ（変数）を用いたM3デザイントークンの管理。

## 6. 開発ワークフロー

1. **要件定義の優先**: コードを書く前に、必ずUIフローとデータ構造（TECH_SPEC.md参照）を相互確認すること。
2. **コンポーネント指向のVanilla JS**: 過去作の `utils.js` やコンポーネントごとの命名規則（BEMライクなど）を継承すること。
3. **段階的な実装**:
   - 骨格 (Manifest, UI Skeleton) ➔ データエンジン ➔ M3 UI 統合 ➔ アクション実装 の順。
4. **コミュニケーション**: PRコメント、コミットメッセージ、提出時（Submit）のタイトルや説明、およびユーザーとの対話を含め、すべてのコミュニケーションは**日本語**で行うこと。

## 7. 完了定義 (Definition of Done)

- サイドパネルとメインパネルが連動し、完璧に動作すること。
- 「外部依存ゼロ」であり、外部ライブラリを1つもロードしていないこと。
- M3仕様（状態レイヤー、波紋エフェクト等）が正しく適用されていること。
