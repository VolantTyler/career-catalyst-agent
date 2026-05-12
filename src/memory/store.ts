import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import type { DistilledEntityRow, EntityType } from "./types.js";

export interface DistilledMemoryStore {
  readonly dbPath: string;
  readonly db: DatabaseSync;
  searchDistilled(query: string, limit?: number): DistilledEntityRow[];
  close(): void;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS distilled_entities (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT UNIQUE NOT NULL,
      entity_type TEXT NOT NULL,
      name TEXT NOT NULL,
      summary TEXT,
      payload_json TEXT NOT NULL,
      source_run_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_distilled_entities_type ON distilled_entities(entity_type);
    CREATE INDEX IF NOT EXISTS idx_distilled_entities_created ON distilled_entities(created_at);

    CREATE VIRTUAL TABLE IF NOT EXISTS distilled_entities_fts USING fts5(
      name,
      summary,
      content='distilled_entities',
      content_rowid='rowid',
      tokenize = 'unicode61 remove_diacritics 2'
    );

    CREATE TRIGGER IF NOT EXISTS distilled_entities_ai AFTER INSERT ON distilled_entities BEGIN
      INSERT INTO distilled_entities_fts(rowid, name, summary)
      VALUES (new.rowid, new.name, COALESCE(new.summary, ''));
    END;

    CREATE TRIGGER IF NOT EXISTS distilled_entities_ad AFTER DELETE ON distilled_entities BEGIN
      INSERT INTO distilled_entities_fts(distilled_entities_fts, rowid, name, summary)
      VALUES ('delete', old.rowid, old.name, COALESCE(old.summary, ''));
    END;

    CREATE TRIGGER IF NOT EXISTS distilled_entities_au AFTER UPDATE ON distilled_entities BEGIN
      INSERT INTO distilled_entities_fts(distilled_entities_fts, rowid, name, summary)
      VALUES ('delete', old.rowid, old.name, COALESCE(old.summary, ''));
      INSERT INTO distilled_entities_fts(rowid, name, summary)
      VALUES (new.rowid, new.name, COALESCE(new.summary, ''));
    END;
  `);
}

/** FTS5: quote tokens; AND interior words; preserve caller OR groups. */
function escapeFtsSegment(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed
    .replaceAll('"', '""')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t}"`)
    .join(" AND ");
}

function buildFtsQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  if (/\sOR\s/i.test(trimmed)) {
    return trimmed
      .split(/\sOR\s/i)
      .map((seg) => escapeFtsSegment(seg))
      .filter(Boolean)
      .join(" OR ");
  }
  return escapeFtsSegment(trimmed);
}

export function resolveMemoryDatabasePath(cwd: string = process.cwd()): string {
  const dataDir = resolve(cwd, process.env["CAREER_CATALYST_DATA_DIR"] ?? "data");
  mkdirSync(dataDir, { recursive: true });
  const name = process.env["CAREER_CATALYST_MEMORY_DB"] ?? "catalyst-memory.sqlite";
  return resolve(dataDir, name);
}

export function openDistilledMemoryStore(dbPath?: string): DistilledMemoryStore {
  const path = dbPath ?? resolveMemoryDatabasePath();
  const db = new DatabaseSync(path);
  migrate(db);

  const searchSql = `
    SELECT e.rowid, e.id, e.entity_type, e.name, e.summary, e.payload_json, e.source_run_id, e.created_at
    FROM distilled_entities_fts fts
    JOIN distilled_entities e ON e.rowid = fts.rowid
    WHERE distilled_entities_fts MATCH ?
    ORDER BY bm25(distilled_entities_fts)
    LIMIT ?
  `;
  const searchStmt = db.prepare(searchSql);

  return {
    dbPath: path,
    db,
    searchDistilled(query: string, limit = 25): DistilledEntityRow[] {
      const ftsQuery = buildFtsQuery(query);
      if (!ftsQuery) {
        return [];
      }
      const rows = searchStmt.all(ftsQuery, limit) as Array<{
        rowid: number;
        id: string;
        entity_type: string;
        name: string;
        summary: string | null;
        payload_json: string;
        source_run_id: string | null;
        created_at: number;
      }>;
      const out: DistilledEntityRow[] = [];
      for (const r of rows) {
        if (
          r.entity_type !== "company" &&
          r.entity_type !== "technology" &&
          r.entity_type !== "signal"
        ) {
          continue;
        }
        out.push({
          rowid: r.rowid,
          id: r.id,
          entityType: r.entity_type,
          name: r.name,
          summary: r.summary,
          payloadJson: r.payload_json,
          sourceRunId: r.source_run_id,
          createdAt: r.created_at,
        });
      }
      return out;
    },
    close() {
      db.close();
    },
  };
}

export function stableEntityId(type: EntityType, name: string): string {
  const slug = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
  return `${type}:${slug || "unknown"}`;
}
