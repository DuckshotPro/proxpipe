# proxpipe

> Central interconnection layer for the Duckshot Productions AI pipeline stack.

This repo is the **glue**. It wires together every free-tier service into one place so you always know how the stack fits together and how to use it.

---

## Stack Overview

```
GitHub Projects (org)
    ↓  webhook (projects_v2_item event)
  n8n  (pipeline trigger)
    ↓  HTTP POST
  antigravity-proxy  (localhost:8080)
    ├── Gemini OAuth  (free via Google subscription)
    ├── sleepy-perp   (Perplexity Pro session tokens)
    └── autonomix     (WebSocket agent OS)
    ↓  AI response / generated code
  n8n  (create branch, commit, open PR)
    ↓
  GitHub Copilot CLI  (free tier — review/suggest)
    ↓  PR merged
  GitHub Projects  (item → Done)
    ↑_________________________________|
```

---

## Free Tier Logic (All In One Place)

| Service | What's Free | How It's Used |
|---|---|---|
| **Gemini** | OAuth via Google account — no API key needed | antigravity-proxy routes `gemini-*` models using your subscription token |
| **Perplexity** | Pro subscription session token (headless browser extraction) | sleepy-perp extracts it, proxy uses it for `*-pplx` models |
| **GitHub Copilot** | Free tier — `gh copilot suggest` CLI | n8n Execute Command node runs it to review/refine generated code |
| **GitHub Models** | Free inference API via `github_token` | `adapters/github-models.js` — GPT-4o, Llama, etc. |
| **n8n** | Self-hosted — free forever | Runs the circle workflow, no cloud subscription needed |
| **AutonomiX** | Your own VPS — Gemini OAuth auth | WebSocket agents via `ws://autonomix-host:3000` |

---

## Repo Structure

```
proxpipe/
├── adapters/                  # Thin clients — each talks to one upstream service
│   ├── sleepy-perp.js         # GET /token from sleepy-perp service
│   ├── gemini-oauth.js        # Refresh + use Gemini OAuth token
│   ├── perplexity-session.js  # Perplexity session token usage
│   ├── github-models.js       # GitHub free inference API
│   └── autonomix-ws.js        # AutonomiX WebSocket bridge
├── pipelines/
│   ├── github-projects/       # Webhook handler + status sync
│   │   ├── webhook-receiver.js
│   │   └── status-sync.js
│   └── git-models-pipeline/   # The circle workflow logic
│       ├── trigger.js         # Receives n8n webhook, dispatches to AI
│       └── pr-builder.js      # Creates branch, commits, opens PR
├── n8n/
│   ├── workflows/
│   │   ├── circle-workflow-phase1.json   # Simple test project loop
│   │   └── circle-workflow-phase2.json   # Full pipeline
│   └── README.md
├── docker-compose.yml         # Spin up the whole stack
├── .env.example               # All env vars in one place
└── README.md
```

---

## Phased Rollout

### Phase 1 — Test Loop (Start Here)
- Single GitHub Project with 3 items: `Backlog`, `In Progress`, `Done`
- n8n watches for `In Progress` → sends to proxy → Gemini writes a stub → opens PR
- Merge PR → n8n moves item to `Done`
- **Goal:** Prove the circle closes. No AI quality bar yet.

### Phase 2 — Real Pipeline
- Add Perplexity Claude (`claude-sonnet-pplx`) for better code generation
- Add Copilot CLI review step before PR opens
- Add AutonomiX sysadmin agent for infra tasks
- Multi-repo project board across all Duckshot-Productions repos

### Phase 3 — Org Migration
- Move all repos to `Duckshot-Productions` org
- Enable org-level GitHub Projects V2 webhooks
- Share secrets across repos via org secrets

---

## Quick Start

```bash
git clone https://github.com/DuckshotPro/proxpipe
cd proxpipe
cp .env.example .env
# Fill in your tokens
docker-compose up -d
```

---

## Service Endpoints (defaults)

| Service | Default URL |
|---|---|
| antigravity-proxy | http://localhost:8080 |
| sleepy-perp | http://localhost:3001 |
| autonomix | ws://localhost:3000 |
| n8n | http://localhost:5678 |
| proxpipe webhook receiver | http://localhost:4000 |
