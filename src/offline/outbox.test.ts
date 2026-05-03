import { describe, expect, it } from "vitest";
import { parsePendingTransactionIdentity } from "./outbox";

describe("parsePendingTransactionIdentity", () => {
  it("parses pending uuid without index as bodyIndex 0", () => {
    const k = "550e8400-e29b-41d4-a716-446655440000";
    expect(parsePendingTransactionIdentity(`pending:${k}`)).toEqual({
      idempotencyKey: k,
      bodyIndex: 0,
    });
  });

  it("parses pending with numeric suffix as index", () => {
    const k = "550e8400-e29b-41d4-a716-446655440000";
    expect(parsePendingTransactionIdentity(`pending:${k}:1`)).toEqual({
      idempotencyKey: k,
      bodyIndex: 1,
    });
  });

  it("returns null for server ids", () => {
    expect(parsePendingTransactionIdentity("2025-01-01-abc")).toBeNull();
  });
});
