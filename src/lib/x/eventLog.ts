/** In-memory recent X Activity events (serverless-local) */

export type RecentXEvent = {
  at: string;
  type: string;
  status: string;
  detail?: string;
};

const recent: RecentXEvent[] = [];
const MAX_RECENT = 100;

export function getRecentXEvents(n = 50): RecentXEvent[] {
  return recent.slice(-n).reverse();
}

export function pushRecentXEvent(entry: RecentXEvent) {
  recent.push(entry);
  if (recent.length > MAX_RECENT) recent.splice(0, recent.length - MAX_RECENT);
}
