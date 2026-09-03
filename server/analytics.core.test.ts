import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("./db", () => ({ saveAdvancedAnalyticsRun: vi.fn() }));

import { invokeLLM } from "./_core/llm";
import { ADVANCED_ANALYTICS_MODULES, runGuardedAnalytics } from "./analyticsCore";

describe("advanced analytics evidence guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registers exactly fifteen unique analytics modules", () => {
    expect(new Set(ADVANCED_ANALYTICS_MODULES).size).toBe(15);
  });

  it.each(ADVANCED_ANALYTICS_MODULES)("returns insufficient rather than inventing %s data without evidence", async (module) => {
    const result = await runGuardedAnalytics({ module, report: {}, instructions: "Analyze only supported facts." });
    expect(result._quality.status).toBe("insufficient");
    expect(result._quality.confidence).toBe(0);
    expect(result._quality.evidence).toEqual([]);
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("parses a strict evidence envelope and nested analysis payload", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{
        message: {
          role: "assistant",
          content: JSON.stringify({
            status: "ready",
            summary: "Two evidence-linked formations were observed.",
            confidence: 78,
            evidence: [{ highlightIndex: 0, startSeconds: 12, endSeconds: 20, description: "Shotgun alignment" }],
            missingInputs: [],
            limitations: ["Report-derived estimate"],
            analysisJson: JSON.stringify({ formations: [{ formation: "Shotgun", observedCount: 1 }] }),
          }),
        },
        index: 0,
        finish_reason: "stop",
      }],
    } as any);
    const result = await runGuardedAnalytics({ module: "formations", report: { highlights: [{ startSeconds: 12, endSeconds: 20 }] }, instructions: "Analyze formations." });
    expect(result._quality.status).toBe("ready");
    expect(result._quality.confidence).toBe(78);
    expect(result._quality.evidence[0]?.startSeconds).toBe(12);
    expect(result.formations).toEqual([{ formation: "Shotgun", observedCount: 1 }]);
  });

  it("fails loudly on malformed model output instead of substituting fictional metrics", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { role: "assistant", content: "not json" }, index: 0, finish_reason: "stop" }] } as any);
    await expect(runGuardedAnalytics({ module: "turnovers", report: { highlights: [{}] }, instructions: "Analyze risk." })).rejects.toThrow();
  });

  it("keeps legacy hard-coded fallback statistics out of both analytics routers", async () => {
    const files = await Promise.all(["analyticsRouter.ts", "analyticsRouter2.ts"].map((file) => fs.readFile(new URL(file, import.meta.url), "utf8")));
    const source = files.join("\n");
    expect(source).not.toContain("Shotgun: 45");
    expect(source).not.toContain("avgInterceptionRisk: 30");
    expect(source).not.toContain("Similar to 2023 Week 5 comeback");
    expect(source).not.toContain("Our QB #7");
  });
});
