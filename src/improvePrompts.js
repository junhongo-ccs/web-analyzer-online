// improvePrompts.js (5項目版・B2B対応・HTML出力・構造修正版)
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

// APIキーの確実な取得と検証
const getCleanAPIKey = () => {
  let apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  
  apiKey = apiKey.trim().replace(/[\r\n\t]/g, '');
  
  if (!apiKey.startsWith('sk-')) {
    console.error('❌ Invalid API key format');
    return null;
  }
  
  return apiKey;
};

const apiKey = getCleanAPIKey();
let openai = null;

if (apiKey) {
  try {
    openai = new OpenAI({ apiKey });
    console.log('✅ OpenAI client initialized successfully');
  } catch (error) {
    console.error('❌ OpenAI client initialization failed:', error.message);
  }
} else {
  console.log('⚠️ No valid API key found, using fallback mode');
}

async function getUXImprovementSuggestions({ title, analysisData, url }) {
  const { performance, seo, mobile, accessibility, b2b, formCount, buttonCount, scores } = analysisData;

  // 5項目の総合点計算
  const totalScore = scores.performance + scores.seo + scores.mobile + scores.accessibility + scores.b2bLead;
  const totalPercentage = Math.round((totalScore / 25) * 100);

  // OpenAI APIが使用可能な場合
  if (openai) {
    const accessibilitySummary = accessibility.count > 0 
      ? `${accessibility.count}件の問題検出:\n${accessibility.summary}`
      : 'アクセシビリティ違反なし';

    const b2bSummary = b2b ? `
🏢 B2Bリード獲得力分析 (スコア: ${scores.b2bLead}/5)
- フォーム数: ${b2b.formCount}個
- CTA要素: ${b2b.ctaCount}個
- お問い合わせページ: ${b2b.hasContactPage ? 'あり' : 'なし'}
- 事例・実績ページ: ${b2b.hasCaseStudies ? 'あり' : 'なし'}
- 料金ページ: ${b2b.hasPricingPage ? 'あり' : 'なし'}
- 資料ダウンロード: ${b2b.hasResourceDownloads ? 'あり' : 'なし'}
` : '';

    const analysisReport = `
🔍 ウェブサイト総合分析レポート（5項目版）
URL: ${url}
タイトル: ${title}

📊 総合スコア: ${totalScore}/25点 (${totalPercentage}%)

🚀 パフォーマンス分析 (スコア: ${scores.performance}/5)
- ページ読み込み時間: ${performance.loadTime}ms
- LCP (Largest Contentful Paint): ${performance.lcp || '測定不可'}ms
- FID (First Input Delay): ${performance.fid || '測定不可'}ms  
- CLS (Cumulative Layout Shift): ${performance.cls || '測定不可'}

🔍 SEO分析 (スコア: ${scores.seo}/5)
- タイトルタグ: ${seo.title ? `"${seo.title}"` : '未設定'}
- メタディスクリプション: ${seo.metaDescription ? `"${seo.metaDescription}"` : '未設定'}
- 見出し構造: H1=${seo.headings.h1}, H2=${seo.headings.h2}, H3=${seo.headings.h3}
- 画像: 総数${seo.images.total}個, alt属性あり${seo.images.withAlt}個, alt属性なし${seo.images.withoutAlt}個

📱 モバイル対応分析 (スコア: ${scores.mobile}/5)
- ビューポート設定: ${mobile.viewport || '未設定'}
- レスポンシブデザイン: ${mobile.responsive.hasMediaQueries ? 'メディアクエリあり' : 'メディアクエリなし'}
- タッチターゲット: 総数${mobile.touchTargets.totalTargets}個, 適切なサイズ${mobile.touchTargets.adequateTargets}個, 小さすぎる${mobile.touchTargets.smallTargets}個

♿ アクセシビリティ分析 (スコア: ${scores.accessibility}/5)
${accessibilitySummary}

${b2bSummary}

🏗️ HTML構造
- フォーム数: ${formCount}個
- ボタン数: ${buttonCount}個
`;

 const prompt = `
あなたは経験豊富なUX/UIデザイナーかつB2Bマーケティングの専門家です。
以下のウェブサイト分析結果を基に、具体的で実践可能な改善提案を行ってください。

【重要】絶対に<ul>や<li>タグは使用しないでください。すべての箇条書きは<p>・項目内容</p>の形式で記述してください。

${analysisReport}

以下の5つの観点から総合的に評価し、改善提案を行ってください：

1. パフォーマンス改善
2. SEO最適化
3. モバイル対応強化
4. アクセシビリティ向上
5. B2Bリード獲得力強化

回答は必ずHTML形式で、以下の構造で出力してください。<ul>と<li>タグは絶対に使用せず、箇条書きはすべて<p>・内容</p>形式にしてください：

<h3>1. 優先度の高い改善点（上位5つ）</h3>
<p>・改善点1</p>
<p>・改善点2</p>
<p>・改善点3</p>
<p>・改善点4</p>
<p>・改善点5</p>

<h3>2. 具体的な実装方法</h3>
<p>・<strong>改善点1</strong>: 具体的な実装方法の説明</p>
<p>・<strong>改善点2</strong>: 具体的な実装方法の説明</p>
<p>・<strong>改善点3</strong>: 具体的な実装方法の説明</p>
<p>・<strong>改善点4</strong>: 具体的な実装方法の説明</p>
<p>・<strong>改善点5</strong>: 具体的な実装方法の説明</p>

<h3>3. 期待される効果</h3>
<p>・効果1の説明</p>
<p>・効果2の説明</p>
<p>・効果3の説明</p>
<p>・効果4の説明</p>
<p>・効果5の説明</p>

<h3>4. 各項目のスコア評価（1-5点）</h3>
<table class="score-table" style="margin-bottom: 1rem;">
<tr><td>パフォーマンス</td><td>X/5</td></tr>
<tr><td>SEO</td><td>X/5</td></tr>
<tr><td>モバイル対応</td><td>X/5</td></tr>
<tr><td>アクセシビリティ</td><td>X/5</td></tr>
<tr><td>B2Bリード獲得力</td><td>X/5</td></tr>
<tr><td><strong>総合評価</strong></td><td><strong>XX/25点 (XX%)</strong></td></tr>
</table>

<h3>5. B2B特化改善アクション</h3>
<p>・CTAの最適化と配置改善</p>
<p>・リード獲得フォームの改善</p>
<p>・企業向けコンテンツの充実</p>
<p>・信頼性向上施策</p>

<h3>改善後の測定方法</h3>
<p>・測定方法1</p>
<p>・測定方法2</p>
<p>・測定方法3</p>

注意事項:
- <ul>と<li>タグは絶対に使用しないこと
- すべての箇条書きは<p>・項目内容</p>形式にすること
- Markdown記法は一切使用しない
- すべてHTMLタグで構造化する
- 日本語で回答
- B2B視点を必ず含める
- 余分な改行や空白を入れない
`;

    try {
      console.log('🤖 Calling OpenAI API...');
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "あなたは経験豊富なUX/UIデザイナーかつB2Bマーケティングの専門家です。回答は必ずHTMLフォーマットで提供してください。Markdown記法は使用しないでください。divタグは使わず、直接内容を出力してください。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 2500,
        temperature: 0.7
      });

      console.log('✅ OpenAI API response received');
      // ai-suggestionsのdivでラップして返す
      return `<div class="ai-suggestions">${response.choices[0].message.content}</div>`;
    } catch (error) {
      console.error('❌ OpenAI API エラー:', error.message);
      console.log('🔄 Falling back to basic analysis...');
    }
  }

  // フォールバック: HTML形式の基本分析版（5項目対応）
  console.log('📋 Using basic analysis (no OpenAI API)');
  
  let suggestions = `<div class="ai-suggestions">
<h2 style="margin-bottom: 1rem;">🔍 UX分析・改善提案レポート（5項目版）</h2>

<div class="overall-evaluation" style="margin-bottom: 1.5rem;">
<h3 style="margin-bottom: 0.5rem;">📊 総合評価: ${totalScore}/25点 (${totalPercentage}%)</h3>
</div>

<hr style="margin: 1.5rem 0;">

<h3 style="margin-bottom: 1rem;">🚨 優先改善項目</h3>`;

  // パフォーマンス改善提案
  if (scores.performance <= 3) {
    suggestions += `
<h4 style="margin-bottom: 0.8rem;">🚀 パフォーマンス改善 (現在: ${scores.performance}/5)</h4>
<ul style="margin-bottom: 1.2rem;">`;
    
    if (performance.loadTime > 3000) {
      suggestions += `<li style="margin-bottom: 0.5rem;"><strong>ページ読み込み速度の最適化</strong> (現在: ${performance.loadTime}ms)
  <ul style="margin-top: 0.3rem;">
    <li>画像の圧縮・WebP形式への変換</li>
    <li>CSS/JavaScriptファイルの圧縮・結合</li>
    <li>CDNの活用を検討</li>
  </ul>
</li>`;
    }
    
    suggestions += `</ul>`;
  }

  // SEO改善提案
  if (scores.seo <= 3) {
    suggestions += `<h4 style="margin-bottom: 0.8rem;">🔍 SEO最適化 (現在: ${scores.seo}/5)</h4>
<ul style="margin-bottom: 1.2rem;">`;
    
    if (!seo.title) {
      suggestions += `<li style="margin-bottom: 0.5rem;"><strong>タイトルタグの設定</strong> (未設定)</li>`;
    }
    
    if (!seo.metaDescription) {
      suggestions += `<li style="margin-bottom: 0.5rem;"><strong>メタディスクリプションの設定</strong> (未設定)</li>`;
    }
    
    suggestions += `</ul>`;
  }

  // モバイル対応改善提案
  if (scores.mobile <= 3) {
    suggestions += `<h4 style="margin-bottom: 0.8rem;">📱 モバイル対応強化 (現在: ${scores.mobile}/5)</h4>
<ul style="margin-bottom: 1.2rem;">`;
    
    if (mobile.touchTargets.smallTargets > 0) {
      suggestions += `<li style="margin-bottom: 0.5rem;"><strong>タッチターゲットサイズの改善</strong> (${mobile.touchTargets.smallTargets}個が小さすぎる)</li>`;
    }
    
    suggestions += `</ul>`;
  }

  // B2Bリード獲得力改善提案
  if (scores.b2bLead <= 3) {
    suggestions += `<h4 style="margin-bottom: 0.8rem;">🏢 B2Bリード獲得力強化 (現在: ${scores.b2bLead}/5)</h4>
<ul style="margin-bottom: 1.2rem;">
  <li style="margin-bottom: 0.5rem;"><strong>CTAボタンの最適化</strong> - お問い合わせ・資料請求ボタンを目立つ位置に配置</li>
  <li style="margin-bottom: 0.5rem;"><strong>企業導入事例の充実</strong> - 信頼性向上のため具体的な事例を掲載</li>
  <li style="margin-bottom: 0.5rem;"><strong>リードフォームの簡素化</strong> - 入力項目を最小限にしてコンバージョン率向上</li>
  <li style="margin-bottom: 0.5rem;"><strong>料金・サービス詳細の明示</strong> - 意思決定に必要な情報を提供</li>
</ul>`;
  }

  suggestions += `<hr style="margin: 1.5rem 0;">

<h3 style="margin-bottom: 1rem;">📊 スコア評価詳細（5項目）</h3>
<table class="score-table" style="margin-bottom: 1.5rem;">
<tr>
  <td>パフォーマンス</td>
  <td>${scores.performance}/5</td>
  <td>${scores.performance >= 4 ? '優秀' : scores.performance >= 3 ? '標準' : '要改善'}</td>
</tr>
<tr>
  <td>SEO</td>
  <td>${scores.seo}/5</td>
  <td>${scores.seo >= 4 ? '優秀' : scores.seo >= 3 ? '標準' : '要改善'}</td>
</tr>
<tr>
  <td>モバイル対応</td>
  <td>${scores.mobile}/5</td>
  <td>${scores.mobile >= 4 ? '優秀' : scores.mobile >= 3 ? '標準' : '要改善'}</td>
</tr>
<tr>
  <td>アクセシビリティ</td>
  <td>${scores.accessibility}/5</td>
  <td>${scores.accessibility >= 4 ? '優秀' : scores.accessibility >= 3 ? '標準' : '要改善'}</td>
</tr>
<tr>
  <td>B2Bリード獲得力</td>
  <td>${scores.b2bLead}/5</td>
  <td>${scores.b2bLead >= 4 ? '優秀' : scores.b2bLead >= 3 ? '標準' : '要改善'}</td>
</tr>
<tr>
  <td><strong>総合評価</strong></td>
  <td><strong>${totalScore}/25点</strong></td>
  <td><strong>${totalPercentage}%</strong></td>
</tr>
</table>

<hr style="margin: 1.5rem 0;">

<h3 style="margin-bottom: 1rem;">🏢 B2B特化改善アクション</h3>
<div class="b2b-highlight" style="margin-bottom: 1.5rem;">
<h4 style="margin-bottom: 0.8rem;">実測データに基づく改善提案</h4>
<ul style="margin-bottom: 0;">`;

  // B2B分析データに基づく具体的な提案
  if (b2b) {
    if (!b2b.hasContactPage) {
      suggestions += `<li style="margin-bottom: 0.5rem;"><strong>お問い合わせページの設置</strong> - 明確な連絡先とフォームを用意</li>`;
    }
    if (!b2b.hasCaseStudies) {
      suggestions += `<li style="margin-bottom: 0.5rem;"><strong>導入事例ページの作成</strong> - 具体的な成功事例を掲載</li>`;
    }
    if (!b2b.hasPricingPage) {
      suggestions += `<li style="margin-bottom: 0.5rem;"><strong>料金プランページの公開</strong> - 透明性のある価格情報を提供</li>`;
    }
    if (!b2b.hasResourceDownloads) {
      suggestions += `<li style="margin-bottom: 0.5rem;"><strong>資料ダウンロード機能の追加</strong> - ホワイトペーパーやカタログを提供</li>`;
    }
    if (b2b.ctaCount < 3) {
      suggestions += `<li style="margin-bottom: 0.5rem;"><strong>CTAボタンの増設</strong> - 現在${b2b.ctaCount}個→3個以上に増やす</li>`;
    }
  }

  suggestions += `</ul>
</div>

<p style="margin: 0;"><em>このレポートは自動生成されました。具体的な実装については、技術的制約や業務要件を考慮して調整してください。</em></p>
</div>`;

  return suggestions;
}

export { getUXImprovementSuggestions };