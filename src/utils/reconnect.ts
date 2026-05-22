import { getDelay } from './backoff.js';

interface ReconnectOptions {
  maxAttempts: number;
  baseInterval: number;
  maxInterval: number;
  onReconnect: (attempt: number) => void;
  onFailed: () => void;
}

export class ReconnectManager {
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;

  constructor(private options: ReconnectOptions) {}

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.schedule();
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.attempt = 0;
  }

  private schedule() {
    if (!this.isRunning) return;

    if (this.attempt >= this.options.maxAttempts) {
      this.isRunning = false;
      this.options.onFailed();
      return;
    }

    const delay = getDelay(
      this.attempt,
      this.options.baseInterval,
      this.options.maxInterval
    );

    this.timer = setTimeout(() => {
      this.options.onReconnect(this.attempt);
      this.attempt++;
      this.schedule();
    }, delay);
  }

  get currentAttempt() {
    return this.attempt;
  }
}
