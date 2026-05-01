import { describe, expect, test } from "bun:test";
import { withAnthropicBackoff } from "../src/backoff";

describe("withAnthropicBackoff", () => {
  test("retries on 429 then succeeds", async () => {
    let calls = 0;
    const res = await withAnthropicBackoff(
      async () => {
        calls++;
        if (calls < 3) {
          const err: any = new Error("rate limit");
          err.status = 429;
          throw err;
        }
        return "ok";
      },
      { baseMs: 1, maxRetries: 5 },
    );

    expect(res).toBe("ok");
    expect(calls).toBe(3);
  });
});

