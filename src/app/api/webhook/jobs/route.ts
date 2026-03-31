import { NextResponse } from "next/server";
import { recentJobs } from "@/lib/jobStore";

/**
 * GET /api/webhook/jobs — returns last 50 jobs from the dispatch system
 */
export async function GET() {
  const jobs = recentJobs(50);
  return NextResponse.json({ jobs, count: jobs.length });
}
