# SF Symbols icon assets

このディレクトリには Web 用の SVG アイコンを配置します。

## 運用手順（Mac で SF Symbols App を使用）
1. SF Symbols App を開く
2. 対象シンボルを選択
3. `File > Export Symbol...` で SVG を出力
4. 出力ファイル名を、画面側のシンボル名に合わせて保存
   - 例: `magnifyingglass.svg`, `chart.bar.svg`, `checkmark.circle.fill.svg`
5. この `public/icons/sf` に上書き配置

## 注意
- ライセンス・利用制限は Apple のドキュメントに従ってください。
- 本プロジェクトでは `public/index.html` 内の `icon("symbol.name")` 呼び出しで参照します。
