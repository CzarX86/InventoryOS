/**
 * Smoke Test: AI API Accessibility
 * Verifies if the Gemini API key is accessible from the expected Referer.
 * This script runs in CI after deployment to catch 403 HTTP Referrer Block issues.
 */

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const REFERER = process.argv[2] || 'https://inventoryos-effd5.web.app/';

if (!API_KEY) {
  console.error('❌ Error: NEXT_PUBLIC_GEMINI_API_KEY is not set.');
  process.exit(1);
}

async function runTest() {
  console.log(`🔍 Testing Gemini API accessibility for referer: ${REFERER}...`);
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;
  
  const payload = {
    contents: [{ parts: [{ text: "hi" }] }]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: Node's fetch allows setting Referer, which Google's API checks.
        // This effectively simulates a request coming from the browser at that URL.
        'Referer': REFERER,
        'Origin': REFERER
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.smoketest_custom_status === 403 || data.error?.code === 403 || data.error?.status === 'PERMISSION_DENIED') {
      console.error('❌ CI SMOKE TEST FAILED: 403 Forbidden.');
      console.error('Reason:', data.error?.message || 'Referrer Blocked');
      console.error('\n💡 FIX: Go to Google Cloud Console > Credentials and add this domain to the allowed referrers.');
      process.exit(1);
    }

    if (!response.ok) {
      // We don't necessarily fail CI for other errors (like 400/500 which might be quota or transient)
      // but we warn. We ONLY fail for 403 configuration blocks.
      console.warn(`⚠️ Warning: API returned status ${response.status}. This might not be a config error.`);
      console.warn(JSON.stringify(data, null, 2));
      return;
    }

    console.log('✅ Success! Gemini API is accessible from this referer.');
  } catch (err) {
    console.error('❌ Smoke test network error:', err.message);
    process.exit(1);
  }
}

runTest();
