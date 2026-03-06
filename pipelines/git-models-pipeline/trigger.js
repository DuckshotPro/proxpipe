/**
 * trigger.js
 * Receives a dispatch from n8n (or the webhook receiver),
 * fetches the GitHub issue content, sends it to AI, returns generated code.
 *
 * This is the center of the circle workflow.
 */

import { geminiChat } from '../../adapters/gemini-oauth.js';
import { perplexityChat } from '../../adapters/sleepy-perp.js';
import { githubModelChat } from '../../adapters/github-models.js';

/**
 * Model routing — picks the best free model for the task
 * Priority: Gemini (subscription) → Perplexity Claude (subscription) → GitHub Models (free)
 */
async function routeToAI(prompt, taskType = 'code') {
  const system = taskType === 'code'
    ? 'You are an expert software engineer. Write clean, working code. Return only the code with minimal comments.'
    : 'You are a helpful assistant. Be concise and accurate.';

  // Try Gemini first (your paid subscription, unlimited)
  try {
    return await geminiChat(
      [{ role: 'user', content: prompt }],
      'gemini-2.0-flash',
      system
    );
  } catch (e) {
    console.warn('Gemini failed, trying Perplexity Claude...', e.message);
  }

  // Fallback: Perplexity Pro Claude (your paid subscription)
  try {
    const res = await perplexityChat(
      [{ role: 'user', content: prompt }],
      'claude-sonnet-pplx',
      system
    );
    return res?.content?.[0]?.text || res;
  } catch (e) {
    console.warn('Perplexity failed, trying GitHub Models...', e.message);
  }

  // Last resort: GitHub Models free tier
  return githubModelChat(
    [{ role: 'user', content: prompt }],
    'gpt-4o',
    system
  );
}

/**
 * Main pipeline trigger
 * Called by n8n HTTP Request node or webhook receiver
 */
export async function runPipeline({ issueTitle, issueBody, issueNumber, repoOwner, repoName }) {
  const prompt = `
GitHub Issue #${issueNumber}: ${issueTitle}

${issueBody}

Write the implementation for this issue. Include file path as a comment on the first line.
  `.trim();

  console.log(`[pipeline] Processing issue #${issueNumber}: ${issueTitle}`);

  const generatedCode = await routeToAI(prompt, 'code');

  return {
    issueNumber,
    repoOwner,
    repoName,
    generatedCode,
    branchName: `auto/issue-${issueNumber}`,
    commitMessage: `fix: auto-implement #${issueNumber} — ${issueTitle}`
  };
}
