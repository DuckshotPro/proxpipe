/**
 * inference-router.js
 * Central model selection for the proxpipe pipeline.
 * Used by n8n HTTP Request nodes and pipeline trigger.js.
 *
 * FREE TIER PRIORITY ORDER:
 *   1. Gemini (Google subscription — unlimited, fastest)
 *   2. Perplexity Claude via sleepy-perp (Pro subscription — best code quality)
 *   3. GitHub Models (free GitHub account — rate limited but always available)
 *      ├── gpt-4o              (best reasoning)
 *      ├── claude-3-5-sonnet   (best code via GitHub free)
 *      ├── Meta-Llama-3.1-70B  (fast, good for simple tasks)
 *      └── Mistral-Large       (good for structured output)
 *   4. AutonomiX (your VPS — infra/ops tasks only)
 *
 * GitHub Models free rate limits:
 *   - 15 requests/minute per model
 *   - 150 requests/day per model
 *   - Multiple models = multiply your quota
 */

import { geminiChat } from './gemini-oauth.js';
import { perplexityChat } from './sleepy-perp.js';
import { githubModelChat } from './github-models.js';
import { autonomixCall } from './autonomix-ws.js';

/**
 * Task type → best free model mapping
 * Override by passing model explicitly
 */
const TASK_MODEL_MAP = {
  code:        { proxy: 'gemini-2.0-flash',   github: 'gpt-4o'                        },
  code_review: { proxy: 'claude-sonnet-pplx', github: 'claude-3-5-sonnet'             },
  reasoning:   { proxy: 'gemini-2.5-pro',     github: 'o1-mini'                       },
  infra:       { proxy: 'autonomix:sysadmin', github: 'Meta-Llama-3.1-70B-Instruct'  },
  fast:        { proxy: 'gemini-2.0-flash',   github: 'Meta-Llama-3.1-70B-Instruct'  },
  structured:  { proxy: 'gemini-2.0-flash',   github: 'Mistral-Large'                 },
};

/**
 * Route a prompt to the best available free model.
 *
 * @param {string} prompt
 * @param {'code'|'code_review'|'reasoning'|'infra'|'fast'|'structured'} taskType
 * @param {string|null} system - system prompt override
 * @param {string|null} forceModel - skip routing, use this model directly
 * @returns {Promise<string>} - text response
 */
export async function route(prompt, taskType = 'code', system = null, forceModel = null) {
  const messages = [{ role: 'user', content: prompt }];
  const models = TASK_MODEL_MAP[taskType] || TASK_MODEL_MAP.code;

  const defaultSystem = system || getDefaultSystem(taskType);

  // --- Force a specific model ---
  if (forceModel) {
    return runModel(forceModel, messages, defaultSystem);
  }

  // --- 1. Try antigravity-proxy (handles Gemini + Perplexity internally) ---
  if (process.env.ANTIGRAVITY_URL) {
    try {
      const res = await geminiChat(messages, models.proxy, defaultSystem);
      const text = extractText(res);
      if (text) {
        console.log(`[router] ✓ ${models.proxy} via proxy`);
        return text;
      }
    } catch (e) {
      console.warn(`[router] proxy failed (${models.proxy}): ${e.message}`);
    }
  }

  // --- 2. GitHub Models free tier (no proxy needed) ---
  try {
    const text = await githubModelChat(messages, models.github, defaultSystem);
    if (text) {
      console.log(`[router] ✓ ${models.github} via GitHub Models (free)`);
      return text;
    }
  } catch (e) {
    console.warn(`[router] GitHub Models failed (${models.github}): ${e.message}`);
  }

  // --- 3. GitHub Models fallback chain (rotate models to spread rate limits) ---
  const fallbackModels = [
    'gpt-4o',
    'Meta-Llama-3.1-70B-Instruct',
    'Mistral-Large',
    'claude-3-5-sonnet',
    'Phi-3.5-MoE-instruct'
  ].filter(m => m !== models.github);

  for (const fallback of fallbackModels) {
    try {
      const text = await githubModelChat(messages, fallback, defaultSystem);
      if (text) {
        console.log(`[router] ✓ ${fallback} via GitHub Models fallback`);
        return text;
      }
    } catch (e) {
      console.warn(`[router] fallback ${fallback} failed: ${e.message}`);
    }
  }

  throw new Error('[router] All free tier models exhausted. Check rate limits and tokens.');
}

/**
 * Run a specific model by name
 * Supports: gemini-*, claude-*-pplx, copilot:*, autonomix:*, github:*
 */
async function runModel(model, messages, system) {
  // copilot:* or github:* — GitHub Models free tier
  if (model.startsWith('copilot:') || model.startsWith('github:')) {
    const ghModel = model.replace(/^(copilot:|github:)/, '');
    // Resolve short aliases from the old copilot:* naming
    const aliases = {
      'gpt-4o':        'gpt-4o',
      'o1':            'o1-mini',
      'claude-sonnet': 'claude-3-5-sonnet',
      'llama':         'Meta-Llama-3.1-70B-Instruct',
      'mistral':       'Mistral-Large',
    };
    const resolved = aliases[ghModel] || ghModel;
    return githubModelChat(messages, resolved, system);
  }

  // autonomix:* — WebSocket agent
  if (model.startsWith('autonomix:')) {
    const agent = model.replace('autonomix:', '');
    return autonomixCall(agent, messages, system);
  }

  // Everything else — route through proxy
  return extractText(await geminiChat(messages, model, system));
}

function extractText(res) {
  if (typeof res === 'string') return res;
  // Anthropic format
  if (res?.content?.[0]?.text) return res.content[0].text;
  // OpenAI format
  if (res?.choices?.[0]?.message?.content) return res.choices[0].message.content;
  // Gemini direct format
  if (res?.candidates?.[0]?.content?.parts?.[0]?.text) {
    return res.candidates[0].content.parts[0].text;
  }
  return null;
}

function getDefaultSystem(taskType) {
  const systems = {
    code:        'You are an expert software engineer. Write clean, working code. Put the file path as a comment on line 1 (e.g. // src/utils/helper.js).',
    code_review: 'You are a senior code reviewer. Be concise. List issues by severity: critical, warning, suggestion.',
    reasoning:   'You are a careful analytical thinker. Show your reasoning step by step.',
    infra:       'You are a Linux systems administrator and DevOps expert.',
    fast:        'Be concise and direct. No preamble.',
    structured:  'Return only valid JSON. No markdown, no explanation.',
  };
  return systems[taskType] || systems.fast;
}

/**
 * Quick test — run from CLI:
 * node -e "import('./adapters/inference-router.js').then(m => m.route('Write a hello world in Python', 'code').then(console.log))"
 */
