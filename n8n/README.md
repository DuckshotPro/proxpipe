# n8n Workflows

This folder contains exportable n8n workflow JSON files for the proxpipe circle pipeline.

## Phase 1 — Simple Test Loop (`circle-workflow-phase1.json`)

The simplest possible circle. Use this to prove the loop closes before adding complexity.

**Flow:**
1. **Webhook Trigger** — GitHub sends `projects_v2_item` event when item → `In Progress`
2. **Get Issue** — HTTP Request to GitHub API to fetch issue title + body
3. **Call AI** — HTTP Request to `antigravity-proxy` at `localhost:8080/v1/messages`
4. **Create Branch + PR** — HTTP Request to `pipelines/git-models-pipeline` webhook endpoint
5. **Wait for PR Merge** — Webhook or polling (Phase 1: manual merge is fine)
6. **Mark Done** — HTTP Request to `pipelines/github-projects/status-sync`

**How to import:**
1. Open n8n at `http://localhost:5678`
2. Menu → Import from File
3. Select `circle-workflow-phase1.json`
4. Update credential nodes with your tokens

## Phase 2 — Full Pipeline (`circle-workflow-phase2.json`)

Adds:
- Perplexity Claude fallback if Gemini fails
- `gh copilot suggest` review step via Execute Command node
- AutonomiX sysadmin agent for infra-related issues
- Auto-merge on passing checks

## Getting Your Project Field IDs

Run this once to find the IDs you need for `.env`:

```bash
# Get your project ID
gh api graphql -f query='{
  viewer {
    projectsV2(first: 10) {
      nodes { id title }
    }
  }
}'

# Then get field IDs (replace PROJECT_ID)
node -e "
import('./github-projects/status-sync.js')
  .then(m => m.getProjectFields())
"
```
