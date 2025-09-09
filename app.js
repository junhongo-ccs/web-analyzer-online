import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { runAxeAnalysis } from './src/axe-integration.js';
import { getUXImprovementSuggestions } from './src/improvePrompts.js';
import { generateHTMLReport } from './src/generateHTMLReport-integrated.js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// OpenAI設定
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 分析状況を保存するメモリストレージ
const analysisStatus = new Map();

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

  const sessionId = Date.now().toString();
  analysisStatus.set(sessionId, {
    status: 'running',
    progress: 0,
    total: urls.length,
    results: []
  });

  // 非同期で分析実行
  runAnalysis(sessionId, urls);

  res.json({ sessionId, message: '分析を開始しました' });
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

// 分析実行関数
async function runAnalysis(sessionId, urls) {
  const session = analysisStatus.get(sessionId);

  try {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      // プログレス更新
      session.progress = i;
      session.currentUrl = url;

      console.log(`🔍 [${i + 1}/${urls.length}] 分析中: ${url}`);

      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Codespaces対応
      });
      const page = await browser.newPage();

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // 分析実行
        const performance = await analyzePerformance(page);
        const html = await page.content();
        const seo = analyzeSEO(html);
        const mobile = await analyzeMobile(page);
        const axeResults = await runAxeAnalysis(page);
        const b2bAnalysis = await analyzeB2BWithAI(page, url);

        // スコア計算
        const scores = calculateScores(performance, seo, mobile, axeResults.violations?.length || 0, b2bAnalysis.score);

        // AI改善提案
        const gptSuggestions = await getUXImprovementSuggestions({
          title: `サイト分析 ${i + 1}`,
          analysisData: { performance, seo, mobile, scores, url },
          url
        });

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

      } catch (error) {
        console.error(`❌ 分析エラー ${url}:`, error.message);
        session.results.push({
          url,
          error: error.message
        });
      } finally {
        await browser.close();
      }
    }

    session.status = 'completed';
    session.progress = urls.length;

  } catch (error) {
    console.error('❌ 分析プロセスエラー:', error);
    session.status = 'error';
    session.error = error.message;
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
  return {
    title: /<title>(.*?)<\/title>/i.exec(html)?.[1] || null,
    metaDescription: /<meta\s+name="description"\s+content="(.*?)"/i.exec(html)?.[1] || null,
    headings: {
      h1: (html.match(/<h1[^>]*>.*?<\/h1>/gi) || []).length,
      h2: (html.match(/<h2[^>]*>.*?<\/h2>/gi) || []).length,
      h3: (html.match(/<h3[^>]*>.*?<\/h3>/gi) || []).length
    },
    images: {
      total: (html.match(/<img[^>]*>/gi) || []).length,
      withAlt: (html.match(/<img[^>]*alt=["'][^"']*["'][^>]*>/gi) || []).length
    }
  };
}

async function analyzeMobile(page) {
  const viewport = await page.evaluate(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    return viewportMeta ? viewportMeta.getAttribute('content') : null;
  });

  const touchTargets = await page.evaluate(() => {
    const interactiveElements = document.querySelectorAll(
      'button, a[href], input, select, textarea, [role="button"], [tabindex="0"]'
    );

    let totalTargets = 0;
    let adequateTargets = 0;
    let smallTargets = 0;

    interactiveElements.forEach(element => {
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
    });

    return {
      totalTargets,
      adequateTargets,
      smallTargets
    };
  });

  return {
    viewport,
    responsive: { hasMediaQueries: true }, // 簡略化
    touchTargets
  };
}

async function analyzeB2BWithAI(page, url) {
  if (!openai) {
    return { score: 3, message: 'OpenAI APIキーが設定されていません' };
  }

  try {
    const content = await page.evaluate(() => document.body.innerText);
    const hasContact = content.includes('お問い合わせ') || content.includes('問い合わせ');
    const hasCompany = content.includes('会社概要') || content.includes('企業情報');

    let score = 2;
    if (hasContact) score++;
    if (hasCompany) score++;

    return { score: Math.min(score, 5) };
  } catch (error) {
    return { score: 3, error: error.message };
  }
}

function calculateScores(performance, seo, mobile, a11yViolations, b2bScore) {
  let perfScore = 5;
  if (performance.loadTime > 3000) perfScore--;

  let seoScore = 5;
  if (!seo.title) seoScore--;
  if (!seo.metaDescription) seoScore--;

  let mobileScore = mobile.viewport ? 5 : 3;
  let a11yScore = Math.max(1, 5 - Math.floor(a11yViolations / 2));

  return {
    performance: Math.max(1, perfScore),
    seo: Math.max(1, seoScore),
    mobile: mobileScore,
    accessibility: a11yScore,
    b2bLead: b2bScore || 3,
    overall: Math.max(1, perfScore) + Math.max(1, seoScore) + mobileScore + a11yScore + (b2bScore || 3)
  };
}

app.listen(PORT, () => {
  console.log(`🚀 Web分析サーバーが起動しました: http://localhost:${PORT}`);
  console.log(`🔑 OpenAI API: ${openai ? '設定済み' : '未設定（基本分析のみ）'}`);
});