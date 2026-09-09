import { describe, expect, it } from "vitest";

describe("Manus connector bridge credential", () => {
  it("authenticates against the lightweight connector catalog endpoint", async () => {
    const apiKey = process.env.MANUS_API_KEY;
    expect(apiKey, "MANUS_API_KEY must be present on the server").toBeTruthy();

    const response = await fetch("https://api.manus.ai/v2/connector.list", {
      headers: { "x-manus-api-key": apiKey! },
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.json().catch(() => null) as { ok?: boolean; error?: { code?: string } } | null;

    expect(response.status, `Manus credential rejected with ${body?.error?.code ?? "unknown error"}`).toBe(200);
    expect(body?.ok).toBe(true);
  }, 25_000);
});
