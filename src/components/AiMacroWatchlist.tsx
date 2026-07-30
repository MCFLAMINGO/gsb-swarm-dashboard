"use client";

import {
  AI_MACRO_WATCHLIST,
  BUCKET_LABELS,
  priorityReversalWatch,
  watchlistByBucket,
  type WatchBucket,
} from "@/lib/aiMacroWatchlist";

export default function AiMacroWatchlist({
  onPick,
}: {
  onPick: (symbol: string) => void;
}) {
  const byBucket = watchlistByBucket();
  const priority = priorityReversalWatch().slice(0, 16);
  const order: WatchBucket[] = [
    "hyperscaler",
    "neocloud_gpu",
    "memory",
    "networking",
    "energy_power",
    "picks_shovels",
    "ai_software",
    "china_ai",
    "crypto_ai_proxy",
  ];

  return (
    <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">AI cycle top hunt</h2>
        <p className="text-sm text-foreground/80 max-w-3xl">
          Macro goal: watch the whole AI stack — hyperscalers, Nebius-class neocloud, memory, networking,
          energy, and picks &amp; shovels — to catch the reversal before the crash. Click a ticker to research.
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-200/90">
          Priority reversal tells ({priority.length} of {AI_MACRO_WATCHLIST.length})
        </div>
        <div className="flex flex-wrap gap-1.5">
          {priority.map((t) => (
            <button
              key={t.symbol}
              type="button"
              onClick={() => onPick(t.symbol)}
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-sm font-semibold hover:bg-amber-500/20"
              title={t.why}
            >
              {t.symbol}
              <span className="text-foreground/50 font-normal"> · {t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {order.map((bucket) => {
          const rows = byBucket.get(bucket) || [];
          if (!rows.length) return null;
          return (
            <div key={bucket} className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-foreground/55">
                {BUCKET_LABELS[bucket]}
              </div>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {rows.map((t) => (
                  <button
                    key={t.symbol}
                    type="button"
                    onClick={() => onPick(t.symbol)}
                    className="text-left rounded border border-border/50 bg-background/40 px-2.5 py-2 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-foreground">{t.symbol}</span>
                      <span className="text-[10px] text-foreground/50">
                        {"▲".repeat(t.reverseSignal)}
                      </span>
                    </div>
                    <div className="text-xs text-foreground/70">{t.name}</div>
                    <div className="text-xs text-foreground/60 mt-0.5 leading-snug">{t.why}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
