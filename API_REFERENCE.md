# Claw-Empire Content Studio — API Reference

> **28+ modules** | **5 AI Providers** | **8 Agent Personas** | **8 Content Templates**

---

## 🌐 AI Providers

### Gemini
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gemini/status` | Check Gemini API status |
| POST | `/api/gemini/generate` | Generate content with Gemini |
| GET | `/api/gemini/models` | List available models |

### OpenAI
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/openai/status` | Check OpenAI status |
| POST | `/api/openai/generate` | Generate with GPT-4o/4o-mini |
| GET | `/api/openai/models` | List models |

### Anthropic
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/anthropic/status` | Check Anthropic status |
| POST | `/api/anthropic/generate` | Generate with Claude Sonnet/Haiku |
| GET | `/api/anthropic/models` | List models |

### Groq
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groq/status` | Check Groq status |
| POST | `/api/groq/generate` | Generate with LLaMA (ultra-fast) |
| GET | `/api/groq/models` | List models |

### KIMI (Moonshot)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kimi/status` | Check KIMI status |
| POST | `/api/kimi/generate` | Generate with Moonshot v1 |
| GET | `/api/kimi/models` | List models |

---

## 🧭 Smart Routing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent-router/generate` | Smart-routed generation |
| GET | `/api/agent-router/routes` | View routing table |

**Body (POST generate):**
```json
{
  "agentRole": "content_writer",
  "taskType": "tiktok-script",
  "prompt": "เขียน TikTok script รีวิวหูฟัง",
  "maxTokens": 512
}
```

---

## 🏥 Health & Rate Limits

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/providers/health` | All provider health check |
| GET | `/api/rate-limits/status` | RPM/RPD per provider |
| GET | `/api/rate-limits/config` | Rate limit configuration |

---

## 🤖 CEO Auto-Pilot

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/autopilot/start` | Run full pipeline (trend→content→review→publish) |
| GET | `/api/autopilot/runs` | List all auto-pilot runs |
| GET | `/api/autopilot/runs/:id` | Get specific run details |

**Body (POST start):**
```json
{ "product": "หูฟัง Bluetooth", "platform": "tiktok" }
```

---

## 🎯 A/B Content Testing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ab-test/run` | Run A/B test (2 providers) |
| GET | `/api/ab-test/history` | Test history |
| GET | `/api/ab-test/stats` | Provider win stats |

---

## 💰 Cost Optimizer

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/costs/summary` | Cost breakdown + recommendations |
| GET | `/api/costs/pricing` | Model pricing table |
| GET | `/api/costs/log` | Usage log |
| GET | `/api/costs/optimize?task=TYPE` | Get cost-optimized route |
| POST | `/api/costs/track` | Track API usage |

---

## 🎭 Agent Personas

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/personas` | List all personas |
| GET | `/api/personas/:role` | Get persona by role |
| POST | `/api/personas` | Create/update custom persona |
| POST | `/api/personas/:role/generate` | Generate with persona voice |

**Built-in Personas:**
| Persona | Role | Style |
|---------|------|-------|
| 🧠 น้องแพลน | content_strategist | Data-driven analysis |
| 🔍 น้องเทรนด์ | trend_hunter | Trendy, excited |
| 👥 น้องกลุ่มเป้า | audience_planner | Empathetic insights |
| ✍️ น้องคอนเทนต์ | content_writer | Powerful hooks + CTA |
| 🪝 น้องฮุค | hook_specialist | 3-second attention grab |
| 🎨 น้องดีไซน์ | visual_designer | Visual descriptions |
| 📢 น้องโพสต์ | publisher | Systematic publishing |
| 📊 น้องวิเคราะห์ | analytics | Number-driven insights |

---

## 📝 Content Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List all templates |
| GET | `/api/templates?platform=tiktok` | Filter by platform |
| GET | `/api/templates/:id` | Get template by ID |
| POST | `/api/templates/:id/fill` | Fill template variables |
| POST | `/api/templates/:id/generate` | AI-generate from template |
| POST | `/api/templates` | Create custom template |

**Available Templates:** `tiktok-review-30s`, `tiktok-compare`, `tiktok-unboxing`, `fb-affiliate`, `fb-storytelling`, `ig-carousel`, `ig-reel`, `top-list`

---

## 📊 Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/dashboard` | Full analytics dashboard |
| GET | `/api/realtime/pulse` | Live system pulse |
| GET | `/api/realtime/history` | Pulse history |
| GET | `/api/realtime/snapshot` | Full dashboard snapshot |
| GET | `/api/realtime/series/:metric` | Time series (tasks, agents, costs) |

---

## 🧪 Testing & Learning

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agents/auto-test` | Run automated agent tests |
| GET | `/api/agents/auto-test/runs` | Test run history |
| POST | `/api/agents/:id/learning/feedback` | Record agent feedback |
| POST | `/api/agents/:id/learning/improve` | Generate improved prompts |
| GET | `/api/agents/:id/learning/profile` | Agent learning profile |

---

## 🔗 Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/shopee` | Shopee order → auto review |
| POST | `/api/webhooks/lazada` | Lazada order → auto review |
| POST | `/api/webhooks/tiktok` | TikTok event → auto script |
| GET | `/api/webhooks/stats` | Webhook event stats |

---

## 📱 Telegram Bot

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/telegram/webhook` | TG webhook receiver |
| POST | `/api/telegram/command` | Manual command trigger |
| GET | `/api/telegram/commands` | List all commands |
| POST | `/api/telegram/set-webhook` | Auto-setup TG webhook |

**Commands:** `/create`, `/review`, `/status`, `/rank`, `/health`, `/autopilot`, `/costs`, `/test`

---

## 🏗️ Core System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create agent |
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create task |
| GET | `/api/agents/performance` | Agent performance rankings |
| GET | `/api/content-calendar` | Get content calendar |

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `OPENAI_API_KEY` | ✅ | OpenAI API key |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key |
| `GROQ_API_KEY` | ✅ | Groq API key |
| `KIMI_API_KEY` | ✅ | Moonshot KIMI API key |
| `TELEGRAM_BOT_TOKEN` | ✅ | Telegram Bot token |
| `TELEGRAM_CHAT_ID` | ✅ | Default Telegram chat ID |
| `SUPABASE_URL` | ⬜ | Supabase project URL |
| `SUPABASE_KEY` | ⬜ | Supabase anon key |
