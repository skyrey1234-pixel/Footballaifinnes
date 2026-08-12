import { describe, expect, it } from "vitest";
import { parseDurationSeconds } from "./videoAnalysis";

describe("video duration parsing", () => {
  it("accepts valid ffprobe duration output", () => {
    expect(parseDurationSeconds("1684.372000\n")).toBeCloseTo(1684.372);
  });

  it("rejects empty, zero, and malformed duration output", () => {
    expect(parseDurationSeconds("")).toBeNull();
    expect(parseDurationSeconds("0")).toBeNull();
    expect(parseDurationSeconds("N/A")).toBeNull();
  });
});
