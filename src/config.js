// 共通設定ファイル
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

// APIキーの確実な取得と検証
function getCleanAPIKey() {
  let apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  apiKey = apiKey.trim().replace(/[\r\n\t]/g, '');

  if (!apiKey.startsWith('sk-')) {
    console.error('❌ Invalid API key format');
    return null;
  }

  return apiKey;
}

// OpenAI設定のシングルトン
let openaiInstance = null;
const apiKey = getCleanAPIKey();

if (apiKey) {
  try {
    openaiInstance = new OpenAI({ apiKey });
    console.log('✅ OpenAI API initialized');
  } catch (error) {
    console.error('❌ OpenAI initialization failed:', error.message);
  }
}

export { openaiInstance as openai };