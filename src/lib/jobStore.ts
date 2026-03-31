/**
 * In-memory job store for MVP.
 * Resets on cold start — fine for Vercel serverless.
 */

export interface Job {
  jobId: string;
  agentId: string;
  mission: string;
  status: "accepted" | "running" | "completed" | "failed";
  result?: string;
  usdcEarned?: number;
  createdAt: string;
  completedAt?: string;
}

const jobs = new Map<string, Job>();

export function createJob(jobId: string, agentId: string, mission: string): Job {
  const job: Job = {
    jobId,
    agentId,
    mission,
    status: "accepted",
    createdAt: new Date().toISOString(),
  };
  jobs.set(jobId, job);
  return job;
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

export function completeJob(jobId: string, result: string, usdcEarned: number): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = "completed";
    job.result = result;
    job.usdcEarned = usdcEarned;
    job.completedAt = new Date().toISOString();
  }
}

export function failJob(jobId: string, error: string): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = "failed";
    job.result = error;
    job.completedAt = new Date().toISOString();
  }
}

/** Last N jobs, newest first */
export function recentJobs(n: number): Job[] {
  return Array.from(jobs.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, n);
}
