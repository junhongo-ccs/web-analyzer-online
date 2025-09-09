# web-analyzer-online
日本語B2Bサイト専用Web分析システム - 5項目評価・AI改善提案・ペルソナ分析対応
# Web分析システム - オンライン版

日本語サイト専用のWeb分析システムをGitHub Codespacesで動作させるプロトタイプです。

## 機能

- **5項目評価**: パフォーマンス、SEO、モバイル対応、アクセシビリティ、B2Bリード獲得力
- **AI改善提案**: OpenAI GPT-4による詳細な改善提案
- **リアルタイム分析**: Webインターフェースでの進捗表示
- **複数URL対応**: 一度に複数サイトを分析

## GitHub Codespacesでの起動手順

### 1. リポジトリの準備

```bash
# 新しいGitHubリポジトリを作成し、以下のファイルをアップロード：
├── .devcontainer/
│   └── devcontainer.json
├── public/
│   └── index.html
├── src/
│   ├── analyze-all.js          # ローカル版から移行
│   ├── axe-integration.js      # ローカル版から移行
│   ├── improvePrompts.js       # ローカル版から移行
│   └── generateHTMLReport-integrated.js  # ローカル版から移行
├── app.js
├── package.json
└── README.md
```

### 2. Codespacesの起動

1. GitHubリポジトリページで「Code」→「Codespaces」→「Create codespace」
2. 環境構築が自動実行されます（5-10分）

### 3. 環境変数の設定

```bash
# Codespaces内で環境変数を設定
export OPENAI_API_KEY="sk-your-api-key-here"

# または .envファイルを作成
echo "OPENAI_API_KEY=sk-your-api-key-here" > .env
```

### 4. サーバーの起動

```bash
# 依存関係のインストール（自動実行済み）
npm install

# サーバー起動
npm start
```

### 5. アクセス

- Codespacesが自動でポート3000を転送
- 通知されるURLをクリックしてアクセス

## ローカルファイルの移行

既存のローカル版から以下のファイルを `src/` ディレクトリにコピー：

```bash
# 必要なファイル
src/axe-integration.js          # アクセシビリティ分析
src/improvePrompts.js           # AI改善提案
src/generateHTMLReport-integrated.js  # レポート生成

# 不要なファイル（app.jsに統合済み）
analyze-all.js                  # → app.jsに統合
```

## API制限と注意事項

### GitHub Codespaces制限
- **無料プラン**: 月60時間
- **メモリ**: 4GB（Playwright用に十分）
- **同時分析**: 1サイトずつ推奨

### OpenAI API
- APIキーが必要（$5-20/月程度）
- 未設定の場合は基本分析のみ実行

### 分析制限
- **タイムアウト**: 30秒/サイト
- **同時実行**: 1サイト（Codespaces配慮）
- **ファイル永続化**: Codespacesを削除すると消失

## トラブルシューティング

### よくあるエラー

```bash
# 1. Playwright エラー
Error: Browser not found
→ 解決: npx playwright install chromium

# 2. OpenAI API エラー  
Error: Invalid API key
→ 解決: 環境変数を確認

# 3. メモリ不足
Error: Cannot allocate memory
→ 解決: 分析URL数を減らす（5個以下推奨）
```

### デバッグ方法

```bash
# ログ確認
npm run dev  # 開発モード（自動再起動）

# 分析ログ確認
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://example.com"]}'
```

## 本格運用への移行

プロトタイプで動作確認後、以下へ移行推奨：

1. **Railway**: 永続化 + スケーリング
2. **Google Cloud Run**: サーバーレス
3. **ローカル Docker**: 社内運用

## ファイル構成

```
web-analyzer-online/
├── .devcontainer/
│   └── devcontainer.json      # Codespaces環境設定
├── public/
│   └── index.html             # フロントエンドUI
├── src/
│   ├── axe-integration.js     # アクセシビリティ分析
│   ├── improvePrompts.js      # AI改善提案
│   └── generateHTMLReport-integrated.js  # レポート生成
├── app.js                     # Expressサーバー
├── package.json               # 依存関係
└── README.md                  # このファイル
```

## ライセンス

MIT License - 社内利用・改修自由