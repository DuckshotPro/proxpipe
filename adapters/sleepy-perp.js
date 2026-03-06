/**
 * sleepy-perp.js
 * Free tier: Perplexity Pro subscription session token.
 * sleepy-perp runs headless browser auth and exposes GET /token.
 *
 * Models available via Perplexity Pro session:
 *   sonar, sonar-pro, claude-sonnet-pplx, claude-opus-pplx
 */

const SLEEPY_PERP_URL = process.env.SLEEPY_PERP_URL || 'http://localhost:3001';
const ANTIGRAVITY_URL = process.env.ANTIGRAVITY_URL || 'http://localhost:8080';

/**
 * Get a fresh Perplexity session token from sleepy-perp
 */
export async function getPerplexityToken() {
  const res = await fetch(`${SLEEPY_PERP_URL}/token`);
  if (!res.ok) throw new Error(`sleepy-perp token fetch failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

/**
 * Send a chat message via Perplexity Pro through antigravity-proxy.
 * Model options: sonar-pro, claude-sonnet-pplx, claude-opus-pplx, thinking-pplx
 */
export async function perplexityChat(messages, model = 'sonar-pro', system = null) {
  const res = await fetch(`${ANTIGRAVITY_URL}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'proxpipe' },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages
    })
  });
  if (!res.ok) throw new Error(`Perplexity chat failed: ${res.status}`);
  return res.json();
}

/**
 * Direct Perplexity API call using session token (no proxy needed)
 * Use this if antigravity-proxy is not running
 */
export async function perplexityDirect(messages, model = 'sonar-pro', system = null) {
  const token = await getPerplexityToken();

  const body = {
    model,
    messages: system
      ? [{ role: 'system', content: system }, ...messages]
      : messages
  };

  const res = await fetch('https://www.perplexity.ai/api/auth/session', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  return res.json();
}
