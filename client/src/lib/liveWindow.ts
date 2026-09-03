export type LiveRunState = "idle" | "running" | "paused" | "complete";
export type LiveRunAction = "start" | "pause" | "end";
export type BufferedLiveFrame = { second: number; dataUrl: string };

export function getLiveLaunchIssue(sourceType: "upload" | "camera", uploadedFileKey: string) {
  if (sourceType === "upload" && !uploadedFileKey.trim()) return "Choose game footage before opening replay mode.";
  return null;
}

export function transitionLiveRunState(current: LiveRunState, action: LiveRunAction): LiveRunState {
  if (action === "end") return "complete";
  if (action === "pause") return current === "complete" ? "complete" : "paused";
  return current === "complete" ? "complete" : "running";
}

export function getCompletedWindowIndex(currentSecond: number, windowSeconds = 15) {
  if (!Number.isFinite(currentSecond) || currentSecond < windowSeconds) return -1;
  return Math.floor(currentSecond / windowSeconds) - 1;
}

export function selectFramesForWindow(
  frames: BufferedLiveFrame[],
  windowIndex: number,
  windowSeconds = 15,
  maxFrames = 6,
) {
  const start = windowIndex * windowSeconds;
  const end = start + windowSeconds;
  return frames
    .filter((frame) => frame.second >= start && frame.second <= end + 1)
    .map((frame) => frame.dataUrl)
    .slice(-maxFrames);
}

export function shouldContinueAfterWindowFailure(state: LiveRunState) {
  return state === "running";
}
