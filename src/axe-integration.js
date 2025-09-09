// axe-integration.js (修正版)
// IDに応じた日本語説明マッピング（拡張版）
const i18nMap = {
  // ARIA関連
  'aria-allowed-attr': 'サポートされていないARIA属性が使用されています',
  'aria-required-children': '必要な子要素が含まれていないARIAロールがあります',
  'aria-valid-attr': 'ARIA属性が無効な値を持っています',
  'aria-valid-attr-value': 'ARIA属性の値が正しくありません',
  'aria-input-field-name': 'ARIA入力フィールドにアクセシブルな名前がありません',
  'aria-hidden-focus': 'フォーカス可能な要素がaria-hidden="true"に含まれています',
  
  // カラー・コントラスト
  'color-contrast': '色のコントラストが不十分です',
  'color-contrast-enhanced': '色のコントラスト比が推奨値を満たしていません',
  
  // フォーム関連
  'label': 'フォーム要素にラベルがありません',
  'form-field-multiple-labels': 'フォームフィールドに複数のラベルがあります',
  'select-name': 'セレクト要素にアクセシブルな名前がありません',
  'button-name': 'ボタンにアクセシブルな名前がありません',
  
  // 画像関連
  'image-alt': '画像にalt属性がありません',
  'input-image-alt': '画像ボタンにalt属性がありません',
  'area-alt': 'イメージマップのarea要素にalt属性がありません',
  
  // リンク関連
  'link-name': 'リンクにアクセシブルな名前がありません',
  'link-in-text-block': 'リンクが周囲のテキストと区別できません',
  
  // 言語・HTML構造
  'html-has-lang': 'htmlタグに言語属性（lang）がありません',
  'html-lang-valid': 'htmlタグの言語属性が無効です',
  'document-title': 'ページにタイトルがありません',
  'duplicate-id': '重複したIDが存在します',
  'duplicate-id-aria': 'ARIA属性で参照されているIDが重複しています',
  
  // ランドマーク・リージョン
  'region': 'ページコンテンツがランドマーク要素に含まれていません',
  'landmark-unique': '同じランドマークロールが一意でありません',
  'bypass': 'ページにスキップリンクがありません',
  
  // その他
  'meta-viewport': 'ビューポートメタタグがズームを無効にしています',
  'tabindex': 'tabindex属性の値が正しくありません',
  'frame-title': 'フレームまたはiframeにタイトルがありません'
};

async function runAxeAnalysis(page) {
  try {
    console.log('🔍 アクセシビリティ分析を開始...');
    
    // 複数のCDNを試行
    const cdnUrls = [
      'https://unpkg.com/axe-core@4.8.2/axe.min.js',
      'https://cdn.jsdelivr.net/npm/axe-core@4.8.2/axe.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js'
    ];

    let axeLoaded = false;
    
    for (const url of cdnUrls) {
      try {
        console.log(`📥 axe-core読み込み試行: ${url}`);
        await page.addScriptTag({ url, timeout: 10000 });
        
        // axeが正常に読み込まれたか確認
        const isAxeAvailable = await page.evaluate(() => {
          return typeof window.axe !== 'undefined';
        });
        
        if (isAxeAvailable) {
          console.log('✅ axe-core読み込み成功');
          axeLoaded = true;
          break;
        }
      } catch (error) {
        console.log(`⚠️ CDN失敗: ${url}`);
        continue;
      }
    }

    if (!axeLoaded) {
      console.log('⚠️ axe-core読み込み失敗 - 基本的なチェックを実行');
      return await runBasicAccessibilityCheck(page);
    }

    // 少し待機してからaxe実行
    await page.waitForTimeout(2000);

    const results = await page.evaluate(async () => {
      try {
        if (typeof window.axe === 'undefined') {
          throw new Error('axe-core not available');
        }
        
        return await window.axe.run({
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
          },
          timeout: 30000
        });
      } catch (error) {
        throw new Error(`axe execution failed: ${error.message}`);
      }
    });

    const violations = results.violations.map(v => {
      const description = i18nMap[v.id] || v.help;
      return {
        id: v.id,
        help: description,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length
      };
    });

    console.log(`✅ アクセシビリティ分析完了: ${violations.length}件の問題を検出`);
    return { violations };
    
  } catch (error) {
    console.error('❌ axe-core 分析中にエラー:', error.message);
    return await runBasicAccessibilityCheck(page);
  }
}

// 基本的なアクセシビリティチェック（axe-coreの代替）
async function runBasicAccessibilityCheck(page) {
  try {
    console.log('🔧 基本的なアクセシビリティチェックを実行');
    
    const basicChecks = await page.evaluate(() => {
      const violations = [];
      
      // HTMLのlang属性チェック
      const html = document.documentElement;
      if (!html.hasAttribute('lang') || !html.getAttribute('lang').trim()) {
        violations.push({
          id: 'html-has-lang',
          help: 'htmlタグに言語属性（lang）がありません',
          impact: 'serious',
          description: 'HTML要素にlang属性が設定されていません',
          nodes: 1
        });
      }
      
      // 画像のalt属性チェック
      const imagesWithoutAlt = document.querySelectorAll('img:not([alt])');
      if (imagesWithoutAlt.length > 0) {
        violations.push({
          id: 'image-alt',
          help: '画像にalt属性がありません',
          impact: 'critical',
          description: 'img要素にalt属性が設定されていません',
          nodes: imagesWithoutAlt.length
        });
      }
      
      // フォームラベルチェック
      const inputsWithoutLabels = document.querySelectorAll('input:not([type="hidden"]):not([aria-label]):not([aria-labelledby])');
      let unlabeledInputs = 0;
      inputsWithoutLabels.forEach(input => {
        const labels = document.querySelectorAll(`label[for="${input.id}"]`);
        if (labels.length === 0 && !input.closest('label')) {
          unlabeledInputs++;
        }
      });
      
      if (unlabeledInputs > 0) {
        violations.push({
          id: 'label',
          help: 'フォーム要素にラベルがありません',
          impact: 'critical',
          description: 'フォーム要素に適切なラベルが設定されていません',
          nodes: unlabeledInputs
        });
      }
      
      // ボタンの名前チェック
      const buttonsWithoutNames = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])');
      let unnamedButtons = 0;
      buttonsWithoutNames.forEach(button => {
        if (!button.textContent.trim()) {
          unnamedButtons++;
        }
      });
      
      if (unnamedButtons > 0) {
        violations.push({
          id: 'button-name',
          help: 'ボタンにアクセシブルな名前がありません',
          impact: 'serious',
          description: 'ボタン要素に適切な名前が設定されていません',
          nodes: unnamedButtons
        });
      }
      
      // リンクの名前チェック
      const linksWithoutNames = document.querySelectorAll('a[href]:not([aria-label]):not([aria-labelledby])');
      let unnamedLinks = 0;
      linksWithoutNames.forEach(link => {
        if (!link.textContent.trim()) {
          unnamedLinks++;
        }
      });
      
      if (unnamedLinks > 0) {
        violations.push({
          id: 'link-name',
          help: 'リンクにアクセシブルな名前がありません',
          impact: 'serious',
          description: 'リンク要素に適切な名前が設定されていません',
          nodes: unnamedLinks
        });
      }
      
      return violations;
    });
    
    console.log(`✅ 基本アクセシビリティチェック完了: ${basicChecks.length}件の問題を検出`);
    return { violations: basicChecks };
    
  } catch (error) {
    console.error('❌ 基本アクセシビリティチェック中にエラー:', error);
    return { violations: [] };
  }
}

export { runAxeAnalysis };