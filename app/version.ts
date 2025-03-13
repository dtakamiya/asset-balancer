/**
 * アプリケーションのバージョン情報
 * 
 * バージョン形式: v1.0.0
 * - メジャーバージョン: 大きな機能追加や互換性のない変更
 * - マイナーバージョン: 後方互換性のある機能追加
 * - パッチバージョン: バグ修正や小さな改善
 */

export const APP_VERSION = 'v1.0.9';

/**
 * バージョン履歴
 * 
 * v1.0.0 - 初回リリース
 * v1.0.1 - 米国株の表示を改善
 * v1.0.2 - 投資信託の表示を改善
 * v1.0.3 - QRコードによるデータ転送機能を追加
 * v1.0.4 - データ転送機能を改善：日本株と米国株のデータ転送に対応
 * v1.0.5 - QRコードの読み取り精度を向上：チャンクサイズ縮小とエラー訂正レベル追加
 * v1.0.6 - 株価更新処理を改善：データ更新中の情報損失を防止
 * v1.0.7 - QRコードデータの保持機能を改善：株価更新後もインポートデータを維持
 * v1.0.8 - コードの重複宣言を修正：アプリケーションの安定性を向上
 * v1.0.9 - 日本市場銘柄の計算方法を改善：数字のみの銘柄コードは日本円で計算
 */

export const VERSION_HISTORY = `
* v1.0.9 - 日本市場銘柄の計算方法を改善：数字のみの銘柄コードは日本円で計算
* v1.0.8 - コードの重複宣言を修正：アプリケーションの安定性を向上
* v1.0.7 - QRコードデータの保持機能を改善：株価更新後もインポートデータを維持
* v1.0.6 - 株価更新処理を改善：データ更新中の情報損失を防止
* v1.0.5 - QRコードの読み取り精度を向上：チャンクサイズ縮小とエラー訂正レベル追加
* v1.0.4 - データ転送機能を改善：日本株と米国株のデータ転送に対応
* v1.0.3 - QRコードによるデータ転送機能を追加
* v1.0.2 - 投資信託の表示を改善
* v1.0.1 - 米国株の表示を改善
* v1.0.0 - 初回リリース
`; 