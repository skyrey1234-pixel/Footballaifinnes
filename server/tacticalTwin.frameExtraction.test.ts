import { describe, expect, it } from "vitest";
import { buildTwinTrackingFfmpegArgs } from "./tacticalTwinFrameExtraction";

describe("Tactical Twin server frame extraction", () => {
  it("builds one bounded three-frame seek instead of downloading the full game film", () => {
    const args = buildTwinTrackingFfmpegArgs({
      signedUrl: "https://storage.example/game.mp4?signed=1",
      extractStartSeconds: 31.5,
      samplingFps: 2,
      frameCount: 3,
      outputPattern: "/tmp/frame-%03d.jpg",
    });
    expect(args).toContain("31.500");
    expect(args).toContain("https://storage.example/game.mp4?signed=1");
    expect(args).toContain("3");
    expect(args.join(" ")).toContain("fps=2,scale=960:540");
    expect(args.at(-1)).toBe("/tmp/frame-%03d.jpg");
  });
});
