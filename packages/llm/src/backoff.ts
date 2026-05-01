function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isRetryableAnthropicStatus(status: number | undefined): boolean {
  return status === 429 || status === 503 || status === 529;
}

export async function withAnthropicBackoff<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; baseMs?: number },
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? 8;
  const baseMs = opts?.baseMs ?? 400;
  let delay = baseMs;
  let lastErr: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e: unknown) {
      lastErr = e;
      const status = (e as { status?: number })?.status;
      if (!isRetryableAnthropicStatus(status)) throw e;
      const jitter = Math.floor(Math.random() * 250);
      await sleep(delay + jitter);
      delay = Math.min(delay * 2, 30_000);
    }
  }
  throw lastErr;
}
