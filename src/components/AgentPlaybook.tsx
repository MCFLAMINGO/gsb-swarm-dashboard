"use client";

import { Crosshair, GitBranch, Lightbulb, Shield, Clock } from "lucide-react";

type Playbook = any;

export default function AgentPlaybook({
  playbook,
  onReview,
  onLive,
  rhBusy,
  liveEnabled,
  biasNeutral,
}: {
  playbook: Playbook | null | undefined;
  onReview?: () => void;
  onLive?: () => void;
  rhBusy?: boolean;
  liveEnabled?: boolean;
  biasNeutral?: boolean;
}) {
  if (!playbook) return null;
  const primary = playbook.primary_directive;
  const overlays = playbook.option_overlays || [];
  const angles = playbook.unconventional_angles || [];
  const asym = playbook.asymmetric_book || [];

  return (
    <section className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-5 md:p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
          <Crosshair className="h-5 w-5 text-emerald-400" /> What Robinhood Agentic will do
        </h2>
        <p className="text-base text-foreground/80">
          Exact agent instructions — not vague bias. Equity Review/Place live is wired now;
          option overlays show the intended order + due date (staged until options MCP is on).
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
          badge={primary.what_flows_to_robinhood?.executable_now ? "EXECUTABLE NOW" : "WATCH"}
          instruction={primary.agent_instruction_plain}
          will={primary.agent_will}
          method={primary.method}
          asymmetry={primary.asymmetry}
          schedule={primary.schedule}
          levels={primary.levels}
          flow={primary.what_flows_to_robinhood}
        />
      )}

      {(onReview || onLive) && (
        <div className="flex flex-wrap gap-3">
          {onReview && (
            <button
              type="button"
              disabled={rhBusy || biasNeutral}
              onClick={onReview}
              className="rounded-md border border-accent/50 bg-accent/15 text-accent px-4 py-2.5 text-base font-semibold disabled:opacity-50"
            >
              {rhBusy ? "Working…" : "Send primary to Review (Robinhood)"}
            </button>
          )}
          {onLive && (
            <button
              type="button"
              disabled={rhBusy || !liveEnabled || biasNeutral}
              onClick={onLive}
              className="rounded-md border border-red-500/50 bg-red-500/15 text-red-200 px-4 py-2.5 text-base font-semibold disabled:opacity-40"
            >
              Place live (primary equity)
            </button>
          )}
          <p className="text-sm text-foreground/70 w-full">
            These buttons send the <span className="font-semibold">primary equity</span> directive only.
            Covered calls / puts are listed below as agent scripts until options place is enabled.
          </p>
        </div>
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
        />
      )}

      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-300" /> Option overlays & asymmetric book
        </h3>
        <div className="grid md:grid-cols-1 gap-3">
          {[...overlays, ...asym.filter((a: any) => !overlays.find((o: any) => o.id === a.id))].map((o: any) => (
            <DirectiveCard
              key={o.id}
              tone="overlay"
              title={o.title}
              badge={o.what_flows_to_robinhood?.executable_now ? "EXECUTABLE" : "STAGED · OPTIONS"}
              instruction={o.agent_instruction_plain}
              will={o.agent_will}
              method={o.method}
              asymmetry={o.asymmetry}
              schedule={o.schedule}
              levels={o.levels}
              flow={o.what_flows_to_robinhood}
              requires={o.requires}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-accent" /> Unconventional angles
        </h3>
        <p className="text-base text-foreground/80">
          Deeper thoughts beyond “type a ticker” — cross-asset ideas others underweight.
        </p>
        <div className="space-y-3">
          {angles.map((a: any) => (
            <div key={a.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="text-base font-semibold text-foreground">{a.headline}</div>
              <p className="text-base text-foreground/90 leading-relaxed">{a.thesis}</p>
              <div className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">Method</div>
              <ul className="list-disc pl-5 space-y-1">
                {(a.method || []).map((m: string, i: number) => (
                  <li key={i} className="text-base text-foreground/85">{m}</li>
                ))}
              </ul>
              <p className="text-sm text-foreground/75">
                <span className="font-semibold">Why missed:</span> {a.why_others_miss_it}
              </p>
              {a.schedule?.due_label && (
                <p className="text-sm text-amber-200 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> {a.schedule.due_label}
                </p>
              )}
              <p className="text-sm mono text-emerald-200/90 border border-emerald-500/30 bg-emerald-500/10 rounded px-3 py-2">
                {a.agent_instruction_plain}
              </p>
              {(a.instruments || []).length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {a.instruments.map((ins: any, i: number) => (
                    <span key={i} className="text-xs rounded border border-border bg-secondary px-2 py-1">
                      {ins.symbol} · {ins.role}
                    </span>
                  ))}
                </div>
              )}
            </div>
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
            {schedule.due_label || schedule.due_friday || schedule.expiration
              ? `Due ${schedule.due_label || schedule.due_friday || schedule.expiration}`
              : "See schedule"}
          </span>
          {schedule.dte_approx != null && <span>~{schedule.dte_approx} DTE</span>}
          {schedule.open_window_end && <span>Open window → {schedule.open_window_end}</span>}
          {schedule.trigger && <span>Trigger: {schedule.trigger}</span>}
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
      {flow?.tool_sequence && (
        <p className="text-xs text-foreground/65">
          MCP flow: {flow.tool_sequence.join(" → ")}
          {flow.executable_when ? ` · ${flow.executable_when}` : ""}
        </p>
      )}
    </div>
  );
}
