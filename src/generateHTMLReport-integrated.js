// generateHTMLReport-integrated.js
import fs from 'fs';

// 🆕 色のコントラストを計算して文字色を決定するヘルパー関数
function getContrastColor(hexColor) {
  // #を除去
  const hex = hexColor.replace('#', '');
  
  // RGBに変換
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // 輝度を計算
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // 輝度に基づいて白か黒を返す
  return brightness > 128 ? '#000000' : '#ffffff';
}

export async function generateHTMLReport(options) {
  const {
    title,
    url,
    scoreData,
    analysisData,
    outputFile
  } = options;

  // 【修正済み】5項目レーダーチャート用のCSS代替チャート生成
  function createIntegratedCSSRadarChart(scoreData) {
    const items = [
      { label: 'パフォーマンス', score: scoreData.performance, rotation: '0deg' },
      { label: 'SEO', score: scoreData.seo, rotation: '72deg' },
      { label: 'モバイル対応', score: scoreData.mobile, rotation: '144deg' },
      { label: 'アクセシビリティ', score: scoreData.accessibility, rotation: '216deg' },
      { label: 'B2Bリード獲得力', score: scoreData.b2bLead, rotation: '288deg' }
    ];

    return `
      <div class="css-radar-chart-5">
        ${items.map(item => `
        <div class="radar-item-5" style="--score: ${item.score}; --rotation: ${item.rotation};">
          <div class="radar-label-5">${item.label}</div>
          <div class="radar-value-5">${item.score}</div>
        </div>`).join('')}
      </div>`;
  }

  // 🆕 analysisDataから直接HTMLコンテンツを生成する関数
  function generateDirectHTMLContent(analysisData) {
    const { performance, seo, mobile, accessibility, b2b, formCount, buttonCount, scores, gptSuggestions, visual } = analysisData;
    
    return `
    <h1>📊 分析結果詳細</h1>
    
    <h2>🚀 パフォーマンス分析</h2>
    <p><strong>読み込み時間:</strong> ${performance.loadTime}ms</p>
    <p><strong>LCP (メインコンテンツ表示時間。2.5秒以内が良好。):</strong> ${performance.lcp || '測定不可'}ms</p>
    <p><strong>FID (初回入力遅延。クリック反応速度を測定。100ms以下推奨。):</strong> ${performance.fid !== null ? performance.fid + 'ms' : (performance.tbt ? `測定不可 (TBT: ${performance.tbt}ms)` : '測定不可')}</p>
    <p><strong>CLS (レイアウトのずれ。0.1以下で安定したページ。):</strong> ${performance.cls || 0}</p>
    <p><strong>FCP (最初の表示時間。1.8秒以内でユーザーに安心感。):</strong> ${performance.fcp || '測定不可'}ms</p>
         <p>
    <small>※ms（ミリ秒）= 1/1000秒。1000ms = 1秒。数値が小さいほど高速です。<br>
    これらの指標はGoogleの検索順位とユーザー満足度に直結します。</small>
  </p>

    <h2>🔍 SEO分析</h2>
    <p><strong>タイトル:</strong> ${seo.title || '未設定'}</p>
    <p><strong>メタディスクリプション:</strong> ${seo.metaDescription ? '設定済み' : '未設定'}</p>
    <p><strong>H1タグ:</strong> ${seo.headings.h1}個</p>
    <p><strong>H2タグ:</strong> ${seo.headings.h2}個</p>
    <p><strong>H3タグ:</strong> ${seo.headings.h3}個</p>
    <p><strong>画像alt属性:</strong> ${seo.images.withAlt}/${seo.images.total}個</p>


    <h2>📱 モバイル対応</h2>
    <p><strong>ビューポート:</strong> ${mobile.viewport ? '対応' : '未対応'}</p>
    <p><strong>レスポンシブ:</strong> ${mobile.responsive.hasMediaQueries ? '対応' : '未対応'}</p>
    <p><strong>タッチターゲット:</strong> ${mobile.touchTargets.adequateTargets}/${mobile.touchTargets.totalTargets}個が適切</p>
    
    <h2>♿ アクセシビリティ</h2>
    <p><strong>検出された問題:</strong> ${accessibility.count}件</p>
    ${accessibility.count > 0 ? `<p>${accessibility.summary}</p>` : '<p>✅ アクセシビリティ問題なし</p>'}
    
    <h2>🏢 B2Bリード獲得力分析</h2>
    <div>
      <p><strong>スコア:</strong> ${scores.b2bLead}/5</p>
      
      ${b2b ? `
        <h3>基本要素</h3>
        <p><strong>フォーム数:</strong> ${b2b.formCount || 0}個</p>
        <p><strong>CTAボタン数:</strong> ${b2b.ctaCount || 0}個</p>
        <p><strong>お問い合わせページ:</strong> ${b2b.hasContactPage ? 'あり ✅' : 'なし ❌'}</p>
        <p><strong>導入事例・実績:</strong> ${b2b.hasCaseStudies ? 'あり ✅' : 'なし ❌'}</p>
        <p><strong>料金ページ:</strong> ${b2b.hasPricingPage ? 'あり ✅' : 'なし ❌'}</p>
        <p><strong>資料ダウンロード:</strong> ${b2b.hasResourceDownloads ? 'あり ✅' : 'なし ❌'}</p>
        <p><strong>会社概要:</strong> ${b2b.hasCompanyInfo ? 'あり ✅' : 'なし ❌'}</p>
        <p><strong>FAQ:</strong> ${b2b.hasFAQ ? 'あり ✅' : 'なし ❌'}</p>
        <p><strong>プライバシーポリシー:</strong> ${b2b.hasPrivacyPolicy ? 'あり ✅' : 'なし ❌'}</p>
        <p><strong>ニュース・お知らせ:</strong> ${b2b.hasNewsSection ? 'あり ✅' : 'なし ❌'}</p>
        
        ${b2b.aiEvaluation ? `
          <h3>🤖 AI評価</h3>
          <p><strong>総評:</strong> ${b2b.aiEvaluation.impression}</p>
          
          <h4>✨ 強み</h4>
          ${b2b.aiEvaluation.strengths.map(strength => `<p>・${strength}</p>`).join('')}
          
          <h4>⚠️ 弱み</h4>
          ${b2b.aiEvaluation.weaknesses.map(weakness => `<p>・${weakness}</p>`).join('')}
          
          <h4>💡 改善提案</h4>
          ${b2b.aiEvaluation.improvements.map(improvement => `<p>・${improvement}</p>`).join('')}
        ` : ''}
      ` : '<p>B2B分析データが利用できません</p>'}
    </div>
    
    <h2>🏗️ HTML構造</h2>
    <p><strong>フォーム数:</strong> ${formCount}個</p>
    <p><strong>ボタン数:</strong> ${buttonCount}個</p>
    
  ${visual ? `
  <h2>🎨 視覚的印象分析</h2>
  <div>
    <h3>色彩分析</h3>
    <p><strong>主要カラー:</strong> ${visual.primaryColors && visual.primaryColors.length > 0 
      ? visual.primaryColors.map(color => 
          `<span style="display: inline-block; background-color: ${color}; color: ${getContrastColor(color)}; padding: 4px 12px; margin: 0 5px; border-radius: 3px; font-weight: bold;">${color}</span>`
        ).join('')
      : '色情報なし'
    }</p>
    <p><strong>配色の印象:</strong> ${visual.colorImpression || '評価なし'}</p>
    
    <h3>デザイン評価</h3>
    <p><strong>デザインスタイル:</strong> ${visual.designStyle || '未評価'}</p>
    <p><strong>B2B向け適切性:</strong> ${visual.b2bAppropriate ? '適切 ✅' : '要改善 ⚠️'}</p>
    <p><strong>視覚的階層:</strong> ${visual.visualHierarchy || '未評価'}</p>
    
    <h3>ブランディング</h3>
    <p><strong>ブランディングスコア:</strong> ${visual.brandingScore || 0}/5 ${'⭐'.repeat(visual.brandingScore || 0)}</p>
    <p><strong>総合印象:</strong> ${visual.overallImpression || '未評価'}</p>
    
    <h3>視覚的改善提案</h3>
    ${visual.suggestions && Array.isArray(visual.suggestions) && visual.suggestions.length > 0
      ? visual.suggestions.map(suggestion => `<p>・${suggestion}</p>`).join('')
      : '<p>改善提案はありません</p>'
    }
  </div>
  ` : ''}

 <h2>🤖 AI改善提案・総合評価</h2>
<div class="ai-suggestions-content" style="padding: 1.5rem; margin: 1rem 0;">
  ${gptSuggestions || '<p style="color: #666;">AI分析結果の取得に失敗しました</p>'}
</div>
    
    <h2>📈 総合評価</h2>
    <p><strong>総合スコア:</strong> ${scores.overall}/25 (${Math.round((scores.overall/25)*100)}%)</p>
    <p>🚀 <strong>パフォーマンス:</strong> ${scores.performance}/5</p>
    <p>🔍 <strong>SEO:</strong> ${scores.seo}/5</p>
    <p>📱 <strong>モバイル対応:</strong> ${scores.mobile}/5</p>
    <p>♿ <strong>アクセシビリティ:</strong> ${scores.accessibility}/5</p>
    <p>🏢 <strong>B2Bリード獲得力:</strong> ${scores.b2bLead}/5</p>
  `;
  }

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Web分析レポート</title>
  <style>
    body { 
      font-family: 'Helvetica Neue', Arial, sans-serif; 
      background: #e7ecee; 
      padding: 1rem; 
      color: #333; 
      margin: 0;
      line-height: 1.4;
    }
    .container { 
      max-width: 1000px; 
      margin: auto; 
      background: #fff; 
      padding: 1.5rem; 
      border-radius: 8px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { 
      color: #10a37f; 
      text-align: center;
      margin-bottom: 1rem;
      font-size: 2rem;
    }
    h2 {
      color: #333;
      border-bottom: 2px solid #10a37f;
      padding-bottom: 0.3rem;
      margin: 1.5rem 0 1rem 0;
      font-size: 1.3rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    h3 {
      color: #555;
      font-size: 1.2rem;
      margin-top: 1.2rem;
      margin-bottom: 0.6rem;
    }
    h4 {
      color: #666;
      font-size: 1.1rem;
      margin-top: 1rem;
      margin-bottom: 0.5rem;
    }
    .meta-info {
      background: #ffffff; 
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1.5rem;
      text-align: center;
    }
    .meta-info h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.2rem;
    }
    .meta-info p {
      margin: 0.3rem 0;
      font-size: 0.9rem;
    }
    .overall-score {
      font-size: 2rem;
      font-weight: bold;
      color: #10a37f;
      margin: 0.5rem 0;
    }
    
    /* 5項目対応のスコアカード */
    .score-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0.8rem;
      margin: 1.5rem 0;
    }
    .score-card {
      background: linear-gradient(135deg, #f0f8ff, #e6f3ff);
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
      border: 1px solid #e0e0e0;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .score-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(16, 163, 127, 0.15);
    }
    .score-card.b2b-card {
      background: linear-gradient(135deg, #fff0f5, #ffeef8);
      border: 1px solid #e6b3d4;
    }
    .score-value {
      font-size: 1.6rem;
      font-weight: bold;
      color: #10a37f;
      margin-bottom: 0.3rem;
    }
    .score-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #555;
      line-height: 1.2;
    }
    
    /* チャートコンテナ */
    .chart-container {
      text-align: center;
      margin: 1.5rem 0;
      background: #f9f9f9;
      padding: 1rem;
      border-radius: 8px;
  
    }
    .chart-wrapper {
      position: relative;
      max-width: 400px;
      margin: 0 auto;
      min-height: 300px;
    }
    #radarChart {
      max-width: 100% !important;
      max-height: 300px !important;
    }
    
    /* 【修正済み】5項目対応のCSS代替レーダーチャート */
    .css-radar-chart-5 {
      position: relative;
      width: 280px;
      height: 280px;
      margin: 0 auto;
      border: 2px solid #e0e0e0;
      border-radius: 50%;
      background: 
        radial-gradient(circle, transparent 50px, rgba(16, 163, 127, 0.1) 50px, rgba(16, 163, 127, 0.1) 90px, transparent 90px),
        radial-gradient(circle, transparent 90px, rgba(16, 163, 127, 0.1) 90px, rgba(16, 163, 127, 0.1) 130px, transparent 130px);
    }
    
    .css-radar-chart-5::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 2px;
      height: 100%;
      background: rgba(16, 163, 127, 0.3);
      transform: translate(-50%, -50%);
    }
    
    .css-radar-chart-5::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 100%;
      height: 2px;
      background: rgba(16, 163, 127, 0.3);
      transform: translate(-50%, -50%);
    }
    
    .radar-item-5 {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 130px;
      height: 130px;
      transform: translate(-50%, -50%) rotate(var(--rotation));
      transform-origin: center;
    }
    
    .radar-item-5::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      width: 8px;
      height: calc(var(--score) * 22px);
      background: #10a37f;
      border-radius: 4px;
      transform: translateX(-50%);
      max-height: 110px;
    }
    
    .radar-label-5 {
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%) rotate(calc(-1 * var(--rotation)));
      font-size: 0.7rem;
      font-weight: bold;
      color: #333;
      white-space: nowrap;
      text-align: center;
      max-width: 80px;
      line-height: 1.1;
    }
    
    .radar-value-5 {
      position: absolute;
      top: calc(var(--score) * 22px - 12px);
      left: 50%;
      transform: translateX(-50%) rotate(calc(-1 * var(--rotation)));
      font-size: 0.85rem;
      font-weight: bold;
      color: #10a37f;
      background: white;
      border: 1px solid #10a37f;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* ステータス表示 */
    .loading {
      text-align: center;
      color: #666;
      font-style: italic;
      padding: 1rem;
      border: 1px dashed #ccc;
      border-radius: 6px;
      background: #f0f0f0;
      font-size: 0.9rem;
    }
    .error {
      color: #d32f2f;
      background: #ffebee;
      padding: 0.8rem;
      border-radius: 5px;
      text-align: center;
      border: 1px solid #f44336;
      font-size: 0.9rem;
    }
    .success {
      color: #2e7d32;
      background: #e8f5e8;
      padding: 0.8rem;
      border-radius: 5px;
      text-align: center;
      border: 1px solid #4caf50;
      font-size: 0.9rem;
    }
    
    /* コンテンツ部分 */
    .content-section {
      background: #fafafa;
      padding: 1.5rem;
      border-radius: 8px;
      line-height: 1.6;
      font-size: 0.9rem;
    
      margin-top: 1rem;
    }
    
    .content-section p {
      margin: 0.8rem 0;
    }
    
    .content-section ul {
      margin: 0.8rem 0;
      padding-left: 1.5rem;
    }
    
    .content-section li {
      margin: 0.4rem 0;
    }
    
    .content-section hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 1.5rem 0;
    }
    
    .content-section code {
      background: #f0f0f0;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-size: 0.85rem;
      font-family: 'Courier New', monospace;
    }
    
    .content-section strong {
      color: #10a37f;
      font-weight: bold;
    }
    
    /* 表のスタイル */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 0.85rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .data-table th {
      background: linear-gradient(135deg, #10a37f, #0d8f6f);
      color: white;
      padding: 0.8rem;
      text-align: left;
      font-weight: bold;
      border: 1px solid #0d8f6f;
    }
    
    .data-table td {
      padding: 0.6rem 0.8rem;
      border: 1px solid #ddd;
      background: white;
    }
    
    .data-table tr:nth-child(even) td {
      background: #f9f9f9;
    }
    
    .data-table tr:hover td {
      background: #f0f8ff;
    }
    
    /* レスポンシブ対応 */
    @media (max-width: 768px) {
      .container { 
        padding: 1rem; 
        margin: 0.5rem;
      }
      .score-grid { 
        grid-template-columns: repeat(2, 1fr);
        gap: 0.6rem;
      }
      h1 { 
        font-size: 1.6rem;
        margin-bottom: 0.8rem;
      }
      h2 {
        font-size: 1.1rem;
        margin: 1rem 0 0.8rem 0;
      }
      .chart-wrapper { 
        min-height: 250px; 
      }
      #radarChart {
        max-height: 250px !important;
      }
      .css-radar-chart-5 {
        width: 220px;
        height: 220px;
      }
      .score-value {
        font-size: 1.4rem;
      }
      .score-label {
        font-size: 0.75rem;
      }
      .overall-score {
        font-size: 2rem;
      }
      .data-table {
        font-size: 0.75rem;
      }
      .data-table th,
      .data-table td {
        padding: 0.5rem;
      }
    }
    
    @media (max-width: 480px) {
      .score-grid {
        grid-template-columns: 1fr 1fr;
      }
      .container {
        padding: 0.8rem;
      }
      .css-radar-chart-5 {
        width: 180px;
        height: 180px;
      }
      .data-table {
        font-size: 0.7rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>UXT | Web分析レポート</h1>
    
    <div class="meta-info">
      <h3><strong>🌐 対象:</strong> <a href="${url}" target="_blank">${url}</a></h3>
   
      <p><strong>分析日:</strong> ${new Date().toLocaleString('ja-JP')}</p>
      <div class="overall-score">${scoreData.overall}/25</div>
      <p style="margin: 0; font-size: 0.85rem;">総合スコア</p>
    </div>

    <h2>📈 スコア詳細（5項目評価）</h2>
    <div class="score-grid">
      <div class="score-card">
        <div class="score-value">${scoreData.performance}/5</div>
        <div class="score-label">🚀 パフォーマンス</div>
      </div>
      <div class="score-card">
        <div class="score-value">${scoreData.seo}/5</div>
        <div class="score-label">🔍 SEO</div>
      </div>
      <div class="score-card">
        <div class="score-value">${scoreData.mobile}/5</div>
        <div class="score-label">📱 モバイル対応</div>
      </div>
      <div class="score-card">
        <div class="score-value">${scoreData.accessibility}/5</div>
        <div class="score-label">♿ アクセシビリティ</div>
      </div>
      <div class="score-card b2b-card">
        <div class="score-value">${scoreData.b2bLead}/5</div>
        <div class="score-label">🏢 B2Bリード獲得力</div>
      </div>
    </div>

    <div class="chart-container">
      <h2 style="margin-top: 0;">📊 5項目レーダーチャート</h2>
      <div class="chart-wrapper">
        <div id="chartStatus" class="loading">📈 チャートを初期化中...</div>
        <canvas id="radarChart" style="display: none;"></canvas>
        <div id="fallbackChart" style="display: none;">
          ${createIntegratedCSSRadarChart(scoreData)}
        </div>
      </div>
    </div>

    <h2>📝 詳細レポート</h2>
    <div class="content-section">
      ${generateDirectHTMLContent(analysisData)}
    </div>
  </div>

  <!-- Chart.js CDN -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js" onerror="loadFallbackChart()"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.js" onerror="loadFallbackChart()"></script>
  
  <script>
    let chartInitialized = false;
    let fallbackDisplayed = false;
    
    // CSS代替チャートを表示
    function loadFallbackChart() {
      if (fallbackDisplayed) return;
      fallbackDisplayed = true;
      
      console.log('🔄 Loading CSS fallback chart');
      const statusElement = document.getElementById('chartStatus');
      const fallbackElement = document.getElementById('fallbackChart');
      
      statusElement.innerHTML = '<div class="success">✅ 代替チャート表示</div>';
      setTimeout(() => {
        statusElement.style.display = 'none';
        fallbackElement.style.display = 'block';
      }, 800);
    }
    
    // 【修正済み】Chart.js初期化関数（5項目対応）
    function initializeChart() {
      if (chartInitialized || fallbackDisplayed) return;
      
      const statusElement = document.getElementById('chartStatus');
      const canvasElement = document.getElementById('radarChart');
      
      try {
        if (typeof Chart === 'undefined') {
          throw new Error('Chart.js library not loaded');
        }
        
        const chartData = {
          labels: ["パフォーマンス","SEO","モバイル対応","アクセシビリティ","B2Bリード獲得力"],
          datasets: [{
            label: 'スコア (5点満点)',
            data: [${scoreData.performance},${scoreData.seo},${scoreData.mobile},${scoreData.accessibility},${scoreData.b2bLead}],
            fill: true,
            backgroundColor: 'rgba(16, 163, 127, 0.2)',
            borderColor: 'rgba(16, 163, 127, 1)',
            pointBackgroundColor: 'rgba(16, 163, 127, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(16, 163, 127, 1)',
            pointRadius: 6,
            pointHoverRadius: 8,
            borderWidth: 2
          }]
        };
        
        const config = {
          type: 'radar',
          data: chartData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              r: {
                min: 0,
                max: 5,
                ticks: {
                  stepSize: 1,
                  font: { size: 10 },
                  backdropColor: 'rgba(255, 255, 255, 0.8)'
                },
                pointLabels: {
                  font: { 
                    size: 11, 
                    weight: 'bold' 
                  },
                  color: '#333'
                },
                grid: { 
                  color: 'rgba(0,0,0,0.1)',
                  lineWidth: 1
                },
                angleLines: { 
                  color: 'rgba(0,0,0,0.1)',
                  lineWidth: 1
                }
              }
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: { 
                  font: { size: 11 }, 
                  padding: 15,
                  usePointStyle: true
                }
              },
              title: {
                display: false
              }
            },
            animation: {
              duration: 1500,
              easing: 'easeInOutQuart'
            }
          }
        };

        const chart = new Chart(canvasElement, config);
        chartInitialized = true;
        
        statusElement.innerHTML = '<div class="success">✅ Chart.js チャート表示</div>';
        setTimeout(() => {
          statusElement.style.display = 'none';
          canvasElement.style.display = 'block';
        }, 800);
        
        console.log('✅ Chart.js chart created successfully');
        
      } catch (error) {
        console.error('❌ Chart initialization error:', error);
        loadFallbackChart();
      }
    }

    // 初期化実行
    function startChartInitialization() {
      let attempts = 0;
      const maxAttempts = 100;
      
      const tryInitialize = () => {
        attempts++;
        
        if (typeof Chart !== 'undefined') {
          console.log('✅ Chart.js detected, initializing...');
          initializeChart();
        } else if (attempts < maxAttempts) {
          setTimeout(tryInitialize, 100);
        } else {
          console.log('⚠️ Chart.js timeout, using fallback');
          loadFallbackChart();
        }
      };
      
      tryInitialize();
    }

    // DOM読み込み完了後に実行
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startChartInitialization);
    } else {
      startChartInitialization();
    }
    
    // 追加の安全策
    window.addEventListener('load', () => {
      if (!chartInitialized && !fallbackDisplayed) {
        setTimeout(() => {
          if (!chartInitialized && !fallbackDisplayed) {
            console.log('🔄 Final fallback trigger');
            loadFallbackChart();
          }
        }, 2000);
      }
    });
    
    // 最終手段
    setTimeout(() => {
      if (!chartInitialized && !fallbackDisplayed) {
        console.log('🚨 Emergency fallback');
        loadFallbackChart();
      }
    }, 5000);
  </script>
</body>
</html>`;

  fs.writeFileSync(outputFile, html, 'utf-8');
}