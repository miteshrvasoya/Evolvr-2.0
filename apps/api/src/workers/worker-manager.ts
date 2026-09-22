import { Worker, Queue } from 'bullmq';

export type WorkerFactory = () => Worker;

export class WorkerLifecycleManager {
  private worker: Worker | null = null;
  private startingPromise: Promise<Worker> | null = null;
  private idleTimeout: NodeJS.Timeout | null = null;
  
  constructor(
    public readonly name: string,
    private readonly queue: Queue,
    private readonly factory: WorkerFactory,
    private readonly timeoutMs: number = parseInt(process.env.BULLMQ_WORKER_IDLE_TIMEOUT_MS || '300000') // Default 5 mins
  ) {}

  public async ensureWorkerRunning(): Promise<Worker> {
    if (this.worker) {
      this.resetIdleTimeout();
      return this.worker;
    }

    if (this.startingPromise) {
      this.resetIdleTimeout();
      return this.startingPromise;
    }

    this.startingPromise = this.startWorker();
    try {
      this.worker = await this.startingPromise;
      return this.worker;
    } finally {
      this.startingPromise = null;
    }
  }

  private async startWorker(): Promise<Worker> {
    console.log(`[WorkerManager] Starting worker for queue: ${this.name}`);
    const worker = this.factory();

    // Reset idle timeout on activity
    const activityListener = () => this.resetIdleTimeout();
    
    worker.on('active', activityListener);
    worker.on('completed', activityListener);
    worker.on('failed', activityListener);
    
    // When the queue drains (no more wait/active jobs), start the idle timer
    worker.on('drained', () => this.startIdleTimeout());

    // Initially start the idle timer in case the queue is already empty when worker starts
    this.startIdleTimeout();
    
    return worker;
  }

  private resetIdleTimeout() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
  }

  private startIdleTimeout() {
    this.resetIdleTimeout();
    this.idleTimeout = setTimeout(async () => {
      await this.checkIdleAndStop();
    }, this.timeoutMs);
  }

  private async checkIdleAndStop() {
    if (!this.worker) return;

    try {
      // Check if there are any jobs in wait, active, delayed, or prioritized states
      const counts = await this.queue.getJobCounts('wait', 'active', 'delayed', 'prioritized');
      const total = (counts.wait || 0) + (counts.active || 0) + (counts.delayed || 0) + (counts.prioritized || 0);

      if (total === 0) {
        console.log(`[WorkerManager] Queue ${this.name} is completely idle. Stopping worker.`);
        await this.stopWorker();
      } else {
        // There are still jobs (likely delayed). Restart the idle timer.
        console.log(`[WorkerManager] Queue ${this.name} has ${total} pending/delayed jobs. Keeping worker alive.`);
        this.startIdleTimeout();
      }
    } catch (err) {
      console.error(`[WorkerManager] Error checking job counts for queue ${this.name}:`, err);
      // On error, keep worker alive and try again later
      this.startIdleTimeout();
    }
  }

  public async stopWorker() {
    if (!this.worker) return;
    const workerToClose = this.worker;
    this.worker = null;
    this.resetIdleTimeout();
    try {
      await workerToClose.close();
      console.log(`[WorkerManager] Worker stopped: ${this.name}`);
    } catch (err) {
      console.error(`[WorkerManager] Error closing worker ${this.name}:`, err);
    }
  }
}
