import { describe, expect, it } from "vitest";
import {
  getCompletedWindowIndex,
  selectFramesForWindow,
  shouldContinueAfterWindowFailure,
  transitionLiveRunState,
} from "../client/src/lib/liveWindow";

describe("Live View browser window scheduler", () => {
  it("transitions start, pause, resume, and stop deterministically", () => {
    expect(transitionLiveRunState("idle", "start")).toBe("running");
    expect(transitionLiveRunState("running", "pause")).toBe("paused");
    expect(transitionLiveRunState("paused", "start")).toBe("running");
    expect(transitionLiveRunState("running", "end")).toBe("complete");
    expect(transitionLiveRunState("complete", "start")).toBe("complete");
  });

  it("dispatches exactly one completed 15-second window boundary", () => {
    expect(getCompletedWindowIndex(14.99)).toBe(-1);
    expect(getCompletedWindowIndex(15)).toBe(0);
    expect(getCompletedWindowIndex(29.99)).toBe(0);
    expect(getCompletedWindowIndex(30)).toBe(1);
  });

  it("selects only chronological evidence inside the completed window", () => {
    const selected = selectFramesForWindow([
      { second: 2, dataUrl: "frame-0" },
      { second: 15, dataUrl: "frame-1" },
      { second: 18, dataUrl: "frame-2" },
      { second: 24, dataUrl: "frame-3" },
      { second: 31, dataUrl: "frame-4" },
    ], 1);
    expect(selected).toEqual(["frame-1", "frame-2", "frame-3", "frame-4"]);
  });

  it("continues after a failed window only while the coach remains live", () => {
    expect(shouldContinueAfterWindowFailure("running")).toBe(true);
    expect(shouldContinueAfterWindowFailure("paused")).toBe(false);
    expect(shouldContinueAfterWindowFailure("complete")).toBe(false);
  });
});
