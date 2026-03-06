/**
 * webhook-receiver.js
 * Receives GitHub Projects V2 webhook events.
 * Fires when a project item moves to 'In Progress' — kicks off the pipeline.
 *
 * Setup:
 *   1. Go to org Settings → Webhooks
 *   2. URL: http://your-server:4000/webhook/github
 *   3. Events: Projects v2 item events
 *   4. Secret: matches WEBHOOK_SECRET in .env
 */

import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'changeme';

/**
 * Verify GitHub webhook signature
 */
export function verifyWebhookSignature(payload, signature) {
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

/**
 * Parse a projects_v2_item webhook event
 * Returns null if not an 'In Progress' transition
 */
export function parseProjectsWebhook(body) {
  const { action, projects_v2_item, changes } = body;

  // Only care about status field changes to 'In Progress'
  if (action !== 'edited') return null;
  const fieldChange = changes?.field_value;
  if (!fieldChange) return null;

  const newStatus = fieldChange.to?.name;
  if (newStatus !== 'In Progress') return null;

  return {
    itemId:    projects_v2_item.node_id,
    contentId: projects_v2_item.content_node_id,
    contentType: projects_v2_item.content_type, // 'Issue' or 'DraftIssue'
    projectId: projects_v2_item.project_node_id,
    changedAt: projects_v2_item.updated_at
  };
}
