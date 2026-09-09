import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Tactical Twin Stage 2 source surfaces", () => {
  it("advertises automatic tracking from exact film and highlight clips", () => {
    const film = readFileSync(new URL("../client/src/components/film/FilmBreakdown.tsx", import.meta.url), "utf8");
    const highlights = readFileSync(new URL("../client/src/components/highlights/HighlightReelTab.tsx", import.meta.url), "utf8");
    expect(film).toContain("Stage 2 · Auto Track + Cinema");
    expect(film).toContain("Build + Auto Track");
    expect(highlights).toContain("Stage 2 ready");
    expect(highlights).toContain("Build + Auto Track");
  });

  it("distinguishes uploaded Live evidence from local-only camera evidence", () => {
    const live = readFileSync(new URL("../client/src/pages/LiveViewPage.tsx", import.meta.url), "utf8");
    expect(live).toContain('selectedSession.sourceType === "upload" ? "Stage 2 tracking ready" : "Twin only · local video"');
    expect(live).toContain('selectedSession.sourceType === "upload" ? "Build + Track" : "Build Twin"');
  });

  it("renders current tracking and cinematic state in the Twin library", () => {
    const library = readFileSync(new URL("../client/src/pages/TacticalTwinLibraryPage.tsx", import.meta.url), "utf8");
    expect(library).toContain("tacticalTwinStage2.libraryStatus.useQuery");
    expect(library).toContain("Track · ready");
    expect(library).toContain("Cinema ·");
    expect(library).toContain("Stage 2 Vision Lab");
  });
});

