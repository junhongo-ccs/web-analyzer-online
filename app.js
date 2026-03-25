import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { runAxeAnalysis } from './src/axe-integration.js';
import { getUXImprovementSuggestions } from './src/improvePrompts.js';
import { generateHTMLReport } from './src/generateHTMLReport-integrated.js';
import { openai } from './src/config.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsDir = path.join(__dirname, 'reports');

// 'reports' ディレクトリが存在しない場合は作成
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 分析状況を保存するメモリストレージ（TTL付き）
const analysisStatus = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30分

// セッション自動クリーンアップ
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of analysisStatus.entries()) {
    if (now - session.createdAt > SESSION_TIMEOUT) {
      analysisStatus.delete(sessionId);
      console.log(`🗑️ セッション ${sessionId} を自動削除`);
    }
  }
}, 5 * 60 * 1000); // 5分間隔でクリーンアップ

// URL検証関数
function validateUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // HTTPSまたはHTTPのみ許可
    if (!['https:', 'http:'].includes(urlObj.protocol)) {
      return false;
    }
    
    // ローカルホスト・プライベートIPアドレスを拒否（SSRF対策）
    const hostname = urlObj.hostname.toLowerCase();
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// ルート
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 分析API
app.post('/api/analyze', async (req, res) => {
  const { urls } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLsが必要です' });
  }
  
  // URL数制限
  if (urls.length > 10) {
    return res.status(400).json({ error: '一度に分析できるURLは10個までです' });
  }
  
  // URL検証
  const invalidUrls = urls.filter(url => !validateUrl(url));
  if (invalidUrls.length > 0) {
    return res.status(400).json({ 
      error: '無効なURLが含まれています',
      invalidUrls
    });
  }

  const sessionId = Date.now().toString();
  analysisStatus.set(sessionId, {
    status: 'running',
    progress: 0,
    total: urls.length,
    results: [],
    createdAt: Date.now()
  });

  // 非同期で分析実行
  runAnalysis(sessionId, urls);

  res.json({ sessionId, message: '分析を開始しました' });
});

// ヘルスチェックAPI
app.get('/api/status/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: Date.now(),
    openai: !!openai
  });
});

// 分析状況確認API  
app.get('/api/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const status = analysisStatus.get(sessionId);

  if (!status) {
    return res.status(404).json({ error: 'セッションが見つかりません' });
  }

  res.json(status);
});

// ブラウザプールの管理
let browserPool = null;
let activeBrowsers = 0;
const MAX_BROWSERS = 3;

async function getBrowser() {
  if (activeBrowsers < MAX_BROWSERS) {
    activeBrowsers++;
    return await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
  }
  
  // 既存のブラウザを再利用
  if (browserPool && !browserPool.isClosed()) {
    return browserPool;
  }
  
  // 新しいブラウザを作成
  browserPool = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  return browserPool;
}

async function releaseBrowser(browser, shouldClose = false) {
  if (shouldClose && browser !== browserPool) {
    await browser.close();
    activeBrowsers--;
  }
}


// 分析実行関数
async function runAnalysis(sessionId, urls) {
  const session = analysisStatus.get(sessionId);
  let browser = null;

  try {
    browser = await getBrowser();
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      // プログレス更新
      session.progress = i;
      session.currentUrl = url;

      console.log(`🔍 [${i + 1}/${urls.length}] 分析中: ${url}`);

      const page = await browser.newPage();

      try {
        // ページ設定の最適化
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.setDefaultTimeout(30000);
        
        await page.goto(url, { 
          waitUntil: 'networkidle', 
          timeout: 30000 
        });

        // 分析実行（並列処理可能なものは並列化）
        const [performance, html, mobile, axeResults] = await Promise.all([
          analyzePerformance(page),
          page.content(),
          analyzeMobile(page),
          runAxeAnalysis(page)
        ]);
        
        const seo = analyzeSEO(html);
        const b2bAnalysis = await analyzeB2BWithAI(page);

        // スコア計算
        const scores = calculateScores(performance, seo, mobile, axeResults.violations?.length || 0, b2bAnalysis.score);

// AI改善提案
        let gptSuggestions = null;
        try {
          gptSuggestions = await getUXImprovementSuggestions({
            title: `サイト分析 ${i + 1}`,
            analysisData: { 
              performance: performance || {},
              seo: seo || {},
              mobile: mobile || {},
              accessibility: {
                count: axeResults?.violations?.length || 0,
                summary: axeResults?.summary || '分析完了',
                violations: axeResults?.violations || []
              },
              b2b: b2bAnalysis || {},
              scores: scores || {},
              url: url,
              formCount: (html.match(/<form/gi) || []).length,
              buttonCount: (html.match(/<button/gi) || []).length
            },
            url
          });
        } catch (suggestionError) {
          console.log('⚠️ AI提案生成エラー:', suggestionError.message);
          gptSuggestions = null;
        }

        const result = {
          url,
          scores,
          performance,
          seo,
          mobile,
          accessibility: axeResults,
          b2b: b2bAnalysis,
          suggestions: gptSuggestions
        };

        session.results.push(result);
        console.log(`✅ 分析完了: ${url}`);

      } catch (error) {
        console.error(`❌ 分析エラー ${url}:`, error.message);
        console.error(`スタックトレース:`, error.stack);
        
        session.results.push({
          url,
          error: error.message,
          errorType: error.name
        });
      } finally {
        await page.close();
      }
    }

    session.status = 'completed';
    session.progress = urls.length;

    // 分析結果ごとにHTMLレポートを生成
    for (const result of session.results) {
      if (!result.error) {  // エラーがない結果のみレポート生成
        try {
          const timestamp = new Date().getTime();
          const outputFile = path.join(reportsDir, `report-${timestamp}.html`);
          
          await generateHTMLReport({
            title: `Webサイト分析レポート: ${result.url}`,
            url: result.url,
            scoreData: result.scores,
            analysisData: result,
            outputFile
          });
          
          console.log(`📝 レポート生成完了: ${outputFile}`);
        } catch (reportError) {
          console.error(`⚠️ レポート生成エラー:`, reportError);
        }
      }
    }

    console.log(`🎉 全ての分析が完了しました (${urls.length}件)`);

  } catch (error) {
    console.error('❌ 分析プロセスエラー:', error.message);
    console.error('スタックトレース:', error.stack);
    session.status = 'error';
    session.error = error.message;
  } finally {
    // ブラウザのクリーンアップ
    if (browser && browser !== browserPool) {
      await releaseBrowser(browser, true);
    }
  }
}

// 分析関数群（既存のanalyze-all.jsから移植・簡略化）
async function analyzePerformance(page) {
  const startTime = Date.now();

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    return {
      domContentLoaded: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
      loadComplete: navigation ? Math.round(navigation.loadEventEnd) : null
    };
  });

  return {
    loadTime: Date.now() - startTime,
    ...metrics
  };
}

function analyzeSEO(html) {
  const totalImages = (html.match(/<img[^>]*>/gi) || []).length;
  const imagesWithAlt = (html.match(/<img[^>]*alt=["'][^"']*["'][^>]*>/gi) || []).length;

  return {
    title: /<title>(.*?)<\/title>/i.exec(html)?.[1] || null,
    metaDescription: /<meta\s+name="description"\s+content="(.*?)"/i.exec(html)?.[1] || null,
    headings: {
      h1: (html.match(/<h1[^>]*>.*?<\/h1>/gi) || []).length,
      h2: (html.match(/<h2[^>]*>.*?<\/h2>/gi) || []).length,
      h3: (html.match(/<h3[^>]*>.*?<\/h3>/gi) || []).length
    },
    images: {
      total: totalImages,
      withAlt: imagesWithAlt,
      withoutAlt: Math.max(0, totalImages - imagesWithAlt)
    }
  };
}

async function analyzeMobile(page) {
  try {
    const mobileSignals = await page.evaluate(() => {
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      const hasViewport = !!viewportMeta;
      const viewportContent = viewportMeta ? viewportMeta.getAttribute('content') : null;
      const mediaQueryMatches = [];

      const inspectRules = rules => {
        for (const rule of Array.from(rules || [])) {
          if (rule instanceof CSSMediaRule) {
            mediaQueryMatches.push(rule.conditionText);
          }
          if (rule.cssRules) {
            inspectRules(rule.cssRules);
          }
        }
      };

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          inspectRules(sheet.cssRules);
        } catch {
          // Cross-origin stylesheet rules can be inaccessible in the browser context.
        }
      }

      const responsiveIndicators = new Set();
      mediaQueryMatches.forEach(query => responsiveIndicators.add(query));

      document.querySelectorAll('[class]').forEach(element => {
        const className = element.className;
        if (typeof className === 'string' && /(sm:|md:|lg:|xl:|grid-cols-|col-span-|hidden\s|flex\s)/.test(className)) {
          responsiveIndicators.add(`class:${className}`);
        }
      });

      return {
        viewport: viewportContent,
        hasViewport,
        mediaQueryCount: mediaQueryMatches.length,
        hasMediaQueries: mediaQueryMatches.length > 0 || responsiveIndicators.size > 0
      };
    });

    let touchTargets;
    try {
      touchTargets = await page.evaluate(() => {
        const interactiveElements = document.querySelectorAll(
          'button, a[href], input, select, textarea, [role="button"], [tabindex="0"]'
        );

        let totalTargets = 0;
        let adequateTargets = 0;
        let smallTargets = 0;

        interactiveElements.forEach(element => {
          try {
            const rect = element.getBoundingClientRect();
            const minSize = 44; // 推奨最小タッチターゲットサイズ (44x44px)

            if (rect.width > 0 && rect.height > 0) {
              totalTargets++;
              if (rect.width >= minSize && rect.height >= minSize) {
                adequateTargets++;
              } else {
                smallTargets++;
              }
            }
          } catch (e) {
            // 個別要素のエラーは無視
            console.warn('Element evaluation error:', e.message);
          }
        });

        return {
          totalTargets,
          adequateTargets,
          smallTargets
        };
      });
    } catch (error) {
      console.warn('TouchTargets evaluation failed:', error.message);
      touchTargets = {
        totalTargets: 0,
        adequateTargets: 0,
        smallTargets: 0
      };
    }

    const result = {
      viewport: mobileSignals.viewport,
      responsive: {
        hasViewport: mobileSignals.hasViewport,
        hasMediaQueries: mobileSignals.hasMediaQueries,
        mediaQueryCount: mobileSignals.mediaQueryCount
      },
      touchTargets
    };

    console.log('Mobile analysis result:', JSON.stringify(result, null, 2));
    return result;

  } catch (error) {
    console.error('Mobile analysis error:', error.message);
    return {
      viewport: null,
      responsive: {
        hasViewport: false,
        hasMediaQueries: false,
        mediaQueryCount: 0
      },
      touchTargets: {
        totalTargets: 0,
        adequateTargets: 0,
        smallTargets: 0
      }
    };
  }
}

async function analyzeB2BWithAI(page) {
  try {
    const signals = await page.evaluate(() => {
      const bodyText = document.body?.innerText || '';
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(anchor => ({
          text: (anchor.textContent || '').trim(),
          href: anchor.getAttribute('href') || ''
        }));
      const forms = Array.from(document.querySelectorAll('form'));
      const ctaTexts = ['お問い合わせ', '問い合わせ', '資料請求', '無料相談', '無料デモ', 'お申し込み', '導入事例', '詳しく見る', 'お問い合わせはこちら'];
      const hasMatchingLink = patterns => links.some(link => patterns.some(pattern => link.text.includes(pattern) || link.href.includes(pattern)));
      const ctaCount = links.filter(link => ctaTexts.some(pattern => link.text.includes(pattern))).length;

      return {
        formCount: forms.length,
        ctaCount,
        hasContactPage: hasMatchingLink(['contact', 'inquiry', 'toiawase', 'お問い合わせ', '問い合わせ']),
        hasCaseStudies: hasMatchingLink(['case', 'works', '導入事例', '事例', '実績']),
        hasPricingPage: hasMatchingLink(['price', 'pricing', '料金', '費用']),
        hasResourceDownloads: hasMatchingLink(['download', 'whitepaper', '資料', 'ebook']),
        hasCompanyInfo: hasMatchingLink(['company', 'about', '会社概要', '企業情報']),
        hasFAQ: hasMatchingLink(['faq', 'よくある質問']),
        hasPrivacyPolicy: hasMatchingLink(['privacy', 'プライバシー']),
        hasNewsSection: hasMatchingLink(['news', 'blog', 'お知らせ', 'ニュース']),
        bodyText
      };
    });

    const heuristicSignals = [
      signals.hasContactPage,
      signals.hasCaseStudies,
      signals.hasPricingPage,
      signals.hasResourceDownloads,
      signals.hasCompanyInfo,
      signals.hasFAQ,
      signals.hasPrivacyPolicy,
      signals.hasNewsSection,
      signals.formCount > 0,
      signals.ctaCount >= 2
    ];

    let score = 1 + heuristicSignals.filter(Boolean).length / 2;
    if (signals.formCount >= 2) score += 0.5;
    if ((signals.bodyText.match(/導入|事例|顧客|企業/g) || []).length >= 3) score += 0.5;

    return {
      ...signals,
      score: Math.max(1, Math.min(5, Math.round(score)))
    };
  } catch (error) {
    return {
      score: 2,
      formCount: 0,
      ctaCount: 0,
      hasContactPage: false,
      hasCaseStudies: false,
      hasPricingPage: false,
      hasResourceDownloads: false,
      hasCompanyInfo: false,
      hasFAQ: false,
      hasPrivacyPolicy: false,
      hasNewsSection: false,
      error: error.message
    };
  }
}

function calculateScores(performance, seo, mobile, a11yViolations, b2bScore) {
  let perfScore = 5;
  if (performance.loadTime > 5000) perfScore = 2;
  else if (performance.loadTime > 3000) perfScore = 3;
  else if (performance.loadTime > 2000) perfScore = 4;

  let seoScore = 5;
  if (!seo.title) seoScore--;
  if (!seo.metaDescription) seoScore--;
  if (seo.headings.h1 === 0) seoScore--;
  if (seo.images.total > 0 && seo.images.withoutAlt > 0) seoScore--;

  let mobileScore = 5;
  if (!mobile.responsive?.hasViewport) mobileScore -= 2;
  if (!mobile.responsive?.hasMediaQueries) mobileScore -= 1;
  if ((mobile.touchTargets?.totalTargets || 0) > 0) {
    const adequateRatio = (mobile.touchTargets.adequateTargets || 0) / mobile.touchTargets.totalTargets;
    if (adequateRatio < 0.6) mobileScore -= 1;
  }

  let a11yScore = Math.max(1, 5 - Math.floor(a11yViolations / 2));

  return {
    performance: Math.max(1, perfScore),
    seo: Math.max(1, seoScore),
    mobile: Math.max(1, mobileScore),
    accessibility: a11yScore,
    b2bLead: b2bScore || 3,
    overall: Math.max(1, perfScore) + Math.max(1, seoScore) + Math.max(1, mobileScore) + a11yScore + (b2bScore || 3)
  };
}
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Web分析サーバーが起動しました: http://${HOST}:${PORT}`);
  console.log(`🔑 OpenAI API: ${openai ? '設定済み' : '未設定（基本分析のみ）'}`);
  console.log(`❤️ Health check: http://${HOST}:${PORT}/api/status/health`);
});

function shutdown(signal) {
  console.log(`🛑 ${signal} を受信したため、サーバーを終了します`);
  server.close(() => {
    console.log('✅ HTTPサーバーを停止しました');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('⚠️ サーバー停止がタイムアウトしたため、強制終了します');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
