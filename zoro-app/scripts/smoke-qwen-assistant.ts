/**
 * Smoke: Cloud AI prefers Qwen when QWEN_BASE_URL is set.
 * Run: npx --yes tsx scripts/smoke-qwen-assistant.ts
 */
import { cloudAssistantCompletion, isQwenAssistantConfigured } from '../src/lib/mobile-assistant-llm';

async function main() {
  if (!isQwenAssistantConfigured()) {
    console.error('FAIL: QWEN_BASE_URL not set');
    process.exit(1);
  }
  const { text, backend } = await cloudAssistantCompletion({
    system: 'You are terse.',
    user: 'Reply with exactly: ok',
    maxOutputTokens: 32,
  });
  console.log(JSON.stringify({ backend, text: text.trim().slice(0, 200) }));
  if (backend !== 'qwen') {
    console.error('FAIL: expected qwen backend');
    process.exit(1);
  }
  if (!text.toLowerCase().includes('ok')) {
    console.error('FAIL: unexpected reply');
    process.exit(1);
  }
  console.log('PASS');
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
