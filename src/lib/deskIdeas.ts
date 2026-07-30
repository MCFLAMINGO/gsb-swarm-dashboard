/**
 * Normalize an Elite report into ranked Desk execution ideas
 * (highest conviction → lowest), including short / contrarian.
 * Every idea is executable via multistep arm-plan (open→monitor→add/close).
 */

export type ExecuteMode = "equity" | "options" | "plan" | "review_only";

export type PlanStep = {
  id: string;
  phase?: string;
  title?: string;
  detail?: string;
  agent_action?: string;
  status?: string;
};

export type ExecutionIdea = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  side: "long" | "short" | "hedge" | "income";
  conviction: number;
  convictionPct: number;
  /** Always true for arm-plan Execute — opening fill may still be gated */
  actionable: boolean;
  executeMode: ExecuteMode;
  notionalHint?: number | null;
  concept: string;
  instruction: string;
  laymanDirective?: string;
  executionPlan?: {
    multistep?: boolean;
    wait_for_trigger?: boolean;
    covers?: string[];
    steps?: PlanStep[];
    note?: string;
  } | null;
  method?: string;
  levels?: Record<string, unknown> | null;
  schedule?: Record<string, unknown> | null;
  asymmetry?: Record<string, unknown> | null;
  requires?: string | null;
  overlay?: unknown;
  flow?: Record<string, unknown> | null;
  badge?: string;
  symbol?: string;
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

function fmtPx(n: unknown) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `$${x.toFixed(2)}`;
}

/** Client fallback when Railway report predates layman_directive / execution_plan */
function buildClientPlan(meta: {
  symbol?: string;
  kind?: string;
  side?: string;
  entry?: unknown;
  target?: unknown;
  stop?: unknown;
  notional?: unknown;
  trigger?: string | null;
  dueLabel?: string | null;
  kellyZero?: boolean;
}): { laymanDirective: string; executionPlan: ExecutionIdea["executionPlan"] } {
  const sym = meta.symbol || "this name";
  const side = meta.side || "long";
  const isShort = side === "short";
  const isAngle = /angle|unconventional/i.test(meta.kind || "");
  const isIncome = /covered_call|income/i.test(meta.kind || "");
  const isPut = /put|hedge/i.test(meta.kind || "") && side === "hedge";
  const trigger = meta.trigger || null;
  const triggerPx = (() => {
    const t = String(trigger || "");
    const m = t.match(/near\s+(\d+(?:\.\d+)?)/i) || t.match(/(\d{2,4}(?:\.\d{1,2})?)/);
    return m ? Number(m[1]) : Number(meta.entry);
  })();

  let layman: string;
  if (trigger) {
    const action = isShort ? "open the put / downside expression" : `buy ${meta.notional != null && Number(meta.notional) > 0 ? `~$${Number(meta.notional)} of ` : ""}${sym}`;
    layman = [
      `In plain English: Do not ${isShort ? "act" : "buy"} yet.`,
      `Hitting Execute tells the agent to WAIT for: ${trigger}.`,
      `When that prints (price near ${Number.isFinite(triggerPx) ? `$${triggerPx}` : "the level"}), it ${action}, then monitors — close early at ${fmtPx(meta.stop)}, take profits near ${fmtPx(meta.target)}, or flatten by time.`,
    ].join(" ");
  } else if (meta.kellyZero && /primary/i.test(meta.kind || "")) {
    layman = `In plain English: Kelly found no edge — do not buy ${sym} right now. Re-run research before spending money.`;
  } else if (isShort) {
    layman = `In plain English: This idea bets ${sym} goes down. Aim near ${fmtPx(meta.target)}; cut near ${fmtPx(meta.stop)}. Robinhood cannot short stock here — Execute uses a put or waits.`;
  } else if (isIncome) {
    layman = `In plain English: Own ${sym} and sell a call against it for premium. Cap upside at the strike; close or roll by expiry.`;
  } else if (isPut) {
    layman = `In plain English: Buy put insurance on ${sym}. Max loss = premium. Close if the scare passes or expiry nears.`;
  } else if (isAngle) {
    layman = `In plain English: Side idea around ${sym}. Execute arms a watch checklist first — only fill as a small satellite after you deliberately confirm.`;
  } else {
    layman = [
      `In plain English: Buy about ${meta.notional != null ? `$${Number(meta.notional)} of` : ""} ${sym} if you agree with the desk.`,
      `Get in near ${fmtPx(meta.entry)}, take profits near ${fmtPx(meta.target)}, cut near ${fmtPx(meta.stop)}.`,
      "Execute covers the whole plan: open → monitor → add on pullback → close early, at target, or by time.",
    ].join(" ");
  }

  const steps: PlanStep[] = [];
  if (trigger) {
    steps.push({
      id: "wait_trigger",
      phase: "wait",
      title: "Wait for trigger (no order yet)",
      detail: trigger,
      agent_action: "monitor_quote_for_trigger",
    });
  }
  if (isShort) {
    steps.push({
      id: "open_expression",
      phase: "open",
      title: trigger ? "Place put after trigger prints" : "Open put (short expression)",
      detail: `Equity short blocked — review/place put for ${sym}`,
      agent_action: "review_option_order_then_place",
    });
  } else if (isAngle) {
    steps.push({
      id: "arm_checklist",
      phase: "open",
      title: "Arm watch / satellite checklist",
      detail: "No forced order — track levels before any satellite fill",
      agent_action: "arm_watch_only",
    });
  } else if (isIncome || isPut || /call|option/i.test(meta.kind || "")) {
    steps.push({
      id: "open_expression",
      phase: "open",
      title: "Open options leg",
      detail: `Review/place option order for ${sym}`,
      agent_action: "review_option_order_then_place",
    });
  } else {
    steps.push({
      id: "open_equity",
      phase: "open",
      title: trigger ? "Place buy after trigger prints" : "Open equity",
      detail: trigger
        ? `ONLY after trigger: buy ~$${meta.notional ?? "—"} ${sym}`
        : `Review then buy ~$${meta.notional ?? "—"} ${sym}`,
      agent_action: "review_equity_order_then_place",
    });
  }
  steps.push({
    id: "monitor_position",
    phase: "monitor",
    title: "Monitor position / tape",
    detail: `Watch ${sym}: target ${fmtPx(meta.target)} · stop ${fmtPx(meta.stop)}`,
    agent_action: "poll_quotes_and_compare_levels",
  });
  if (side === "long" && !isAngle) {
    steps.push({
      id: "add_pullback",
      phase: "add",
      title: "Add only on planned pullback",
      detail: `If price revisits ~${fmtPx(meta.entry)} without hitting stop, may add up to 1/3 — never chase`,
      agent_action: "conditional_add",
    });
  }
  steps.push({
    id: "close_manage",
    phase: "close",
    title: "Close early, on target, or by time",
    detail: [
      `Close early (stop) at ${fmtPx(meta.stop)}`,
      `Take profits near ${fmtPx(meta.target)}`,
      meta.dueLabel ? `Flat by ${meta.dueLabel}` : "Flat by horizon end",
    ].join(" · "),
    agent_action: "close_at_stop_target_or_deadline",
  });

  return {
    laymanDirective: layman,
    executionPlan: {
      multistep: true,
      wait_for_trigger: Boolean(trigger),
      covers: trigger
        ? ["wait_trigger", "open_after_trigger", "monitor", "add_on_pullback", "close_early_or_late"]
        : ["open_or_wait", "monitor", "add_on_pullback", "close_early_or_late"],
      steps,
      note: trigger
        ? "Execute arms WAIT — no order until the trigger prints."
        : "Execute arms this whole plan — not a one-shot order.",
    },
  };
}

function pickPlan(src: any, fallbackMeta?: Parameters<typeof buildClientPlan>[0]) {
  const fromServer = {
    laymanDirective: src?.layman_directive || undefined,
    executionPlan: src?.execution_plan || null,
  };
  if (fromServer.laymanDirective && fromServer.executionPlan?.steps?.length) {
    return fromServer;
  }
  const client = buildClientPlan({
    ...fallbackMeta,
    entry: fallbackMeta?.entry ?? src?.levels?.entry,
    target: fallbackMeta?.target ?? src?.levels?.target,
    stop: fallbackMeta?.stop ?? src?.levels?.stop,
    trigger: fallbackMeta?.trigger ?? src?.schedule?.trigger,
    dueLabel:
      fallbackMeta?.dueLabel ??
      src?.schedule?.due_label ??
      src?.schedule?.due_friday ??
      null,
  });
  return {
    laymanDirective: fromServer.laymanDirective || client.laymanDirective,
    executionPlan: fromServer.executionPlan?.steps?.length
      ? fromServer.executionPlan
      : client.executionPlan,
  };
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
    const putOverlay = (playbook.option_overlays || []).find((o: any) => /put/i.test(o.id || ""));
    ideas.push({
      id: primary.id || "primary_equity",
      kind: "primary_equity",
      title: primary.title || `${symbol} primary`,
      subtitle: longIdea
        ? `Primary equity · Kelly $${kellyAmt ?? "—"}`
        : isShort
          ? "Primary short bias — Execute uses put / wait plan (no equity short)"
          : "Watch plan — Execute arms monitor checklist",
      side: isShort ? "short" : longIdea ? "long" : "hedge",
      conviction: primaryConv,
      convictionPct: Math.round(primaryConv * 100),
      actionable: true,
      executeMode: isShort ? (putOverlay ? "options" : "plan") : longIdea ? "equity" : "plan",
      notionalHint: kellyAmt,
      concept:
        primary.agent_will ||
        primary.method ||
        report.institutional?.investment_thesis ||
        "Primary desk position.",
      instruction: primary.agent_instruction_plain || "",
      ...pickPlan(primary, {
        symbol,
        kind: "primary_equity",
        side: isShort ? "short" : longIdea ? "long" : "hedge",
        entry: primary.levels?.entry ?? week.entry_price,
        target: primary.levels?.target ?? week.target_price,
        stop: primary.levels?.stop ?? week.stop_price,
        notional: kellyAmt,
        dueLabel: primary.schedule?.due_friday || primary.schedule?.due_label,
        kellyZero: Number(kellyAmt) === 0,
      }),
      method: primary.method,
      levels: primary.levels || {
        entry: week.entry_price,
        target: week.target_price,
        stop: week.stop_price,
      },
      schedule: primary.schedule,
      asymmetry: primary.asymmetry,
      overlay: isShort ? putOverlay : undefined,
      flow: primary.what_flows_to_robinhood,
      badge: isShort ? "SHORT" : bias === "NEUTRAL" ? "WATCH" : "PRIMARY",
      symbol,
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
    const hasPreview = Boolean(o.what_flows_to_robinhood?.order_preview);
    ideas.push({
      id,
      kind: id,
      title: o.title || id,
      subtitle: o.requires || o.schedule?.due_label || "Option overlay · multistep",
      side,
      conviction: clamp01(conviction),
      convictionPct: Math.round(clamp01(conviction) * 100),
      actionable: true,
      executeMode: hasPreview ? "options" : "plan",
      concept: o.agent_will || o.method || "",
      instruction: o.agent_instruction_plain || "",
      ...pickPlan(o, {
        symbol,
        kind: id,
        side,
        entry: o.levels?.stock ?? o.levels?.entry ?? week.entry_price,
        target: week.target_price,
        stop: week.stop_price,
        notional: kellyAmt,
        dueLabel: o.schedule?.due_label || o.schedule?.expiration,
      }),
      method: o.method,
      levels: o.levels,
      schedule: o.schedule,
      asymmetry: o.asymmetry,
      requires: o.requires,
      overlay: o,
      flow: o.what_flows_to_robinhood,
      badge: side === "income" ? "INCOME" : side === "short" ? "SHORT PUT" : side === "long" ? "CALL" : "HEDGE",
      symbol,
    });
  }

  const contra = playbook.contrarian_directive || tp.contrarian_play;
  if (contra) {
    const setup = contra.setup || contra.levels || {};
    const cConv = clamp01(Number(contra.conviction ?? setup.confidence ?? primaryConv * 0.55));
    const contraIsLong = /long|buy/i.test(String(contra.direction || contra.action || ""));
    const putOverlay = overlays.find((o: any) => /put/i.test(o.id || ""));
    ideas.push({
      id: contra.id || "contrarian_fade",
      kind: "contrarian_fade",
      title: contra.title || `${symbol} contrarian`,
      subtitle: contra.action || "Contrarian fade · wait trigger → monitor → close",
      side: contraIsLong ? "long" : "short",
      conviction: cConv,
      convictionPct: Math.round(cConv * 100),
      actionable: true,
      executeMode: contraIsLong ? "equity" : putOverlay ? "options" : "plan",
      notionalHint:
        kellyAmt != null && Number(kellyAmt) > 0
          ? Number(kellyAmt) * 0.5
          : (contra.what_flows_to_robinhood?.order_preview?.amount ?? 50),
      concept:
        contra.agent_will ||
        contra.thesis ||
        (contra.why_crowded_may_be_wrong || []).join(" ") ||
        "Fade the primary desk bias.",
      instruction:
        contra.agent_instruction_plain ||
        `AGENT: Contrarian on ${symbol}. Wait for trigger, then open; monitor target/stop; close by Friday.`,
      ...pickPlan(contra, {
        symbol,
        kind: "contrarian_fade",
        side: contraIsLong ? "long" : "short",
        entry: setup.entry_price ?? contra.levels?.entry,
        target: setup.target_price ?? contra.levels?.target,
        stop: setup.stop_price ?? contra.levels?.stop,
        notional: kellyAmt != null ? Number(kellyAmt) * 0.5 : null,
        trigger: setup.entry_trigger || contra.schedule?.trigger,
        dueLabel: contra.schedule?.due_friday || "Friday",
      }),
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
      schedule: {
        ...(contra.schedule || {}),
        trigger: setup.entry_trigger || contra.schedule?.trigger,
      },
      asymmetry: contra.asymmetry,
      overlay: contraIsLong ? undefined : putOverlay,
      flow: contra.what_flows_to_robinhood,
      badge: "CONTRARIAN",
      symbol,
    });
  }

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
      subtitle: a.schedule?.due_label || evidenceBits || "Satellite · Execute arms watch plan",
      side: "hedge",
      conviction: clamp01(primaryConv * 0.45),
      convictionPct: Math.round(clamp01(primaryConv * 0.45) * 100),
      actionable: true,
      executeMode: "plan",
      concept: [a.thesis, evidenceBits ? `Evidence: ${evidenceBits}` : ""].filter(Boolean).join("\n\n"),
      instruction: a.agent_instruction_plain || "",
      ...pickPlan(a, {
        symbol,
        kind: a.id || "unconventional",
        side: "hedge",
        entry: week.entry_price,
        target: week.target_price,
        stop: week.stop_price,
        dueLabel: a.schedule?.due_label,
      }),
      method: Array.isArray(a.method) ? a.method.join(" · ") : a.method,
      schedule: a.schedule,
      asymmetry: a.asymmetry,
      badge: "ANGLE",
      symbol,
    });
  }

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
