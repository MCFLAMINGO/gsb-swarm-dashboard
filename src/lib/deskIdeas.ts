/**
 * Normalize an Elite report into ranked Desk execution ideas
 * (highest conviction → lowest), including short / contrarian.
 */

export type ExecuteMode = "equity" | "options" | "review_only";

export type ExecutionIdea = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  side: "long" | "short" | "hedge" | "income";
  conviction: number;
  convictionPct: number;
  actionable: boolean;
  executeMode: ExecuteMode;
  notionalHint?: number | null;
  concept: string;
  instruction: string;
  method?: string;
  levels?: Record<string, unknown> | null;
  schedule?: Record<string, unknown> | null;
  asymmetry?: Record<string, unknown> | null;
  requires?: string | null;
  /** Option overlay payload for /api/robinhood options */
  overlay?: unknown;
  flow?: Record<string, unknown> | null;
  badge?: string;
};

export type DeskSession = {
  id: string;
  symbol: string;
  name: string;
  analyzedAt: string;
  verdict?: string;
  bias?: string;
  report: any;
  ideas: ExecutionIdea[];
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function companyNameFromReport(report: any): string {
  const y = report?.fundamentals_micro?.yahoo || {};
  const name =
    y.longName ||
    y.shortName ||
    y.name ||
    y.displayName ||
    report?.industry?.industry ||
    report?.industry?.sector ||
    null;
  if (name && String(name).toLowerCase() !== String(report?.resolved_symbol || "").toLowerCase()) {
    return String(name);
  }
  // Soft parse from thesis: "AAPL rated BUY…" — skip
  return String(report?.resolved_symbol || "Unknown");
}

export function sessionTitle(session: DeskSession): string {
  const sym = session.symbol;
  const name = session.name;
  if (!name || name === sym) return sym;
  return `${sym} — ${name}`;
}

export function buildExecutionIdeas(report: any): ExecutionIdea[] {
  if (!report) return [];
  const symbol = report.resolved_symbol || report.query || "—";
  const playbook = report.agent_playbook || {};
  const tp = report.trade_plan || {};
  const week = tp.horizons?.week || {};
  const ceo = report.ceo_trade_book || {};
  const primaryConv = clamp01(Number(report.verdict?.conviction ?? week.confidence ?? 0.5));
  const bias = tp.bias || report.institutional?.bias || "NEUTRAL";
  const isLong = bias === "LONG" || bias === "LONG_BIAS";
  const isShort = bias === "SHORT" || bias === "SHORT_BIAS";
  const kellyAmt = ceo?.kelly?.recommended_notional_usd ?? tp?.kelly?.recommended_notional_usd ?? null;

  const ideas: ExecutionIdea[] = [];

  const primary = playbook.primary_directive;
  if (primary) {
    const longIdea = isLong || (!isShort && bias !== "NEUTRAL");
    ideas.push({
      id: primary.id || "primary_equity",
      kind: "primary_equity",
      title: primary.title || `${symbol} primary`,
      subtitle: longIdea
        ? `Primary equity · Kelly $${kellyAmt ?? "—"}`
        : isShort
          ? "Primary short bias (equity short limited — prefer put)"
          : "Watch / no equity order",
      side: isShort ? "short" : longIdea ? "long" : "hedge",
      conviction: primaryConv,
      convictionPct: Math.round(primaryConv * 100),
      actionable: Boolean(primary.what_flows_to_robinhood?.executable_now && (isLong || bias === "LONG_BIAS")),
      executeMode: isShort ? "review_only" : "equity",
      notionalHint: kellyAmt,
      concept:
        primary.agent_will ||
        primary.method ||
        report.institutional?.investment_thesis ||
        "Primary desk position.",
      instruction: primary.agent_instruction_plain || "",
      method: primary.method,
      levels: primary.levels || {
        entry: week.entry_price,
        target: week.target_price,
        stop: week.stop_price,
      },
      schedule: primary.schedule,
      asymmetry: primary.asymmetry,
      flow: primary.what_flows_to_robinhood,
      badge: isShort ? "SHORT" : bias === "NEUTRAL" ? "WATCH" : "PRIMARY",
    });
  }

  const overlays = [
    ...(playbook.option_overlays || []),
    ...((playbook.asymmetric_book || []).filter(
      (a: any) => !(playbook.option_overlays || []).some((o: any) => o.id === a.id)
    ) || []),
  ];

  for (const o of overlays) {
    const id = o.id || o.title;
    let side: ExecutionIdea["side"] = "hedge";
    let kind = id;
    let conviction = primaryConv * 0.72;
    if (/covered_call/i.test(id)) {
      side = "income";
      conviction = primaryConv * 0.78;
    } else if (/call_debit|long_call/i.test(id)) {
      side = "long";
      conviction = primaryConv * 0.85;
    } else if (/put/i.test(id)) {
      side = isShort ? "short" : "hedge";
      conviction = isShort ? primaryConv * 0.9 : primaryConv * 0.65;
    }
    const executable = Boolean(o.what_flows_to_robinhood?.executable_now && o.what_flows_to_robinhood?.order_preview);
    ideas.push({
      id,
      kind,
      title: o.title || id,
      subtitle: o.requires || o.schedule?.due_label || "Option overlay",
      side,
      conviction: clamp01(conviction),
      convictionPct: Math.round(clamp01(conviction) * 100),
      actionable: executable,
      executeMode: executable ? "options" : "review_only",
      concept: o.agent_will || o.method || "",
      instruction: o.agent_instruction_plain || "",
      method: o.method,
      levels: o.levels,
      schedule: o.schedule,
      asymmetry: o.asymmetry,
      requires: o.requires,
      overlay: o,
      flow: o.what_flows_to_robinhood,
      badge: side === "income" ? "INCOME" : side === "short" ? "SHORT PUT" : side === "long" ? "CALL" : "HEDGE",
    });
  }

  const contra = playbook.contrarian_directive || tp.contrarian_play;
  if (contra) {
    const setup = contra.setup || contra.levels || {};
    const cConv = clamp01(Number(contra.conviction ?? setup.confidence ?? primaryConv * 0.55));
    const contraOverlay = overlays.find((o: any) => /put/i.test(o.id || ""));
    ideas.push({
      id: contra.id || "contrarian_short",
      kind: "contrarian_short",
      title: contra.title || `${symbol} short / fade`,
      subtitle: contra.action || "Contrarian short expression",
      side: "short",
      conviction: cConv,
      convictionPct: Math.round(cConv * 100),
      actionable: Boolean(contraOverlay?.what_flows_to_robinhood?.order_preview),
      executeMode: contraOverlay ? "options" : "review_only",
      concept:
        contra.agent_will ||
        contra.thesis ||
        (contra.why_crowded_may_be_wrong || []).join(" ") ||
        "Fade the primary desk bias.",
      instruction:
        contra.agent_instruction_plain ||
        `AGENT: Contrarian ${contra.action || "SELL/SHORT"} on ${symbol}. Equity short may be blocked — prefer put debit if executing.`,
      method: contra.method,
      levels: setup.entry_price
        ? {
            entry: setup.entry_price,
            target: setup.target_price,
            stop: setup.stop_price,
            target_roi_pct: setup.target_roi_pct,
            stop_loss_pct: setup.stop_loss_pct,
          }
        : contra.levels,
      schedule: contra.schedule,
      asymmetry: contra.asymmetry,
      overlay: contraOverlay || undefined,
      flow: contra.what_flows_to_robinhood,
      badge: "SHORT",
    });
  }

  // Unconventional angles — lower conviction satellite ideas (evidence-built, not canned)
  for (const a of playbook.unconventional_angles || []) {
    const evidenceBits = a.evidence
      ? Object.entries(a.evidence)
          .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length))
          .slice(0, 4)
          .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("|") : v}`)
          .join(" · ")
      : "";
    ideas.push({
      id: a.id || a.headline,
      kind: "unconventional",
      title: a.headline || a.id || "Unconventional angle",
      subtitle: a.schedule?.due_label || evidenceBits || "Evidence-built satellite",
      side: "hedge",
      conviction: clamp01(primaryConv * 0.45),
      convictionPct: Math.round(clamp01(primaryConv * 0.45) * 100),
      actionable: false,
      executeMode: "review_only",
      concept: [a.thesis, evidenceBits ? `Evidence: ${evidenceBits}` : ""].filter(Boolean).join("\n\n"),
      instruction: a.agent_instruction_plain || "",
      method: Array.isArray(a.method) ? a.method.join(" · ") : a.method,
      schedule: a.schedule,
      asymmetry: a.asymmetry,
      badge: "ANGLE",
    });
  }

  // Dedupe by id, sort conviction high → low
  const seen = new Set<string>();
  return ideas
    .filter((idea) => {
      if (seen.has(idea.id)) return false;
      seen.add(idea.id);
      return true;
    })
    .sort((a, b) => b.conviction - a.conviction || a.title.localeCompare(b.title));
}

export function buildDeskSession(report: any): DeskSession {
  const symbol = String(report?.resolved_symbol || report?.query || "UNKNOWN").toUpperCase();
  return {
    id: `${symbol}-${report?.analyzed_at || Date.now()}`,
    symbol,
    name: companyNameFromReport(report),
    analyzedAt: report?.analyzed_at || new Date().toISOString(),
    verdict: report?.verdict?.verdict,
    bias: report?.trade_plan?.bias,
    report,
    ideas: buildExecutionIdeas(report),
  };
}
