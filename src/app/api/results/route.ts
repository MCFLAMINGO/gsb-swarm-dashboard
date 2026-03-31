import { NextResponse } from "next/server";
import { recentJobs } from "@/lib/jobStore";

export async function GET() {
  const all = recentJobs(100);
  const done = all.filter((j) => j.status === "completed" || j.status === "failed");
  const totalUsdcEarned = done.reduce((sum, j) => sum + (j.usdcEarned ?? 0), 0);

  return NextResponse.json({
    count: done.length,
    jobs: done.slice(0, 50),
    totalUsdcEarned: Math.round(totalUsdcEarned * 10000) / 10000,
    generatedAt: new Date().toISOString(),
  });
}
