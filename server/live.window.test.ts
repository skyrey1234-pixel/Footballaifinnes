import {
  enqueueLatestWindow,
  getCameraStartIssue,
  getCaptureTimestampAfterAttempt,
  getCompletedWindowIndex,
  getLiveLaunchIssue,
  getLiveCaptureResumePosition,
  getLatestProcessableWindowIndex,
  getLiveVideoSource,
  getScreenShareStartIssue,
  getScreenShareStoppedMessage,
  isLiveCaptureSource,
  isMediaPlayInterruption,
  LIVE_WINDOW_SECONDS,
  selectFramesForWindow,
  shouldContinueAfterWindowFailure,
  shouldDeferLiveStart,
  shouldRenderLiveVideo,
  shouldStartLiveMedia,
  shouldUseVideoFrameScheduler,
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

  it("treats camera and Screen Share as URL-free live capture sources", () => {
    expect(isLiveCaptureSource("camera")).toBe(true);
    expect(isLiveCaptureSource("screen")).toBe(true);
    expect(isLiveCaptureSource("upload")).toBe(false);
    expect(shouldRenderLiveVideo("screen", undefined)).toBe(true);
    expect(shouldDeferLiveStart("screen", undefined, true)).toBe(false);
    expect(getLiveLaunchIssue("screen", "")).toBeNull();
  });

  it("uses decoded-frame scheduling for camera and Screen Share, while replay keeps animation timing", () => {
    expect(shouldUseVideoFrameScheduler("camera", true)).toBe(true);
    expect(shouldUseVideoFrameScheduler("screen", true)).toBe(true);
    expect(shouldUseVideoFrameScheduler("upload", true)).toBe(false);
    expect(shouldUseVideoFrameScheduler("camera", false)).toBe(false);
  });

  it("does not advance the capture clock until a real canvas frame succeeds", () => {
    expect(getCaptureTimestampAfterAttempt(-1.2, 0, false)).toBe(-1.2);
    expect(getCaptureTimestampAfterAttempt(-1.2, 0.25, false)).toBe(-1.2);
    expect(getCaptureTimestampAfterAttempt(-1.2, 0.5, true)).toBe(0.5);
  });

  it("blocks duplicate media starts synchronously while permission or play() is unresolved", () => {
    expect(shouldStartLiveMedia(false, "idle")).toBe(true);
    expect(shouldStartLiveMedia(false, "paused")).toBe(true);
    expect(shouldStartLiveMedia(true, "idle")).toBe(false);
    expect(shouldStartLiveMedia(true, "paused")).toBe(false);
    expect(shouldStartLiveMedia(false, "running")).toBe(false);
    expect(shouldStartLiveMedia(false, "complete")).toBe(false);
  });

  it("recognizes browser play/load interruptions without hiding real playback failures", () => {
    expect(isMediaPlayInterruption({ name: "AbortError", message: "The play() request was interrupted by a new load request." })).toBe(true);
    expect(isMediaPlayInterruption({ name: "AbortError", message: "The play() request was interrupted by a call to pause()." })).toBe(true);
    expect(isMediaPlayInterruption({ name: "NotAllowedError", message: "Autoplay was blocked" })).toBe(false);
    expect(isMediaPlayInterruption(new Error("Decoder failed"))).toBe(false);
  });

  it("resumes live capture after both the persisted clock and the latest analyzed window", () => {
    expect(getLiveCaptureResumePosition(19, [0])).toEqual({ second: 19, lastWindowIndex: 2 });
    expect(getLiveCaptureResumePosition(0, [55, 56, 57])).toEqual({ second: 290, lastWindowIndex: 57 });
    expect(getLiveCaptureResumePosition(310, [55, 56, 57])).toEqual({ second: 310, lastWindowIndex: 61 });
    expect(getLiveCaptureResumePosition(Number.NaN, [])).toEqual({ second: 0, lastWindowIndex: -1 });
  });

  it("recovers the newest evidence-backed window when decoded-frame callbacks skip boundaries", () => {
    const sparseFrames = [
      { second: 290, dataUrl: "frame-58" },
      { second: 308, dataUrl: "frame-61" },
    ];
    expect(getLatestProcessableWindowIndex(sparseFrames, 60, 57)).toBe(58);
    expect(getLatestProcessableWindowIndex(sparseFrames, 62, 58)).toBe(61);
    expect(getLatestProcessableWindowIndex([], 62, 58)).toBe(-1);
  });

  it("returns coach-visible Screen Share guidance for unsupported, denied, stopped, and ended states", () => {
    expect(getScreenShareStartIssue(false)).toMatch(/not supported/i);
    expect(getScreenShareStartIssue(true, { name: "NotAllowedError" })).toMatch(/permission was not granted/i);
    expect(getScreenShareStartIssue(true, new Error("Display capture failed"))).toBe("Display capture failed");
    expect(getScreenShareStoppedMessage("stopped")).toMatch(/stopped.*Resume Analysis/i);
    expect(getScreenShareStoppedMessage("ended")).toMatch(/ended.*Resume Analysis/i);
  });

  it("returns coach-visible camera guidance for unsupported, denied, missing, and busy devices", () => {
    expect(getCameraStartIssue(false)).toMatch(/not supported/i);
    expect(getCameraStartIssue(true, { name: "NotAllowedError" })).toMatch(/permission was not granted/i);
    expect(getCameraStartIssue(true, { name: "NotFoundError" })).toMatch(/No camera was detected/i);
    expect(getCameraStartIssue(true, { name: "NotReadableError" })).toMatch(/already in use or unavailable/i);
    expect(getCameraStartIssue(true, new Error("Camera failed"))).toBe("Camera failed");
  });

  it("defers one replay start until both the signed URL and mounted video are ready", () => {
    expect(shouldDeferLiveStart("upload", undefined, false)).toBe(true);
    expect(shouldDeferLiveStart("upload", "/api/live/video/55?access=signed", false)).toBe(true);
    expect(shouldDeferLiveStart("upload", "/api/live/video/55?access=signed", true)).toBe(false);
    expect(shouldDeferLiveStart("camera", undefined, true)).toBe(false);
  });
});
