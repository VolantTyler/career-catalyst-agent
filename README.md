# Career Catalyst Agent

**Career Catalyst** is a research and automation workspace for tracking **high-signal opportunities** in the **AI agent** ecosystem (employers, consultancies, startups, and stack adoption). It combines a **multi-agent mental model** (Hermes as cognitive core, OpenClaw as gateway, **Cursor SDK** for long-running cloud execution) with **durable memory**: SQLite (including **FTS5**) for distilled entities—not raw chat logs.

Repository anchors:

- **`USER.md`** — identity, stack, and voice for agents and outbound materials  
- **`SOUL.md`** — mission and operating constraints  
- **`context/`** — résumé / CV / cover letter PDFs (and optional `.md` / `.txt` mirrors)  
- **`src/memory/`** — TypeScript **distiller** + FTS-backed store for structured findings  
- **`legacy/`** — Cursor **Agents SDK** harness (prompt, send, whoami, SQLite run log)

Architecture rules for anyone (human or agent) editing this repo live in **`.cursor/rules/architecture.mdc`** (Hermes supervises; SDK is execution-only).

---

## Prerequisites

- **Node.js** 20+ recommended (uses `node:sqlite`, `tsx`, and the Cursor SDK)  
- A **Cursor Cloud Agents API key** if you use the SDK scripts (`CURSOR_API_KEY`)

---

## Setup

```bash
cd career-catalyst-agent
npm install
cp .env.example .env
# Edit .env: set CURSOR_API_KEY at minimum for SDK commands.
```

Optional environment variables are documented in **`.env.example`** (runtime `local` vs `cloud`, data directory, cloud repo URL, resume-agent id, etc.).

---

## How to run commands (“talk to” the project)

Everything below assumes the **project root** as the current working directory.

### 1. npm scripts (primary)

| Command | Purpose |
|--------|---------|
| `npm run trajectory:consultancies` | Example **research trajectory**: query distilled SQLite memory first, then ingest structured consultancy / AI-agent scores (see `scripts/run-consultancy-trajectory.ts`). |
| `npm run pdf:text -- "context/Applied AI Resume.pdf"` | **Extract plain text** from a PDF to stdout (used by agents and humans; avoids reading raw PDF bytes). |
| `npm run catalyst:whoami` | Verify **Cursor API key**, list available models, print Catalyst config summary (`legacy/scripts/whoami.ts`). |
| `npm run catalyst:prompt -- "Your prompt here"` | **One-shot** `Agent.prompt` with config + SQLite run logging (`legacy/scripts/prompt-once.ts`). |
| `npm run catalyst:send -- "Your prompt here"` | **Streaming** agent run with session persistence; set `CAREER_CATALYST_RESUME_AGENT=<id>` to resume (`legacy/scripts/send.ts`). |

**Note:** Pass prompts **after** `--` so npm forwards them to the script.

Examples:

```bash
npm run catalyst:whoami
npm run catalyst:prompt -- "Summarize the distilled memory schema in src/memory."
npm run catalyst:send -- "List three next research trajectories for OpenClaw adoption signals."
```

### 2. Cursor / Copilot-style chat (IDE)

Open this repo in **Cursor** and work in Agent mode. The agent loads **`.cursor/rules/`** and can use **project skills** under **`.cursor/skills/`** (for example **`pdf_text_extraction`** for résumé PDFs, **`market_signal_detection`** for research discipline). Natural-language requests like “run the consultancy trajectory” or “extract text from `context/Tyler Stahl - CV - 2026.pdf`” map to the commands above.

### 3. Hermes + OpenClaw (outside this repo)

**Hermes** (with **ACP**) and **OpenClaw** are configured on the host (for example `~/.hermes/skills/career-catalyst.md`, `config/acp-gateway.example.yaml`). They orchestrate triggers and planning; this repository holds **memory code**, **skills**, and **SDK entrypoints** they can invoke.

---

## Data layout

| Path / env | Role |
|------------|------|
| `data/catalyst-memory.sqlite` (default) | **Distilled findings** FTS store (`CAREER_CATALYST_MEMORY_DB` / `CAREER_CATALYST_DATA_DIR` override paths). |
| `data/catalyst-sdk.sqlite` (default) | **SDK** session + run metadata from legacy scripts (`CAREER_CATALYST_DB_NAME` in `.env.example`). |

Both are gitignored under `data/` as appropriate; regenerate by running scripts.

---

## Contributing / skills

- Add or refine **Cursor skills** under `.cursor/skills/<name>/SKILL.md`.  
- Keep **USER.md** aligned with factual profile changes when `context/` documents change.

---

## License

ISC (see `package.json`).
