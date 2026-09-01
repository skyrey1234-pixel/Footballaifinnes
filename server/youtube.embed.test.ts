import { describe, expect, it } from "vitest";
import {
  buildYouTubeEmbedUrl,
  buildYouTubeWatchUrl,
  extractYouTubeVideoId,
} from "../client/src/lib/youtube";

describe("extractYouTubeVideoId", () => {
  it.each([
    ["Bc4srv6rZj0", "Bc4srv6rZj0"],
    ["https://www.youtube.com/watch?v=Bc4srv6rZj0", "Bc4srv6rZj0"],
    ["https://www.youtube.com/watch?v=Bc4srv6rZj0&t=786s", "Bc4srv6rZj0"],
    ["https://youtu.be/Bc4srv6rZj0?si=share-token", "Bc4srv6rZj0"],
    ["youtube.com/shorts/Bc4srv6rZj0", "Bc4srv6rZj0"],
    ["https://www.youtube.com/live/Bc4srv6rZj0?feature=share", "Bc4srv6rZj0"],
    ["https://www.youtube.com/embed/Bc4srv6rZj0", "Bc4srv6rZj0"],
    ["https://www.youtube-nocookie.com/embed/Bc4srv6rZj0", "Bc4srv6rZj0"],
    ["https://m.youtube.com/watch?v=Bc4srv6rZj0", "Bc4srv6rZj0"],
  ])("extracts %s", (input, expected) => {
    expect(extractYouTubeVideoId(input)).toBe(expected);
  });

  it.each([
    "",
    "not a youtube link",
    "https://example.com/watch?v=Bc4srv6rZj0",
    "https://www.youtube.com/watch?v=too-short",
    "https://youtu.be/too-long-video-id",
  ])("rejects %s", (input) => {
    expect(extractYouTubeVideoId(input)).toBeNull();
  });
});

describe("buildYouTubeEmbedUrl", () => {
  it("adds playback, timing, and origin parameters", () => {
    const url = buildYouTubeEmbedUrl("Bc4srv6rZj0", {
      startSeconds: 786.9,
      endSeconds: 799.2,
      autoPlay: true,
      origin: "https://tacticalai-yt2mojug.manus.space/session/810001",
    });

    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    expect(parsed.origin).toBe("https://www.youtube.com");
    expect(parsed.pathname).toBe("/embed/Bc4srv6rZj0");
    expect(parsed.searchParams.get("start")).toBe("786");
    expect(parsed.searchParams.get("end")).toBe("800");
    expect(parsed.searchParams.get("autoplay")).toBe("1");
    expect(parsed.searchParams.get("playsinline")).toBe("1");
    expect(parsed.searchParams.get("enablejsapi")).toBe("1");
    expect(parsed.searchParams.get("origin")).toBe("https://tacticalai-yt2mojug.manus.space");
    expect(parsed.searchParams.get("widget_referrer")).toBe("https://tacticalai-yt2mojug.manus.space");
  });

  it("does not build an embed URL for invalid input", () => {
    expect(buildYouTubeEmbedUrl("invalid")).toBeNull();
  });
});

describe("buildYouTubeWatchUrl", () => {
  it("normalizes every supported input to a canonical watch URL", () => {
    expect(buildYouTubeWatchUrl("https://youtu.be/Bc4srv6rZj0?t=10")).toBe(
      "https://www.youtube.com/watch?v=Bc4srv6rZj0",
    );
  });

  it("preserves a clip timestamp for the external fallback", () => {
    expect(buildYouTubeWatchUrl("Bc4srv6rZj0", 786.9)).toBe(
      "https://www.youtube.com/watch?v=Bc4srv6rZj0&t=786s",
    );
  });
});
