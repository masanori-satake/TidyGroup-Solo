# TidyGroup-Solo

[![version](https://img.shields.io/badge/version-0.1.0-blue)](projects/app/manifest.json)
[![Coverage](https://img.shields.io/badge/coverage-0%25-red)](https://masanori-satake.github.io/TidyGroup-Solo/coverage/)
[![Privacy-Local Only](https://img.shields.io/badge/Privacy-Local%20Only-brightgreen)](AGENTS.md)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange)](projects/app/manifest.json)

〜大量に蓄積し、重複したタブグループをスマートに整理・クレンジングするローカル完結型Chrome拡張機能〜

## プロジェクト概要

TidyGroup-Soloは、プライバシーを最優先に設計された、タブグループ管理・整理ツールです。
「こんまり」流の整理術に基づき、今必要な「ときめく」グループだけが残る状態を実現し、ブラウザの視認性と作業効率を劇的に向上させます。

設計思想や行動指針については [AGENTS.md](AGENTS.md) を参照してください。

## 特徴

* **Smart Merge**: 重複する複数の保存済みエントリを一つに集約し、最新のURLリストとして統合。
* **Batch Cleanup**: 中身が空、あるいは長期間更新がない「冬眠中」のグループを一括消去。
* **Dashboard**: サイドパネルでグループの「健康状態」を可視化。
* **完全ローカル実行**: すべてのデータはユーザーのブラウザ内に留まり、外部サーバーへの送信は一切行われません。
* **Vanilla JS & ゼロ依存**: 外部ライブラリを一切使用せず、軽量かつ高速に動作。
* **Material 3 デザイン**: Google Material 3 (M3) に準拠した、直感的でモダンなUI。

## インストール方法

### ソースコードからインストール

1. このリポジトリからソースコードをダウンロードまたはクローンします。
2. ブラウザで拡張機能管理ページを開きます（Chrome: `chrome://extensions`）。
3. 「デベロッパー モード」をオンにします。
4. 「パッケージ化されていない拡張機能を読み込む」ボタンをクリックし、`projects/app` フォルダを選択します。

## 免責事項

本ソフトウェアは個人開発によるオープンソースプロジェクトであり、無保証です。利用により生じたいかなる損害についても、開発者は一切の責任を負いません。自己責任でご利用ください。
