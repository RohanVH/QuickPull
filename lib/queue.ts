import { DownloadJob } from "@/lib/types";

const MAX_CONCURRENCY = 2;

class JobQueue {
  private queue: DownloadJob[] = [];
  private active = 0;
  private jobs = new Map<string, DownloadJob>();

  enqueue(job: DownloadJob, worker: (job: DownloadJob) => Promise<DownloadJob>) {
    this.jobs.set(job.id, job);
    this.queue.push(job);
    void this.drain(worker);
    return job;
  }

  get(id: string) {
    return this.jobs.get(id) ?? null;
  }

  private async drain(worker: (job: DownloadJob) => Promise<DownloadJob>) {
    if (this.active >= MAX_CONCURRENCY) return;
    const next = this.queue.shift();
    if (!next) return;

    this.active += 1;
    this.jobs.set(next.id, { ...next, status: "processing" });

    try {
      const completed = await worker({ ...next, status: "processing" });
      this.jobs.set(completed.id, completed);
    } catch (error) {
      this.jobs.set(next.id, {
        ...next,
        status: "failed",
        error: error instanceof Error ? error.message : "Queue job failed."
      });
    } finally {
      this.active -= 1;
      void this.drain(worker);
    }
  }
}

export const downloadQueue = new JobQueue();
