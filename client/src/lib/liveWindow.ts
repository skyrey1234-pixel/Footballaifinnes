export type LiveRunState = "idle" | "running" | "paused" | "complete";
export type LiveRunAction = "start" | "pause" | "end";
export type BufferedLiveFrame = { second: number; dataUrl: string };
export const LIVE_WINDOW_SECONDS = 5;
export const LIVE_FRAME_CAPTURE_SECONDS = 1.2;

export type LiveSourceType = "upload" | "camera" | "screen";

export function getScreenShareStartIssue(supported: boolean, error?: unknown) {
  if (!supported) return "Screen sharing is not supported in this browser. Try current Chrome or Edge on a computer.";
  if ((error as { name?: string } | undefined)?.name === "NotAllowedError") {
    return "Screen sharing permission was not granted. Press Go Live and choose an authorized game tab, window, or display.";
  }
  return error instanceof Error ? error.message : "Could not start screen sharing.";
}

export function getScreenShareStoppedMessage(reason: "stopped" | "ended") {
  return `Screen sharing ${reason}. Press Resume Analysis to choose a screen again.`;
}

export function getCameraStartIssue(supported: boolean, error?: unknown) {
  if (!supported) return "Live camera capture is not supported in this browser. Try current Chrome, Edge, or Safari on a phone, tablet, or laptop.";
  const name = (error as { name?: string } | undefined)?.name;
  if (name === "NotAllowedError") return "Camera permission was not granted. Allow camera access in your browser settings, then press Go Live again.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No camera was detected. Connect a camera or capture card, then press Go Live again.";
  if (name === "NotReadableError" || name === "TrackStartError") return "The camera is already in use or unavailable. Close other camera apps, reconnect the device, then try again.";
  return error instanceof Error ? error.message : "Could not start the live camera.";
}

export function isLiveCaptureSource(sourceType: LiveSourceType | undefined) {
  return sourceType === "camera" || sourceType === "screen";
}

export function shouldUseVideoFrameScheduler(sourceType: LiveSourceType | undefined, callbackAvailable: boolean) {
  return isLiveCaptureSource(sourceType) && callbackAvailable;
}

export function getCaptureTimestampAfterAttempt(previousSecond: number, attemptedSecond: number, captured: boolean) {
  return captured ? attemptedSecond : previousSecond;
}

export function getLiveVideoSource(sourceType: LiveSourceType | undefined, playbackUrl: string | undefined) {
  if (sourceType !== "upload") return undefined;
  const source = playbackUrl?.trim();
  return source || undefined;
}

export function shouldRenderLiveVideo(sourceType: LiveSourceType | undefined, playbackUrl: string | undefined) {
  return isLiveCaptureSource(sourceType) || Boolean(getLiveVideoSource(sourceType, playbackUrl));
}

export function shouldDeferLiveStart(sourceType: LiveSourceType | undefined, playbackUrl: string | undefined, hasVideoElement: boolean) {
  return sourceType === "upload" && (!getLiveVideoSource(sourceType, playbackUrl) || !hasVideoElement);
}

export function getLiveLaunchIssue(sourceType: LiveSourceType, uploadedFileKey: string) {
  if (sourceType === "upload" && !uploadedFileKey.trim()) return "Choose game footage before opening replay mode.";
  return null;
}

export function transitionLiveRunState(current: LiveRunState, action: LiveRunAction): LiveRunState {
  if (action === "end") return "complete";
  if (action === "pause") return current === "complete" ? "complete" : "paused";
  return current === "complete" ? "complete" : "running";
}

export function getCompletedWindowIndex(currentSecond: number, windowSeconds = LIVE_WINDOW_SECONDS) {
  if (!Number.isFinite(currentSecond) || currentSecond < windowSeconds) return -1;
  return Math.floor(currentSecond / windowSeconds) - 1;
}

export function selectFramesForWindow(
  frames: BufferedLiveFrame[],
  windowIndex: number,
  windowSeconds = LIVE_WINDOW_SECONDS,
  maxFrames = 4,
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

export function enqueueLatestWindow<T extends { windowIndex: number }>(queue: T[], window: T, maxQueued = 6) {
  if (queue.some((item) => item.windowIndex === window.windowIndex)) return queue;
  return [...queue, window].slice(-Math.max(1, maxQueued));
}
