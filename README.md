# Portfilio - 資産バランス管理アプリ

Portfilioは、投資資産のバランスを簡単に管理・可視化するためのウェブアプリケーションです。日本株、米国株、投資信託などの資産を一元管理し、最適な資産配分を実現するためのツールです。

## 主な機能

- **資産の一元管理**: 日本株、米国株、投資信託などの資産を一箇所で管理
- **リアルタイム株価取得**: Google FinanceとYahoo! Financeから最新の株価データを自動取得
- **資産配分の可視化**: 円グラフによる資産配分の視覚化（小数点第一位まで表示）
- **QRコードによるデータ転送**: 複数デバイス間でのデータ共有が簡単に
- **自動株価更新**: 定期的な株価の自動更新機能

## 使い方

開発サーバーを起動するには:

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションを利用できます。

## 技術スタック

- [Next.js](https://nextjs.org) - Reactフレームワーク
- [React](https://reactjs.org) - UIライブラリ
- [Chart.js](https://www.chartjs.org) - データ可視化
- [QRCode.react](https://www.npmjs.com/package/qrcode.react) - QRコード生成
- [ZXing](https://github.com/zxing-js/library) - QRコード読み取り

## バージョン履歴

現在のバージョン: v1.0.17

主な更新内容:
- v1.0.17 - 表示の改善：資産割合の％表示を小数点第一位まで表示するように変更
- v1.0.16 - 開発環境の改善：Turbopackフラグを削除し、ビルドの安定性を向上
- v1.0.15 - デバッグ機能を強化：Googleファイナンスからの株価取得プロセスの詳細ログを追加
- v1.0.14 - 特別処理を削除：銘柄コード2014の固定価格設定を削除し、実際のGoogle Finance価格を使用
- v1.0.13 - 株価取得方法を改善：Google Financeからの株価取得を優先化し、小数点第一位まで表示
- v1.0.12 - 為替レート計算ロジックを改善：市場が米国株の場合のみ為替レート計算を適用
- v1.0.11 - 投資国設定の保持機能を追加：ユーザーが選択した投資国を尊重
- v1.0.10 - ローカルストレージの永続性を強化：データ保存と復元機能を改善

詳細な更新履歴は[version.ts](app/version.ts)ファイルを参照してください。

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。 