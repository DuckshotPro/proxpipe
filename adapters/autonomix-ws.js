/**
 * autonomix-ws.js
 * Free tier: Your own VPS running AutonomiX — zero API cost.
 * Auth uses Gemini OAuth token (your Google subscription).
 *
 * Agents:
 *   sysadmin    — infrastructure automation
 *   orchestrator — multi-agent coordination
 *   learner     — RAG / ML / knowledge synthesis
 *   jesusgem    — emergency recovery
 */

import WebSocket from 'ws';
import { execSync } from 'child_process';

const AUTONOMIX_ENDPOINT = process.env.AUTONOMIX_ENDPOINT || 'ws://localhost:3000';

function getGeminiToken() {
  if (process.env.GEMINI_OAUTH_TOKEN) return process.env.GEMINI_OAUTH_TOKEN;
  try {
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('No Gemini OAuth token for AutonomiX auth');
  }
}

/**
 * Call an AutonomiX specialist agent
 * @param {'sysadmin'|'orchestrator'|'learner'|'jesusgem'} agentName
 * @param {Array} messages
 * @param {string} system
 * @param {number} timeoutMs
 */
export function autonomixCall(agentName, messages, system = '', timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const token = getGeminiToken();
    const url = `${AUTONOMIX_ENDPOINT}/mcp/bidi-stream?agentid=${agentName}`;

    const ws = new WebSocket(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    let fullResponse = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        reject(new Error(`AutonomiX agent '${agentName}' timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'query',
        agent: agentName,
        messages,
        system,
        timestamp: new Date().toISOString()
      }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'chunk') fullResponse += msg.content;
        else if (msg.type === 'response') fullResponse = msg.content;
        else if (msg.type === 'complete') {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            ws.close();
            resolve(fullResponse);
          }
        } else if (msg.type === 'error') {
          reject(new Error(msg.message));
        }
      } catch (e) { reject(e); }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
