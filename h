[1mdiff --git a/app.js b/app.js[m
[1mindex 31dd422..53562bc 100644[m
[1m--- a/app.js[m
[1m+++ b/app.js[m
[36m@@ -173,6 +173,10 @@[m [masync function releaseBrowser(browser, shouldClose = false) {[m
   }[m
 }[m
 [m
[32m+[m[32m// HTML要素のカウント[m
[32m+[m[32m        const formCount = (html.match(/<form/gi) || []).length;[m
[32m+[m[32m        const buttonCount = (html.match(/<button/gi) || []).length;[m
[32m+[m
 // 分析実行関数[m
 async function runAnalysis(sessionId, urls) {[m
   const session = analysisStatus.get(sessionId);[m
[36m@@ -217,11 +221,31 @@[m [masync function runAnalysis(sessionId, urls) {[m
         const scores = calculateScores(performance, seo, mobile, axeResults.violations?.length || 0, b2bAnalysis.score);[m
 [m
         // AI改善提案[m
[31m-        const gptSuggestions = await getUXImprovementSuggestions({[m
[31m-          title: `サイト分析 ${i + 1}`,[m
[31m-          analysisData: { performance, seo, mobile, scores, url },[m
[31m-          url[m
[31m-        });[m
[32m+[m[32m     let gptSuggestions = null;[m
[32m+[m[32m        try {[m
[32m+[m[32m          gptSuggestions = await getUXImprovementSuggestions({[m
[32m+[m[32m            title: `サイト分析 ${i + 1}`,[m
[32m+[m[32m            analysisData: {[m[41m [m
[32m+[m[32m              performance: performance || {},[m
[32m+[m[32m              seo: seo || {},[m
[32m+[m[32m              mobile: mobile || {},[m
[32m+[m[32m              accessibility: {[m
[32m+[m[32m                count: axeResults?.violations?.length || 0,[m
[32m+[m[32m                summary: axeResults?.summary || '分析完了',[m
[32m+[m[32m                violations: axeResults?.violations || [][m
[32m+[m[32m              },[m
[32m+[m[32m              b2b: b2bAnalysis || {},[m
[32m+[m[32m              scores: scores || {},[m
[32m+[m[32m              url: url,[m
[32m+[m[32m              formCount: formCount,[m
[32m+[m[32m              buttonCount: buttonCount[m
[32m+[m[32m            },[m
[32m+[m[32m            url[m
[32m+[m[32m          });[m
[32m+[m[32m        } catch (suggestionError) {[m
[32m+[m[32m          console.log('⚠️ AI提案生成エラー:', suggestionError.message);[m
[32m+[m[32m          gptSuggestions = null;[m
[32m+[m[32m        }[m
 [m
         const result = {[m
           url,[m
