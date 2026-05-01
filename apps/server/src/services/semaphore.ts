export class Semaphore {
  private readonly max: number;
  private current = 0;
  private readonly queue: Array<() => void> = [];

  constructor(max: number) {
    if (max <= 0) throw new Error("Semaphore max must be > 0");
    this.max = max;
  }

  async acquire(): Promise<() => void> {
    if (this.current < this.max) {
      this.current++;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.current++;
    return () => this.release();
  }

  private release() {
    this.current--;
    const next = this.queue.shift();
    if (next) next();
  }
}

