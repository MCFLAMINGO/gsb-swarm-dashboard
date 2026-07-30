/**
 * AI / infrastructure macro watchlist — hunt the cycle top before the crash.
 * Buckets: hyperscalers, AI apps, neocloud/GPU, memory, networking, energy, picks & shovels.
 */

export type WatchBucket =
  | "hyperscaler"
  | "ai_software"
  | "neocloud_gpu"
  | "memory"
  | "networking"
  | "energy_power"
  | "picks_shovels"
  | "china_ai"
  | "crypto_ai_proxy";

export type WatchTicker = {
  symbol: string;
  name: string;
  bucket: WatchBucket;
  why: string;
  /** Higher = more useful for spotting AI cycle top / reversal */
  reverseSignal: 1 | 2 | 3;
};

export const AI_MACRO_WATCHLIST: WatchTicker[] = [
  // Hyperscalers / platforms
  { symbol: "NVDA", name: "NVIDIA", bucket: "hyperscaler", why: "Cycle bellwether — GPU ASP, data-center mix, guidance tone", reverseSignal: 3 },
  { symbol: "MSFT", name: "Microsoft", bucket: "hyperscaler", why: "Azure AI attach; CapEx vs Azure growth divergence = top tell", reverseSignal: 3 },
  { symbol: "GOOGL", name: "Alphabet", bucket: "hyperscaler", why: "GCP + TPU path; ad vs cloud mix", reverseSignal: 2 },
  { symbol: "AMZN", name: "Amazon", bucket: "hyperscaler", why: "AWS AI spend; Trainium vs NVIDIA mix", reverseSignal: 2 },
  { symbol: "META", name: "Meta", bucket: "hyperscaler", why: "Infra CapEx intensity; open-source model spillover", reverseSignal: 2 },
  { symbol: "AVGO", name: "Broadcom", bucket: "hyperscaler", why: "Custom ASIC / networking for hyperscalers", reverseSignal: 3 },
  { symbol: "TSM", name: "TSMC", bucket: "picks_shovels", why: "Leading-edge wafer demand — CoWoS / advanced packaging bottleneck", reverseSignal: 3 },
  { symbol: "ASML", name: "ASML", bucket: "picks_shovels", why: "EUV tool orders lead foundry capacity 12–18m", reverseSignal: 2 },

  // AI software / apps
  { symbol: "PLTR", name: "Palantir", bucket: "ai_software", why: "AIP deal velocity; multiple compresses first in risk-off", reverseSignal: 3 },
  { symbol: "SNOW", name: "Snowflake", bucket: "ai_software", why: "Data gravity for AI workloads", reverseSignal: 2 },
  { symbol: "CRWD", name: "CrowdStrike", bucket: "ai_software", why: "Security spend stays late-cycle; break = broader cut", reverseSignal: 2 },
  { symbol: "DDOG", name: "Datadog", bucket: "ai_software", why: "Observability of AI infra burn", reverseSignal: 2 },
  { symbol: "NET", name: "Cloudflare", bucket: "ai_software", why: "Edge inference / Workers AI", reverseSignal: 1 },
  { symbol: "NOW", name: "ServiceNow", bucket: "ai_software", why: "Enterprise AI attach rates", reverseSignal: 1 },
  { symbol: "CRM", name: "Salesforce", bucket: "ai_software", why: "Agentforce monetization vs hype", reverseSignal: 1 },
  { symbol: "ORCL", name: "Oracle", bucket: "ai_software", why: "Cloud CapEx + Stargate-style capacity deals", reverseSignal: 2 },

  // Neocloud / GPU rental / alternative cloud
  { symbol: "NBIS", name: "Nebius", bucket: "neocloud_gpu", why: "Pure-play GPU cloud — high beta to AI CapEx cycle", reverseSignal: 3 },
  { symbol: "CRWV", name: "CoreWeave", bucket: "neocloud_gpu", why: "GPU rental concentration risk; debt + utilization", reverseSignal: 3 },
  { symbol: "IREN", name: "Iris Energy", bucket: "neocloud_gpu", why: "Bitcoin miner → AI HPC pivot; power + GPU utilization", reverseSignal: 2 },
  { symbol: "CIFR", name: "Cipher Mining", bucket: "neocloud_gpu", why: "Miner-to-AI conversion narrative", reverseSignal: 2 },
  { symbol: "APLD", name: "Applied Digital", bucket: "neocloud_gpu", why: "HPC data-center buildout", reverseSignal: 2 },
  { symbol: "VRT", name: "Vertiv", bucket: "picks_shovels", why: "Cooling / power for AI racks — boots & shovels", reverseSignal: 3 },
  { symbol: "DELL", name: "Dell", bucket: "picks_shovels", why: "AI server shipments lag GPU orders", reverseSignal: 2 },
  { symbol: "SMCI", name: "Super Micro", bucket: "picks_shovels", why: "High-beta AI server assembler — early fade on cycle turn", reverseSignal: 3 },

  // Memory (HBM / DRAM / NAND)
  { symbol: "MU", name: "Micron", bucket: "memory", why: "HBM / DRAM pricing — classic cycle top indicator", reverseSignal: 3 },
  { symbol: "SNDK", name: "Sandisk", bucket: "memory", why: "NAND / storage for AI data lakes", reverseSignal: 2 },
  { symbol: "WDC", name: "Western Digital", bucket: "memory", why: "HDD/NAND AI storage mix", reverseSignal: 1 },
  { symbol: "AMD", name: "AMD", bucket: "hyperscaler", why: "MI300/MI350 share vs NVDA — challenger signal", reverseSignal: 2 },
  { symbol: "INTC", name: "Intel", bucket: "picks_shovels", why: "Foundry + Gaudi; CapEx credibility", reverseSignal: 1 },

  // Networking
  { symbol: "ANET", name: "Arista", bucket: "networking", why: "AI cluster Ethernet — CapEx lagging indicator", reverseSignal: 3 },
  { symbol: "CSCO", name: "Cisco", bucket: "networking", why: "Enterprise + AI networking mix", reverseSignal: 1 },
  { symbol: "MRVL", name: "Marvell", bucket: "networking", why: "Custom / DSP / optics for AI fabrics", reverseSignal: 2 },
  { symbol: "COHR", name: "Coherent", bucket: "networking", why: "Optical for AI interconnect", reverseSignal: 2 },
  { symbol: "LITE", name: "Lumentum", bucket: "networking", why: "Optical components", reverseSignal: 1 },

  // Energy / power related to AI
  { symbol: "VST", name: "Vistra", bucket: "energy_power", why: "Power for data centers — late-cycle AI power scarcity trade", reverseSignal: 3 },
  { symbol: "CEG", name: "Constellation Energy", bucket: "energy_power", why: "Nuclear / AI power PPAs", reverseSignal: 3 },
  { symbol: "TLN", name: "Talen Energy", bucket: "energy_power", why: "Behind-the-meter data-center power", reverseSignal: 2 },
  { symbol: "GEV", name: "GE Vernova", bucket: "energy_power", why: "Turbines / grid for AI load growth", reverseSignal: 2 },
  { symbol: "ETN", name: "Eaton", bucket: "energy_power", why: "Electrical infrastructure for AI campuses", reverseSignal: 2 },
  { symbol: "PWR", name: "Quanta Services", bucket: "energy_power", why: "Grid / transmission build for AI load", reverseSignal: 2 },
  { symbol: "CCJ", name: "Cameco", bucket: "energy_power", why: "Uranium — nuclear renaissance for AI power", reverseSignal: 2 },
  { symbol: "OKLO", name: "Oklo", bucket: "energy_power", why: "SMR narrative — high-beta AI power optionality", reverseSignal: 1 },

  // Semicap / equipment (boots & shovels)
  { symbol: "AMAT", name: "Applied Materials", bucket: "picks_shovels", why: "Wafer fab equipment — orders lead memory/logic", reverseSignal: 2 },
  { symbol: "LRCX", name: "Lam Research", bucket: "picks_shovels", why: "Etch / deposition for advanced nodes", reverseSignal: 2 },
  { symbol: "KLAC", name: "KLA", bucket: "picks_shovels", why: "Process control — foundry CapEx proxy", reverseSignal: 2 },
  { symbol: "ARM", name: "Arm", bucket: "hyperscaler", why: "CPU/NPU royalty — AI device + cloud", reverseSignal: 1 },

  // China AI / semis (reversal often shows here first on export / demand)
  { symbol: "BABA", name: "Alibaba", bucket: "china_ai", why: "China cloud AI CapEx", reverseSignal: 2 },
  { symbol: "BIDU", name: "Baidu", bucket: "china_ai", why: "China LLM / cloud AI", reverseSignal: 1 },
  { symbol: "PDD", name: "PDD", bucket: "china_ai", why: "Risk appetite proxy for China growth", reverseSignal: 1 },

  // Crypto / AI power proxies
  { symbol: "MSTR", name: "MicroStrategy", bucket: "crypto_ai_proxy", why: "Liquidity / risk appetite; correlates with speculative AI legs", reverseSignal: 2 },
  { symbol: "COIN", name: "Coinbase", bucket: "crypto_ai_proxy", why: "Spec risk-on — often leads AI beta unwind", reverseSignal: 2 },
];

export const BUCKET_LABELS: Record<WatchBucket, string> = {
  hyperscaler: "Hyperscalers & platforms",
  ai_software: "AI software / apps",
  neocloud_gpu: "Neocloud / GPU rental",
  memory: "Memory (HBM / DRAM / NAND)",
  networking: "Networking & optics",
  energy_power: "Energy & power for AI",
  picks_shovels: "Picks & shovels (servers / semicap)",
  china_ai: "China AI / cloud",
  crypto_ai_proxy: "Risk proxies (crypto)",
};

export function watchlistByBucket() {
  const map = new Map<WatchBucket, WatchTicker[]>();
  for (const t of AI_MACRO_WATCHLIST) {
    const arr = map.get(t.bucket) || [];
    arr.push(t);
    map.set(t.bucket, arr);
  }
  return map;
}

/** Highest reverseSignal first — start here for top-hunting */
export function priorityReversalWatch() {
  return [...AI_MACRO_WATCHLIST]
    .filter((t) => t.reverseSignal >= 2)
    .sort((a, b) => b.reverseSignal - a.reverseSignal || a.symbol.localeCompare(b.symbol));
}
