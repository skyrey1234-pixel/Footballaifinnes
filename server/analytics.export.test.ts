import { describe, expect, it } from "vitest";
import { extractNumericMetrics } from "../client/src/lib/analyticsExport";

describe("advanced analytics export metrics", () => {
  it("extracts only finite numerical values for module charts", () => {
    const rows = extractNumericMetrics({ rate: 52, nested: { count: 4, label: "run" }, missing: null, invalid: "unknown" });
    expect(rows).toEqual([
      { label: "rate", value: 52 },
      { label: "nested › count", value: 4 },
    ]);
  });
});
