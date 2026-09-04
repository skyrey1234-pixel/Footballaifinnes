import {
  enqueueLatestWindow,
  getCompletedWindowIndex,
  getLiveLaunchIssue,
  getLiveVideoSource,
  LIVE_WINDOW_SECONDS,
  selectFramesForWindow,
  shouldContinueAfterWindowFailure,
  shouldDeferLiveStart,
  shouldRenderLiveVideo,
  transitionLiveRunState,
} from "../client/src/lib/liveWindow";
import { describe, expect, it } from "vitest";

describe("Live View browser window scheduler", () => {
  it("uses one shared five-second cadence", () => {
    expect(LIVE_WINDOW_SECONDS).toBe(5);
    expect(getCompletedWindowIndex(4.99)).toBe(-1);
    expect(getCompletedWindowIndex(5)).toBe(0);
    expect(getCompletedWindowIndex(9.99)).toBe(0);
    expect(getCompletedWindowIndex(10)).toBe(1);
  });

  it("selects only chronological evidence inside the completed five-second window", () => {
    const selected = selectFramesForWindow([
      { second: 1, dataUrl: "frame-0" },
      { second: 5, dataUrl: "frame-1" },
      { second: 6.2, dataUrl: "frame-2" },
      { second: 8.7, dataUrl: "frame-3" },
      { second: 10.2, dataUrl: "frame-4" },
      { second: 14, dataUrl: "frame-5" },
    ], 1);
    expect(selected).toEqual(["frame-1", "frame-2", "frame-3", "frame-4"]);
  });

  it("transitions start, pause, resume, and stop deterministically", () => {
    expect(transitionLiveRunState("idle", "start")).toBe("running");
    expect(transitionLiveRunState("running", "pause")).toBe("paused");
    expect(transitionLiveRunState("paused", "start")).toBe("running");
    expect(transitionLiveRunState("running", "end")).toBe("complete");
    expect(transitionLiveRunState("complete", "start")).toBe("complete");
  });

  it("continues after a failed window only while the coach remains live", () => {
    expect(shouldContinueAfterWindowFailure("running")).toBe(true);
    expect(shouldContinueAfterWindowFailure("paused")).toBe(false);
    expect(shouldContinueAfterWindowFailure("complete")).toBe(false);
  });

  it("queues five-second windows without duplicates and retains only the latest bounded backlog", () => {
    let queue: Array<{ windowIndex: number }> = [];
    for (let windowIndex = 0; windowIndex < 9; windowIndex += 1) {
      queue = enqueueLatestWindow(queue, { windowIndex }, 6);
    }
    queue = enqueueLatestWindow(queue, { windowIndex: 8 }, 6);
    expect(queue.map((item) => item.windowIndex)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it("never silently disables camera launch and gives replay mode an actionable missing-file state", () => {
    expect(getLiveLaunchIssue("camera", "")).toBeNull();
    expect(getLiveLaunchIssue("upload", "")).toMatch(/Choose game footage/);
    expect(getLiveLaunchIssue("upload", "videos/game.mp4")).toBeNull();
  });

  it("never passes an empty string to video src while a protected replay URL is loading", () => {
    expect(getLiveVideoSource("upload", "")).toBeUndefined();
    expect(getLiveVideoSource("upload", "   ")).toBeUndefined();
    expect(shouldRenderLiveVideo("upload", "")).toBe(false);
    expect(getLiveVideoSource("upload", "/api/live/video/55?access=signed")).toBe("/api/live/video/55?access=signed");
    expect(shouldRenderLiveVideo("upload", "/api/live/video/55?access=signed")).toBe(true);
  });

  it("keeps the video element available for a camera srcObject without a URL", () => {
    expect(getLiveVideoSource("camera", "")).toBeUndefined();
    expect(shouldRenderLiveVideo("camera", "")).toBe(true);
  });

  it("defers one replay start until both the signed URL and mounted video are ready", () => {
    expect(shouldDeferLiveStart("upload", undefined, false)).toBe(true);
    expect(shouldDeferLiveStart("upload", "/api/live/video/55?access=signed", false)).toBe(true);
    expect(shouldDeferLiveStart("upload", "/api/live/video/55?access=signed", true)).toBe(false);
    expect(shouldDeferLiveStart("camera", undefined, true)).toBe(false);
  });
});
