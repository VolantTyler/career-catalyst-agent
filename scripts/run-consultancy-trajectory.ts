/**
 * First Career Catalyst trajectory: large consultancies driving AI agent adoption,
 * scored vs Agentic Architect profile (see USER.md).
 *
 * Memory-first: queries SQLite FTS before ingesting external research JSON.
 */
import {
  commitDistilledBatch,
  openDistilledMemoryStore,
  parseResearchOutput,
  resolveMemoryDatabasePath,
} from "../src/memory/index.js";

const TRAJECTORY_ID = "trajectory-consultancies-agents-2026-05";

/** Simulated Hermes/Gemini structured output after web research (primary sources preferred in production). */
const WEB_DISTILLATION_OUTPUT = `
{
  "sourceRunId": "${TRAJECTORY_ID}",
  "companies": [
    {
      "name": "Deloitte",
      "summary": "Global Agentic Network (2025); Google Cloud Agentic Transformation Practice with Gemini Enterprise; large library of industry agents.",
      "scoreFit": 88,
      "evidenceUrls": [
        "https://www.deloitte.com/global/en/about/press-room/deloitte-launches-global-agentic-network-to-power-digital-workforce-solutions.html",
        "https://www.deloitte.com/us/en/about/press-room/deloitte-launches-google-cloud-agentic-transformation-practice.html"
      ],
      "metadata": { "agent_scale_note": "1000+ industry agents cited in press materials" }
    },
    {
      "name": "McKinsey & Company",
      "summary": "Large-scale internal AI agent deployment narrative (tens of thousands of agents) tied to firm-wide AI productivity push.",
      "scoreFit": 82,
      "evidenceUrls": ["https://www.businessinsider.com/mckinsey-ai-agents-ai-adoption-consulting-ey-pwc-2026-2"],
      "metadata": { "notes": "Verify counts against firm primary sources when possible." }
    },
    {
      "name": "EY",
      "summary": "EY.ai agentic operating system narrative; enterprise agentic AI OS case study content.",
      "scoreFit": 86,
      "evidenceUrls": ["https://www.ey.com/en_fi/insights/ai/building-an-enterprise-scale-agentic-ai-operating-system"],
      "metadata": { "focus": "Enterprise-scale agentic platform story" }
    },
    {
      "name": "PwC",
      "summary": "Agent OS style initiatives; large-scale agent deployment reported across client operations (press/trade coverage).",
      "scoreFit": 84,
      "evidenceUrls": ["https://www.financial-world.org/news/news/financial/30088/deloitte-ey-pwc-and-kpmg-scale-ai-agents-across-audit-tax-and-consulting/"],
      "metadata": { "notes": "Cross-check with PwC primary releases." }
    },
    {
      "name": "KPMG",
      "summary": "Microsoft Workbench-related agent/chatbot fleet; significant pipeline of agents in development (trade coverage).",
      "scoreFit": 78,
      "evidenceUrls": ["https://www.financial-world.org/news/news/financial/30088/deloitte-ey-pwc-and-kpmg-scale-ai-agents-across-audit-tax-and-consulting/"],
      "metadata": { "notes": "Good Microsoft ecosystem overlap; confirm via KPMG primary sources." }
    }
  ],
  "technologies": [
    { "name": "Gemini Enterprise", "summary": "Deloitte Google Cloud Agentic Transformation Practice" },
    { "name": "Microsoft agent platforms", "summary": "KPMG Workbench / Microsoft ecosystem" }
  ],
  "signals": [
    {
      "title": "Big Four + strategy firms publicly market agentic AI at scale",
      "summary": "2025–2026 press cluster shows consultancies productizing agent fleets for audit, tax, and consulting delivery.",
      "strength": "medium",
      "relatedCompany": "Deloitte",
      "evidenceUrl": "https://www.financial-world.org/news/news/financial/30088/deloitte-ey-pwc-and-kpmg-scale-ai-agents-across-audit-tax-and-consulting/"
    }
  ]
}
`;

function formatHits(query: string): void {
  const store = openDistilledMemoryStore();
  try {
    const hits = store.searchDistilled(query, 15);
    console.log(`\n--- FTS: "${query}" @ ${store.dbPath} (${hits.length} hits) ---`);
    for (const h of hits) {
      console.log(
        `- [${h.entityType}] ${h.name} :: ${(h.summary ?? "").slice(0, 140)}${(h.summary?.length ?? 0) > 140 ? "…" : ""}`
      );
    }
  } finally {
    store.close();
  }
}

function main(): void {
  const dbPath = resolveMemoryDatabasePath();
  console.log(`Career Catalyst — consultancy AI agent trajectory`);
  console.log(`Memory DB: ${dbPath}`);

  formatHits("Deloitte OR McKinsey OR EY OR PwC OR KPMG OR consultancy OR agentic");
  formatHits("consulting firm AI agents");

  const store = openDistilledMemoryStore();
  let existing = store.searchDistilled(
    "Deloitte OR McKinsey OR EY OR PwC OR KPMG",
    25
  );
  const consultancyCompanies = existing.filter((e) => e.entityType === "company");
  store.close();

  const batch = parseResearchOutput(WEB_DISTILLATION_OUTPUT);
  if (!batch) {
    throw new Error("Internal: embedded web distillation JSON failed to parse.");
  }

  const needsWebIngest = consultancyCompanies.length < 5;
  if (needsWebIngest) {
    console.log(
      `\nMemory returned ${consultancyCompanies.length} consultancy company entities — ingesting structured web pass into FTS.`
    );
    const sink = openDistilledMemoryStore();
    try {
      const stats = commitDistilledBatch(sink, batch);
      console.log(`Distiller commit: inserted=${stats.inserted} updated=${stats.updated}`);
    } finally {
      sink.close();
    }
  } else {
    console.log(
      `\nMemory already holds ${consultancyCompanies.length} matched companies — skipping web ingest (re-run after deleting rows to force refresh).`
    );
  }

  const verify = openDistilledMemoryStore();
  try {
    const ranked = verify
      .searchDistilled("Deloitte OR McKinsey OR EY OR PwC OR KPMG", 25)
      .filter((r) => r.entityType === "company");
    console.log("\n--- Scored firms (payload_json.scoreFit) ---");
    for (const row of ranked.slice(0, 10)) {
      try {
        const payload = JSON.parse(row.payloadJson) as { scoreFit?: number };
        const score =
          typeof payload.scoreFit === "number" ? String(payload.scoreFit) : "n/a";
        console.log(`${row.name}: fit=${score}`);
      } catch {
        console.log(`${row.name}: (no score in payload)`);
      }
    }
  } finally {
    verify.close();
  }
}

main();
