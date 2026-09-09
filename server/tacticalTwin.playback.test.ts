import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const twinPageSource = readFileSync(
  new URL("../client/src/pages/TacticalTwinPage.tsx", import.meta.url),
  "utf8",
);
const visualizerSource = readFileSync(
  new URL("../client/src/components/play3d/Play3DVisualizer.tsx", import.meta.url),
  "utf8",
);

describe("Tactical Twin synchronized playback regression", () => {
  it("derives child scrub display from external progress without per-frame child state updates", () => {
    const syncStart = visualizerSource.indexOf("externalProgressRef.current = externalProgress");
    const syncEnd = visualizerSource.indexOf("const displayedScrub", syncStart);
    const syncEffect = visualizerSource.slice(syncStart, syncEnd);

    expect(syncStart).toBeGreaterThan(-1);
    expect(syncEnd).toBeGreaterThan(syncStart);
    expect(syncEffect).not.toContain("setScrub(");
    expect(visualizerSource).toContain("const displayedScrub = externalProgress === undefined");
    expect(visualizerSource).toContain("progressRef.current = normalized");
  });

  it("keeps 3D scene inputs stable and leaves the parent as the only synchronized timeline owner", () => {
    expect(twinPageSource).toContain("const threePlayers = useMemo");
    expect(twinPageSource).toContain("const threeAnnotations = useMemo");
    expect(twinPageSource).toContain("externalProgress={progress} hideTransport");
    expect(twinPageSource).not.toContain("externalProgress={progress} onProgressChange={setProgress}");
  });
});
