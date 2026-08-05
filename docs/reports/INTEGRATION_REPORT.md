# Integration Report (Baseline)

**Owner:** Principal Architect (Grok 4.5)  
**Date:** 2026-08-05

## Rule

Every integration is exactly one of: **Connected** · **Disabled** · **Awaiting Credentials**. No ambiguous greens.

## Inventory vs reality

| Integration | In Command Center | In ContentDone | Recommended state now |
|-------------|-------------------|----------------|------------------------|
| Calendly | No | Env-gated webhook/API | Awaiting Credentials (until probed) |
| n8n | No | Configured in deploy docs | Awaiting Credentials / Connected when `/health` says so |
| Airtable | No | Env-gated | Awaiting Credentials |
| LinkedIn | No | Env-gated via n8n | Awaiting Credentials |
| Facebook | No | Env-gated via n8n | Awaiting Credentials |
| CRM webhook | No | Env-gated | Awaiting Credentials |
| Local AI / Ollama | No | Implemented | Awaiting Credentials unless endpoint healthy |
| OpenAI | No | Stub | Awaiting Credentials |
| Anthropic / Claude | No | Stub | Awaiting Credentials |
| Gemini | No | No | Awaiting Credentials |
| OpenRouter | No | No | Awaiting Credentials |
| Google Gmail/Calendar/Drive | No | No | Awaiting Credentials |
| Notion | No | No | Awaiting Credentials |
| ClickUp | No | No | Disabled until workflow demand |
| GitHub | No | No | Awaiting Credentials (read-only first) |
| Supabase | No | No | Disabled until remote store chosen |
| SendGrid | No | No | Awaiting Credentials |
| Apollo | No | No | Disabled until lead enrichment wave |
| ZoomInfo | No | No | Disabled |
| HubSpot | No | No | Disabled (Airtable/CRM webhook first) |
| Slack | No | No | Awaiting Credentials |
| Hermes Memory | No | No | Awaiting Credentials |
| HermesBrain | Brand only | No | Awaiting Credentials |
| Sovereign Mind MCP | No | No | Awaiting Credentials |
| Cursor | No | No | Disabled in-product |
| Custom MCP servers | No | No | Awaiting Credentials / Disabled per server |

## ContentDone honesty pattern (keep)

`getPublicConfig()` already returns booleans for configured connectors and skips posts when URLs are missing. **Promote this pattern** into the Command Center Integration Registry instead of inventing a second model.

## MCP topology (target, not current)

```
Command API
  └─ McpGateway
       ├─ sovereign-mind (internal tools)
       ├─ hermes-memory
       ├─ hermesbrain
       └─ vendor adapters (github, notion, slack, …)
```

Do not build vendor MCP servers before Wave 1–2 shell and Brief exist. Registry UI comes first; servers follow leverage.
