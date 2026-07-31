"use client";

import { Scale, Crosshair } from "lucide-react";

type Book = any;

export default function CeoTradeBook({ book }: { book: Book | null | undefined }) {
  if (!book) return null;
  const k = book.kelly || {};
  const action = book.action || "WAIT";
  const actionTone =
    action === "BUY"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
      : action === "HEDGE_ONLY"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
        : "border-border bg-secondary/40 text-foreground/80";

  return (
    <section className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-5 md:p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
          <Scale className="h-5 w-5 text-sky-300" /> CEO Lead Trader · Kelly size
        </h2>
        <p className="text-base text-foreground/80">
          Edge over odds. Primary equity size comes from fractional Kelly — not a fixed dollar habit.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className={`text-sm font-bold uppercase tracking-wider px-3 py-1.5 rounded border ${actionTone}`}>
          {action}
        </span>
        <span className="text-sm text-foreground/70">
          {book.symbol} · {book.bias} · {book.horizon || "week"}
        </span>
        {book.autonomy?.auto_place_enabled ? (
          <span className="text-xs font-semibold text-red-200 border border-red-500/40 bg-red-500/10 px-2 py-1 rounded">
            AUTO-TRADE ENV ON
          </span>
        ) : (
          <span className="text-xs font-semibold text-foreground/60 border border-border bg-secondary px-2 py-1 rounded">
            Auto-place off
          </span>
        )}
      </div>

      <p className="text-base mono text-foreground border border-border bg-background/50 rounded px-3 py-2 leading-relaxed">
        {book.agent_instruction_plain}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <Stat label="Kelly stake" value={k.notional_usd != null ? `$${k.notional_usd}` : "—"} />
        <Stat label="f* full" value={k.f_full != null ? String(k.f_full) : "—"} />
        <Stat label={`${Math.round((k.fraction_of_kelly || 0.25) * 100)}% Kelly f`} value={k.f_used != null ? String(k.f_used) : "—"} />
        <Stat label="Bankroll" value={k.bankroll_usd != null ? `$${k.bankroll_usd}` : "—"} />
        <Stat label="p̂ (taxed)" value={k.p_adjusted != null ? String(k.p_adjusted) : "—"} />
        <Stat label="Odds b (R:R)" value={k.b != null ? String(k.b) : "—"} />
        <Stat label="Optimism tax" value={k.optimism_tax != null ? `−${k.optimism_tax}` : "—"} />
        <Stat label="Overbet line" value={k.overbet_line_f != null ? `f>${k.overbet_line_f}` : "—"} />
      </div>

      {(k.capped_by || []).length > 0 && (
        <p className="text-sm text-foreground/70">
          Capped by: {(k.capped_by as string[]).join(", ")}
        </p>
      )}

      {(book.edge?.signal_notes || []).length > 0 && (
        <p className="text-sm text-foreground/75 flex items-start gap-1.5">
          <Crosshair className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Agent blend: {(book.edge.signal_notes as string[]).join(" · ")}
        </p>
      )}

      <ol className="list-decimal pl-5 text-sm text-foreground/70 space-y-1">
        {(book.how_to_read || []).map((line: string, i: number) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/60 bg-secondary/40 px-2 py-1.5">
      <div className="text-foreground/60 text-xs uppercase">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  );
}
