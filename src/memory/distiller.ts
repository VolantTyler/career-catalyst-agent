import type { DatabaseSync } from "node:sqlite";
import type {
  DistilledBatch,
  DistilledCompany,
  DistilledSignal,
  DistilledTechnology,
  EntityType,
} from "./types.js";
import { openDistilledMemoryStore, stableEntityId, type DistilledMemoryStore } from "./store.js";

/**
 * Pull structured JSON from Hermes/Gemini-style research blobs: full JSON document
 * or fenced ```json blocks.
 */
export function extractDistilledJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // continue
  }
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as unknown;
    } catch {
      return undefined;
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coerceBatch(parsed: unknown): DistilledBatch | undefined {
  if (!isRecord(parsed)) {
    return undefined;
  }
  const companiesRaw = parsed["companies"];
  const technologiesRaw = parsed["technologies"];
  const signalsRaw = parsed["signals"];
  const sourceRunId = parsed["sourceRunId"];

  const companies: DistilledCompany[] = Array.isArray(companiesRaw)
    ? companiesRaw.filter(isRecord).map((c) => ({
        id: typeof c["id"] === "string" ? c["id"] : undefined,
        name: String(c["name"] ?? ""),
        summary: typeof c["summary"] === "string" ? c["summary"] : undefined,
        scoreFit: typeof c["scoreFit"] === "number" ? c["scoreFit"] : undefined,
        evidenceUrls: Array.isArray(c["evidenceUrls"])
          ? c["evidenceUrls"].filter((u): u is string => typeof u === "string")
          : undefined,
        metadata:
          isRecord(c["metadata"]) ? (c["metadata"] as Record<string, unknown>) : undefined,
      }))
    : [];

  const technologies: DistilledTechnology[] = Array.isArray(technologiesRaw)
    ? technologiesRaw.filter(isRecord).map((t) => ({
        id: typeof t["id"] === "string" ? t["id"] : undefined,
        name: String(t["name"] ?? ""),
        summary: typeof t["summary"] === "string" ? t["summary"] : undefined,
        metadata:
          isRecord(t["metadata"]) ? (t["metadata"] as Record<string, unknown>) : undefined,
      }))
    : [];

  const signals: DistilledSignal[] = Array.isArray(signalsRaw)
    ? signalsRaw.filter(isRecord).map((s) => ({
        id: typeof s["id"] === "string" ? s["id"] : undefined,
        title: String(s["title"] ?? ""),
        summary: String(s["summary"] ?? ""),
        strength:
          s["strength"] === "strong" ||
          s["strength"] === "medium" ||
          s["strength"] === "weak"
            ? s["strength"]
            : undefined,
        relatedCompany:
          typeof s["relatedCompany"] === "string" ? s["relatedCompany"] : undefined,
        evidenceUrl: typeof s["evidenceUrl"] === "string" ? s["evidenceUrl"] : undefined,
        metadata:
          isRecord(s["metadata"]) ? (s["metadata"] as Record<string, unknown>) : undefined,
      }))
    : [];

  return {
    companies,
    technologies,
    signals,
    sourceRunId: typeof sourceRunId === "string" ? sourceRunId : undefined,
  };
}

export function parseResearchOutput(raw: string): DistilledBatch | undefined {
  const extracted = extractDistilledJson(raw);
  const batch = coerceBatch(extracted ?? {});
  if (
    !batch ||
    (batch.companies.length === 0 &&
      batch.technologies.length === 0 &&
      batch.signals.length === 0)
  ) {
    return undefined;
  }
  return batch;
}

export interface CommitStats {
  inserted: number;
  updated: number;
}

function upsertEntity(
  db: DatabaseSync,
  input: {
    id: string;
    entityType: EntityType;
    name: string;
    summary: string | null;
    payloadJson: string;
    sourceRunId: string | null;
  }
): "inserted" | "updated" {
  const now = Math.floor(Date.now() / 1000);
  const existing = db
    .prepare(`SELECT rowid FROM distilled_entities WHERE id = ?`)
    .get(input.id) as { rowid: number } | undefined;

  if (existing) {
    db.prepare(
      `
      UPDATE distilled_entities SET
        name = ?,
        summary = ?,
        payload_json = ?,
        source_run_id = COALESCE(?, source_run_id),
        created_at = created_at
      WHERE id = ?
    `
    ).run(
      input.name,
      input.summary,
      input.payloadJson,
      input.sourceRunId,
      input.id
    );
    return "updated";
  }

  db.prepare(
    `
    INSERT INTO distilled_entities (id, entity_type, name, summary, payload_json, source_run_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    input.id,
    input.entityType,
    input.name,
    input.summary,
    input.payloadJson,
    input.sourceRunId,
    now
  );
  return "inserted";
}

/**
 * Idempotent-ish upsert of distilled entities into FTS-backed SQLite.
 */
export function commitDistilledBatch(
  store: DistilledMemoryStore,
  batch: DistilledBatch
): CommitStats {
  const db = store.db;
  let inserted = 0;
  let updated = 0;
  const runId = batch.sourceRunId ?? null;

  for (const c of batch.companies) {
    if (!c.name.trim()) {
      continue;
    }
    const id = c.id ?? stableEntityId("company", c.name);
    const payload = JSON.stringify(c);
    const res = upsertEntity(db, {
      id,
      entityType: "company",
      name: c.name,
      summary: c.summary ?? null,
      payloadJson: payload,
      sourceRunId: runId,
    });
    if (res === "inserted") {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  for (const t of batch.technologies) {
    if (!t.name.trim()) {
      continue;
    }
    const id = t.id ?? stableEntityId("technology", t.name);
    const payload = JSON.stringify(t);
    const res = upsertEntity(db, {
      id,
      entityType: "technology",
      name: t.name,
      summary: t.summary ?? null,
      payloadJson: payload,
      sourceRunId: runId,
    });
    if (res === "inserted") {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  for (const s of batch.signals) {
    if (!s.title.trim() && !s.summary.trim()) {
      continue;
    }
    const id =
      s.id ??
      stableEntityId(
        "signal",
        `${s.title}|${s.relatedCompany ?? ""}|${s.evidenceUrl ?? ""}`
      );
    const payload = JSON.stringify(s);
    const res = upsertEntity(db, {
      id,
      entityType: "signal",
      name: s.title || s.summary.slice(0, 80),
      summary: s.summary,
      payloadJson: payload,
      sourceRunId: runId,
    });
    if (res === "inserted") {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  return { inserted, updated };
}

export function distillAndCommit(raw: string, dbPath?: string): CommitStats | undefined {
  const batch = parseResearchOutput(raw);
  if (!batch) {
    return undefined;
  }
  const store = openDistilledMemoryStore(dbPath);
  try {
    return commitDistilledBatch(store, batch);
  } finally {
    store.close();
  }
}
