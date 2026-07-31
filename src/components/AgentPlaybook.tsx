"use client";

import { Crosshair, GitBranch, Lightbulb, Shield, Clock, Play, Loader2, ListOrdered } from "lucide-react";

type Playbook = any;
type Overlay = any;

export default function AgentPlaybook({
  playbook,
  onExecuteIdea,
  onLiveIdea,
  rhBusy,
  liveEnabled,
  optionsEnabled = true,
  busyIdeaId,
}: {
  playbook: Playbook | null | undefined;
  /** Execute any idea/directive (primary, contra, overlay, angle) — multistep arm */
  onExecuteIdea?: (idea: Overlay) => void;
  onLiveIdea?: (idea: Overlay) => void;
  rhBusy?: boolean;
  liveEnabled?: boolean;
  optionsEnabled?: boolean;
  busyIdeaId?: string | null;
  /** @deprecated use onExecuteIdea */
  onReview?: () => void;
  onLive?: () => void;
  onOptionReview?: (overlay: Overlay) => void;
  onOptionLive?: (overlay: Overlay) => void;
  biasNeutral?: boolean;
}) {
  if (!playbook) return null;
  const primary = playbook.primary_directive;
  const overlays = playbook.option_overlays || [];
  const angles = playbook.unconventional_angles || [];
  const asym = playbook.asymmetric_book || [];
  const optionRows = [
    ...overlays,
    ...asym.filter((a: Overlay) => !overlays.find((o: Overlay) => o.id === a.id)),
  ];

  return (
    <section className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-5 md:p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
          <Crosshair className="h-5 w-5 text-emerald-400" /> What the agent will do
        </h2>
        <p className="text-base text-foreground/80">
          Every idea has Execute — arms the full plan on the server (wait/open → monitor → add → close).
          You can walk away; the worker follows through.
        </p>
        {(playbook.how_to_read || []).length > 0 && (
          <ol className="list-decimal pl-5 text-sm text-foreground/75 space-y-1 pt-1">
            {playbook.how_to_read.map((line: string, i: number) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        )}
      </div>

      {primary && (
        <DirectiveCard
          tone="primary"
          title={primary.title}
          badge={primary.what_flows_to_robinhood?.executable_now ? "EXECUTABLE" : "WATCH / PLAN"}
          instruction={primary.agent_instruction_plain}
          will={primary.agent_will}
          method={primary.method}
          asymmetry={primary.asymmetry}
          schedule={primary.schedule}
          levels={primary.levels}
          flow={primary.what_flows_to_robinhood}
          layman={primary.layman_directive}
          steps={primary.execution_plan?.steps}
          busy={rhBusy && busyIdeaId === primary.id}
          liveEnabled={liveEnabled}
          onExecute={onExecuteIdea ? () => onExecuteIdea(primary) : undefined}
          onLive={onLiveIdea ? () => onLiveIdea(primary) : undefined}
        />
      )}

      {playbook.contrarian_directive && (
        <DirectiveCard
          tone="contra"
          title={playbook.contrarian_directive.title}
          badge="CONTRARIAN"
          instruction={playbook.contrarian_directive.agent_instruction_plain}
          will={playbook.contrarian_directive.agent_will}
          method={playbook.contrarian_directive.method}
          asymmetry={playbook.contrarian_directive.asymmetry}
          schedule={playbook.contrarian_directive.schedule}
          levels={playbook.contrarian_directive.levels}
          flow={playbook.contrarian_directive.what_flows_to_robinhood}
          layman={playbook.contrarian_directive.layman_directive}
          steps={playbook.contrarian_directive.execution_plan?.steps}
          busy={rhBusy && busyIdeaId === playbook.contrarian_directive.id}
          liveEnabled={liveEnabled}
          onExecute={onExecuteIdea ? () => onExecuteIdea(playbook.contrarian_directive) : undefined}
          onLive={onLiveIdea ? () => onLiveIdea(playbook.contrarian_directive) : undefined}
        />
      )}

      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-300" /> Option overlays & asymmetric book
        </h3>
        <div className="grid md:grid-cols-1 gap-3">
          {optionRows.map((o: Overlay) => (
            <DirectiveCard
              key={o.id}
              tone="overlay"
              title={o.title}
              badge={o.what_flows_to_robinhood?.order_preview ? "OPTIONS" : "STAGED"}
              instruction={o.agent_instruction_plain}
              will={o.agent_will}
              method={o.method}
              asymmetry={o.asymmetry}
              schedule={o.schedule}
              levels={o.levels}
              flow={o.what_flows_to_robinhood}
              requires={o.requires}
              layman={o.layman_directive}
              steps={o.execution_plan?.steps}
              busy={rhBusy && busyIdeaId === o.id}
              liveEnabled={liveEnabled && optionsEnabled}
              onExecute={onExecuteIdea ? () => onExecuteIdea(o) : undefined}
              onLive={onLiveIdea ? () => onLiveIdea(o) : undefined}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-accent" /> Unconventional angles
        </h3>
        <div className="space-y-3">
          {angles.map((a: any) => (
            <DirectiveCard
              key={a.id}
              tone="overlay"
              title={a.headline || a.title}
              badge="ANGLE"
              instruction={a.agent_instruction_plain}
              will={a.thesis}
              method={Array.isArray(a.method) ? a.method.join(" · ") : a.method}
              asymmetry={a.asymmetry}
              schedule={a.schedule}
              levels={null}
              flow={null}
              layman={a.layman_directive}
              steps={a.execution_plan?.steps}
              busy={rhBusy && busyIdeaId === a.id}
              liveEnabled={liveEnabled}
              onExecute={onExecuteIdea ? () => onExecuteIdea(a) : undefined}
              onLive={onLiveIdea ? () => onLiveIdea(a) : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function DirectiveCard({
  title,
  badge,
  instruction,
  will,
  method,
  asymmetry,
  schedule,
  levels,
  flow,
  requires,
  tone,
  layman,
  steps,
  onExecute,
  onLive,
  busy,
  liveEnabled,
}: {
  title: string;
  badge: string;
  instruction?: string;
  will?: string;
  method?: string;
  asymmetry?: any;
  schedule?: any;
  levels?: any;
  flow?: any;
  requires?: string;
  tone: "primary" | "contra" | "overlay";
  layman?: string;
  steps?: any[];
  onExecute?: () => void;
  onLive?: () => void;
  busy?: boolean;
  liveEnabled?: boolean;
}) {
  const shell =
    tone === "primary"
      ? "border-emerald-500/40 bg-emerald-500/10"
      : tone === "contra"
        ? "border-amber-500/40 bg-amber-500/10"
        : "border-border bg-card";
  return (
    <div className={`rounded-lg border ${shell} p-4 space-y-2`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <h4 className="text-base font-semibold text-foreground">{title}</h4>
        <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded border border-border bg-secondary">
          {badge}
        </span>
      </div>
      {requires && <p className="text-sm text-amber-200">Requires: {requires}</p>}
      {will && <p className="text-base text-foreground/90 leading-relaxed">{will}</p>}
      {instruction && (
        <p className="text-sm md:text-base mono text-foreground border border-border bg-background/50 rounded px-3 py-2 leading-relaxed">
          {instruction}
        </p>
      )}
      {method && (
        <p className="text-sm text-foreground/80">
          <span className="font-semibold">Method:</span> {method}
        </p>
      )}
      {asymmetry && (
        <div className="text-sm text-foreground/85 space-y-0.5">
          <div className="flex items-center gap-1.5 font-semibold">
            <GitBranch className="h-3.5 w-3.5" /> Asymmetry · {asymmetry.style}
          </div>
          <p>{asymmetry.why_asymmetric || asymmetry.payoff}</p>
          {(asymmetry.max_gain_pct != null || asymmetry.max_loss_pct != null) && (
            <p>
              Target {asymmetry.max_gain_pct != null ? `+${asymmetry.max_gain_pct}%` : asymmetry.max_gain || "—"}
              {" · "}
              Risk {asymmetry.max_loss_pct != null ? `${asymmetry.max_loss_pct}%` : asymmetry.max_loss || "—"}
              {asymmetry.risk_reward != null && ` · R:R ${asymmetry.risk_reward}x`}
            </p>
          )}
        </div>
      )}
      {schedule && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-amber-100/90">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {schedule.trigger
              ? `Trigger: ${schedule.trigger}`
              : schedule.due_label || schedule.due_friday || schedule.expiration
                ? `Due ${schedule.due_label || schedule.due_friday || schedule.expiration}`
                : "See schedule"}
          </span>
          {schedule.dte_approx != null && <span>~{schedule.dte_approx} DTE</span>}
        </div>
      )}
      {levels && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          {Object.entries(levels).map(([k, v]) => (
            <div key={k} className="rounded border border-border/60 bg-secondary/40 px-2 py-1.5">
              <div className="text-foreground/60 text-xs uppercase">{k.replace(/_/g, " ")}</div>
              <div className="font-medium text-foreground">{v == null || v === "" ? "—" : String(v)}</div>
            </div>
          ))}
        </div>
      )}
      {(steps || []).length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-foreground/60 flex items-center gap-1">
            <ListOrdered className="h-3.5 w-3.5" /> Steps Execute will run
          </div>
          <ol className="space-y-1">
            {steps!.map((s: any, i: number) => (
              <li key={s.id || i} className="text-sm text-foreground/85 border border-border/40 rounded px-2 py-1.5 bg-background/40">
                <span className="font-semibold">{i + 1}. {s.title || s.phase}</span>
                {s.detail && <span className="text-foreground/70"> — {s.detail}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {flow?.tool_sequence && (
        <p className="text-xs text-foreground/65">
          MCP flow: {flow.tool_sequence.join(" → ")}
        </p>
      )}

      <div className="rounded-md border border-sky-500/35 bg-sky-500/10 px-3 py-3 mt-2">
        <div className="text-xs font-bold uppercase tracking-wider text-sky-200 mb-1">
          Layman&apos;s directive
        </div>
        <p className="text-base text-foreground leading-relaxed">
          {layman ||
            "In plain English: Execute arms this idea’s full plan — wait or open, watch your levels, add only on a planned pullback, and close at stop, target, or time."}
        </p>
      </div>

      {(onExecute || onLive) && (
        <div className="flex flex-wrap gap-2 pt-2">
          {onExecute && (
            <button
              type="button"
              disabled={busy}
              onClick={onExecute}
              className="inline-flex items-center gap-2 rounded-md border border-accent/50 bg-accent/15 text-accent px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {busy
                ? "Working…"
                : schedule?.trigger
                  ? "Execute (wait for trigger)"
                  : "Execute agent"}
            </button>
          )}
          {onLive && (
            <button
              type="button"
              disabled={busy || !liveEnabled}
              onClick={onLive}
              className="inline-flex items-center gap-2 rounded-md border border-red-500/50 bg-red-500/15 text-red-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
            >
              Place live (full plan)
            </button>
          )}
          {schedule?.trigger && (
            <span className="text-xs text-foreground/60 self-center">
              Wait → place → monitor → close
            </span>
          )}
        </div>
      )}
    </div>
  );
}
