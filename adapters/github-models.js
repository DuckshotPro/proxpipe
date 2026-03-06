/**
 * github-models.js
 * Free tier: GitHub Models inference API.
 * Uses your GitHub token — no extra setup, no paid plan needed.
 *
 * Free models available:
 *   gpt-4o, gpt-4o-mini, o1-preview, o1-mini
 *   Meta-Llama-3.1-70B-Instruct, Meta-Llama-3.1-405B-Instruct
 *   Mistral-Large, Mistral-Nemo
 *   Phi-3.5-MoE, Phi-3-medium
 *   claude-3-5-sonnet (via GitHub Models)
 *
 * Rate limits (free): 15 req/min, 150 req/day per model
 */

import { execSync } from 'child_process';

const GITHUB_MODELS_URL = process.env.GITHUB_MODELS_URL || 'https://models.inference.ai.azure.com';

function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync('gh auth token', { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('No GitHub token. Set GITHUB_TOKEN or run: gh auth login');
  }
}

/**
 * Chat with a GitHub-hosted free model
 * @param {Array} messages - [{role, content}]
 * @param {string} model - GitHub model ID
 * @param {string|null} system - system prompt
 */
export async function githubModelChat(messages, model = 'gpt-4o', system = null) {
  const token = getGitHubToken();

  const body = {
    model,
    messages: system
      ? [{ role: 'system', content: system }, ...messages]
      : messages,
    temperature: 0.7,
    max_tokens: 4096
  };

  const res = await fetch(`${GITHUB_MODELS_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub Models API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// Convenience aliases
export const githubGPT4o      = (msgs, sys) => githubModelChat(msgs, 'gpt-4o', sys);
export const githubLlama70B   = (msgs, sys) => githubModelChat(msgs, 'Meta-Llama-3.1-70B-Instruct', sys);
export const githubClaude     = (msgs, sys) => githubModelChat(msgs, 'claude-3-5-sonnet', sys);
export const githubMistral    = (msgs, sys) => githubModelChat(msgs, 'Mistral-Large', sys);
