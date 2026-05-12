export type EntityType = "company" | "technology" | "signal";

export interface DistilledCompany {
  /** Stable slug or canonical id */
  id?: string | undefined;
  name: string;
  summary?: string | undefined;
  /** 0–100 fit vs Agentic Architect profile when scoring trajectories */
  scoreFit?: number | undefined;
  evidenceUrls?: string[] | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface DistilledTechnology {
  id?: string | undefined;
  name: string;
  summary?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface DistilledSignal {
  id?: string | undefined;
  title: string;
  summary: string;
  strength?: "strong" | "medium" | "weak" | undefined;
  relatedCompany?: string | undefined;
  evidenceUrl?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface DistilledBatch {
  companies: DistilledCompany[];
  technologies: DistilledTechnology[];
  signals: DistilledSignal[];
  /** Hermes / Gemini run id or trajectory label */
  sourceRunId?: string | undefined;
}

export interface DistilledEntityRow {
  rowid: number;
  id: string;
  entityType: EntityType;
  name: string;
  summary: string | null;
  payloadJson: string;
  sourceRunId: string | null;
  createdAt: number;
}
