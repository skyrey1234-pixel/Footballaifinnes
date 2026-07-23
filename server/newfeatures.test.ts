import { afterAll, describe, expect, it } from "vitest";
import * as db from "./db";

// Use a sessionId far outside real data range to avoid collisions
const TEST_SESSION_ID = 999999;

afterAll(async () => {
  // Clean up any leftover test rows
  await db.deleteMistakeAnalysisBySession(TEST_SESSION_ID).catch(() => {});
  await db.deleteHighlightReelBySession(TEST_SESSION_ID).catch(() => {});
});

describe("mistakeAnalysis db helpers", () => {
  it("saves and fetches a mistake analysis (plays stored as JSON)", async () => {
    const plays = [
      {
        title: "Blown coverage on double move",
        quarter: "Q1",
        whatHappened: "CB bit on the out-and-up",
        whatWentWrong: "No safety help over the top",
        correctExecution: "Stay on top of the route with inside leverage",
        severity: "high",
      },
    ];
    await db.saveMistakeAnalysis(TEST_SESSION_ID, plays);
    const stored = await db.getMistakeAnalysisBySession(TEST_SESSION_ID);
    expect(stored).toBeTruthy();
    expect(stored!.sessionId).toBe(TEST_SESSION_ID);
    const storedPlays = stored!.plays as typeof plays;
    expect(Array.isArray(storedPlays)).toBe(true);
    expect(storedPlays[0].title).toBe("Blown coverage on double move");
    expect(storedPlays[0].severity).toBe("high");
  });

  it("re-saving replaces the previous analysis (upsert behavior)", async () => {
    const updated = [{ title: "Missed block on edge", severity: "medium" }];
    await db.saveMistakeAnalysis(TEST_SESSION_ID, updated);
    const stored = await db.getMistakeAnalysisBySession(TEST_SESSION_ID);
    const storedPlays = stored!.plays as typeof updated;
    expect(storedPlays).toHaveLength(1);
    expect(storedPlays[0].title).toBe("Missed block on edge");
  });

  it("delete helper removes the analysis", async () => {
    await db.deleteMistakeAnalysisBySession(TEST_SESSION_ID);
    const gone = await db.getMistakeAnalysisBySession(TEST_SESSION_ID);
    expect(gone).toBeNull();
  });
});

describe("highlightReel db helpers", () => {
  it("saves and fetches a highlight reel (clips stored as JSON)", async () => {
    const clips = [
      {
        rank: 1,
        title: "75-yard TD run",
        timestamp: "12:34",
        impactScore: 95,
        category: "big-play",
        description: "RB breaks three tackles down the sideline",
      },
      {
        rank: 2,
        title: "Pick six",
        timestamp: "24:10",
        impactScore: 92,
        category: "turnover",
        description: "LB jumps the slant route",
      },
    ];
    await db.saveHighlightReel(TEST_SESSION_ID, clips);
    const stored = await db.getHighlightReelBySession(TEST_SESSION_ID);
    expect(stored).toBeTruthy();
    expect(stored!.sessionId).toBe(TEST_SESSION_ID);
    const storedClips = stored!.clips as typeof clips;
    expect(storedClips).toHaveLength(2);
    expect(storedClips[0].impactScore).toBe(95);
    expect(storedClips[1].category).toBe("turnover");
  });

  it("re-saving replaces the previous reel (upsert behavior)", async () => {
    const updated = [{ rank: 1, title: "Goal-line stand", impactScore: 88 }];
    await db.saveHighlightReel(TEST_SESSION_ID, updated);
    const stored = await db.getHighlightReelBySession(TEST_SESSION_ID);
    const storedClips = stored!.clips as typeof updated;
    expect(storedClips).toHaveLength(1);
    expect(storedClips[0].title).toBe("Goal-line stand");
  });

  it("delete helper removes the reel", async () => {
    await db.deleteHighlightReelBySession(TEST_SESSION_ID);
    const gone = await db.getHighlightReelBySession(TEST_SESSION_ID);
    expect(gone).toBeNull();
  });
});
