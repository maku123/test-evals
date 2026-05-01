import { describe, expect, test } from "bun:test";
import { sha256Hex } from "../src/prompt-hash";

describe("sha256Hex", () => {
  test("stable for same inputs, changes with one char", () => {
    const a = sha256Hex(["hello", "world"]);
    const b = sha256Hex(["hello", "world"]);
    const c = sha256Hex(["hello", "world!"]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

