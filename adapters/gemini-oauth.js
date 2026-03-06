/**
 * gemini-oauth.js
 * Free tier: Uses Google OAuth token from gcloud or env.
 * No API key needed — your Google subscription covers it.
 *
 * Models available free via OAuth:
 *   gemini-2.0-flash, gemini-2.5-pro, gemini-1.5-pro
 */

import { execSync } from 'child_process';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function getOAuthToken() {
  if (process.env.GEMINI_OAUTH_TOKEN) return process.env.GEMINI_OAUTH_TOKEN;
  try {
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('No Gemini OAuth token. Set GEMINI_OAUTH_TOKEN or run: gcloud auth login');
  }
}

export async function geminiChat(messages, model = 'gemini-2.0-flash', system = null) {
  const token = getOAuthToken();
  const projectId = process.env.GEMINI_PROJECT_ID;

  // Route through antigravity-proxy if available (handles auth internally)
  const proxyUrl = process.env.ANTIGRAVITY_URL;
  if (proxyUrl) {
    const res = await fetch(`${proxyUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'proxpipe' },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages
      })
    });
    return res.json();
  }

  // Direct Gemini API fallback
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const body = { contents };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const url = `${GEMINI_API_BASE}/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(projectId ? { 'x-goog-user-project': projectId } : {})
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
