/**
 * Desk store v2 — ticker buttons, active positions, paper concept outcomes, run history.
 */

import type { DeskSession, ExecutionIdea } from "@/lib/deskIdeas";

export const DESK_STORE_KEY = "gsb-desk-store-v2";
export const DESK_SESSIONS_LEGACY = "gsb-desk-sessions-v1";

export type PositionStatus =
  | "armed"
  | "waiting_trigger"
  | "monitoring"
  | "completed"
  | "expired"
  | "error"
  | "folded";

export type ActivePosition = {
  id: string;
  symbol: string;
  sessionId: string;
  ideaId: string;
  title: string;
  side: ExecutionIdea["side"];
  badge?: string;
  planId?: string;
  live: boolean;
  status: PositionStatus;
  armedAt: string;
  expiresAt: string | null;
  lastResult?: unknown;
  /** When completed/expired — folded back under ticker */
  foldedAt?: string | null;
};

export type ConceptOutcome = {
  id: string;
  symbol: string;
  sessionId: string;
  ideaId: string;
  kind: string;
  title: string;
  side: ExecutionIdea["side"];
  convictionPct: number;
  runAt: string;
  expiresAt: string;
  entry?: number | null;
  target?: number | null;
  stop?: number | null;
  /** Paper mark path — monitored whether or not Execute was pressed */
  executed: boolean;
  lastPx?: number | null;
  lastMarkedAt?: string | null;
  pnlPct?: number | null;
  hitTarget?: boolean;
  hitStop?: boolean;
  resolved?: {
    at: string;
    result: "win" | "loss" | "flat" | "expired" | "stopped";
    note?: string;
  } | null;
};

export type SessionRevision = {
  sessionId: string;
  symbol: string;
  name: string;
  analyzedAt: string;
  verdict?: string;
  bias?: string;
  ideaSummaries: Array<{
    id: string;
    kind: string;
    title: string;
    side: ExecutionIdea["side"];
    convictionPct: number;
    entry?: number | null;
    target?: number | null;
    stop?: number | null;
  }>;
};

export type TickerUiState = {
  symbol: string;
  /** When true: research + non-executed concepts collapsed into the ticker button */
  collapsed: boolean;
  /** Which position button is focused (or null = ticker concepts) */
  focus: "ticker" | string;
};

export type RunComparison = {
  symbol: string;
  prior: SessionRevision;
  currentSessionId: string;
  biasChanged: boolean;
  verdictChanged: boolean;
  convictionDelta: Array<{
    ideaKind: string;
    priorPct: number | null;
    currentPct: number | null;
    delta: number | null;
  }>;
  newIdeaIds: string[];
  droppedIdeaIds: string[];
  note: string;
};

export type DeskStoreV2 = {
  version: 2;
  sessions: DeskSession[];
  activeSessionId: string | null;
  tickerUi: Record<string, TickerUiState>;
  positions: ActivePosition[];
  outcomes: ConceptOutcome[];
  historyBySymbol: Record<string, SessionRevision[]>;
  ideaResults: Record<string, unknown>;
  lastComparison: RunComparison | null;
};

export function emptyStore(): DeskStoreV2 {
  return {
    version: 2,
    sessions: [],
    activeSessionId: null,
    tickerUi: {},
    positions: [],
    outcomes: [],
    historyBySymbol: {},
    ideaResults: {},
    lastComparison: null,
  };
}

export function parseExpiresAt(idea: ExecutionIdea, fallbackDays = 5): string {
  const sched = idea.schedule || {};
  const raw =
    (sched as any).expiration ||
    (sched as any).due_friday ||
    (sched as any).due_label ||
    (sched as any).horizon_end ||
    null;
  if (raw) {
    const m = String(raw).match(/(\d{4}-\d{2}-\d{2})/);
    if (m) return `${m[1]}T20:00:00.000Z`;
  }
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + fallbackDays);
  return d.toISOString();
}

export function revisionFromSession(session: DeskSession): SessionRevision {
  return {
    sessionId: session.id,
    symbol: session.symbol,
    name: session.name,
    analyzedAt: session.analyzedAt,
    verdict: session.verdict,
    bias: session.bias,
    ideaSummaries: session.ideas.map((i) => ({
      id: i.id,
      kind: i.kind,
      title: i.title,
      side: i.side,
      convictionPct: i.convictionPct,
      entry: num(i.levels?.entry),
      target: num(i.levels?.target),
      stop: num(i.levels?.stop),
    })),
  };
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function outcomesFromSession(session: DeskSession): ConceptOutcome[] {
  return session.ideas.map((idea) => ({
    id: `${session.id}:${idea.id}`,
    symbol: session.symbol,
    sessionId: session.id,
    ideaId: idea.id,
    kind: idea.kind,
    title: idea.title,
    side: idea.side,
    convictionPct: idea.convictionPct,
    runAt: session.analyzedAt,
    expiresAt: parseExpiresAt(idea),
    entry: num(idea.levels?.entry),
    target: num(idea.levels?.target),
    stop: num(idea.levels?.stop),
    executed: false,
    lastPx: null,
    lastMarkedAt: null,
    pnlPct: null,
    hitTarget: false,
    hitStop: false,
    resolved: null,
  }));
}

export function compareRuns(prior: SessionRevision, current: DeskSession): RunComparison {
  const curByKind = new Map(current.ideas.map((i) => [i.kind, i]));
  const priorByKind = new Map(prior.ideaSummaries.map((i) => [i.kind, i]));
  const kinds = new Set([...curByKind.keys(), ...priorByKind.keys()]);
  const convictionDelta = [...kinds].map((kind) => {
    const p = priorByKind.get(kind);
    const c = curByKind.get(kind);
    const priorPct = p?.convictionPct ?? null;
    const currentPct = c?.convictionPct ?? null;
    return {
      ideaKind: kind,
      priorPct,
      currentPct,
      delta:
        priorPct != null && currentPct != null ? currentPct - priorPct : null,
    };
  });
  const newIdeaIds = current.ideas.filter((i) => !priorByKind.has(i.kind)).map((i) => i.id);
  const droppedIdeaIds = prior.ideaSummaries.filter((i) => !curByKind.has(i.kind)).map((i) => i.id);
  const biasChanged = prior.bias !== current.bias;
  const verdictChanged = prior.verdict !== current.verdict;
  const note = [
    biasChanged ? `Bias ${prior.bias || "—"} → ${current.bias || "—"}` : null,
    verdictChanged ? `Verdict ${prior.verdict || "—"} → ${current.verdict || "—"}` : null,
    newIdeaIds.length ? `${newIdeaIds.length} new idea(s)` : null,
    droppedIdeaIds.length ? `${droppedIdeaIds.length} idea(s) dropped` : null,
  ]
    .filter(Boolean)
    .join(" · ") || "Levels / conviction refined vs prior run";

  return {
    symbol: current.symbol,
    prior,
    currentSessionId: current.id,
    biasChanged,
    verdictChanged,
    convictionDelta,
    newIdeaIds,
    droppedIdeaIds,
    note,
  };
}

/** Mark paper concepts against a price; resolve at expiry / stop / target */
export function markOutcomes(
  outcomes: ConceptOutcome[],
  quotes: Record<string, number>,
  now = new Date()
): ConceptOutcome[] {
  return outcomes.map((o) => {
    if (o.resolved) return o;
    const px = quotes[o.symbol];
    if (!Number.isFinite(px)) return o;
    const entry = o.entry;
    let pnlPct: number | null = null;
    if (entry != null && entry > 0) {
      const raw = ((px - entry) / entry) * 100;
      pnlPct = o.side === "short" ? -raw : raw;
    }
    const hitTarget =
      o.target != null &&
      (o.side === "short" ? px <= o.target : px >= o.target);
    const hitStop =
      o.stop != null && (o.side === "short" ? px >= o.stop : px <= o.stop);
    const expired = now.getTime() >= Date.parse(o.expiresAt);

    const next: ConceptOutcome = {
      ...o,
      lastPx: px,
      lastMarkedAt: now.toISOString(),
      pnlPct: pnlPct != null ? Number(pnlPct.toFixed(2)) : null,
      hitTarget: Boolean(hitTarget),
      hitStop: Boolean(hitStop),
    };

    if (hitStop) {
      next.resolved = { at: now.toISOString(), result: "stopped", note: `Stop tagged @ ${px}` };
    } else if (hitTarget) {
      next.resolved = { at: now.toISOString(), result: "win", note: `Target tagged @ ${px}` };
    } else if (expired) {
      const result =
        pnlPct == null ? "expired" : pnlPct > 0.5 ? "win" : pnlPct < -0.5 ? "loss" : "flat";
      next.resolved = { at: now.toISOString(), result, note: `Expired mark @ ${px}` };
    }
    return next;
  });
}

export function loadDeskStore(): DeskStoreV2 {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(DESK_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeskStoreV2;
      if (parsed?.version === 2 && Array.isArray(parsed.sessions)) return parsed;
    }
  } catch {
    /* migrate below */
  }
  // Migrate legacy sessions array
  try {
    const legacy = localStorage.getItem(DESK_SESSIONS_LEGACY);
    if (legacy) {
      const sessions = JSON.parse(legacy) as DeskSession[];
      if (Array.isArray(sessions) && sessions.length) {
        const store = emptyStore();
        store.sessions = sessions.slice(0, 12);
        store.activeSessionId = sessions[0]?.id || null;
        for (const s of store.sessions) {
          store.tickerUi[s.symbol] = { symbol: s.symbol, collapsed: false, focus: "ticker" };
          store.outcomes.push(...outcomesFromSession(s));
        }
        return store;
      }
    }
  } catch {
    /* empty */
  }
  return emptyStore();
}

export function saveDeskStore(store: DeskStoreV2) {
  if (typeof window === "undefined") return;
  try {
    const slim: DeskStoreV2 = {
      ...store,
      sessions: store.sessions.slice(0, 12),
      outcomes: store.outcomes.slice(-200),
      positions: store.positions.slice(-40),
      historyBySymbol: Object.fromEntries(
        Object.entries(store.historyBySymbol).map(([k, v]) => [k, v.slice(-6)])
      ),
    };
    localStorage.setItem(DESK_STORE_KEY, JSON.stringify(slim));
  } catch {
    /* quota */
  }
}
