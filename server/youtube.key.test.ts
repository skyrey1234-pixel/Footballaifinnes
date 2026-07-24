import { describe, expect, it } from "vitest";
import { parseIsoDuration, formatDuration, fetchYouTubeMeta } from "./youtubeMeta";

/**
 * Validates the YOUTUBE_API_KEY secret with a lightweight videos.list call.
 * Uses a well-known stable video ID (YouTube's first-ever video, jNQXAC9IVRw).
 */
describe("YouTube Data API key", () => {
  it("fetches video metadata with the configured key", async () => {
    const key = process.env.YOUTUBE_API_KEY;
    expect(key, "YOUTUBE_API_KEY must be set").toBeTruthy();

    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=jNQXAC9IVRw&key=${key}`;
    const res = await fetch(url);
    const body = (await res.json()) as {
      items?: Array<{ contentDetails?: { duration?: string }; snippet?: { title?: string } }>;
      error?: { message?: string };
    };

    expect(res.ok, `YouTube API error: ${body.error?.message ?? res.status}`).toBe(true);
    expect(body.items?.length).toBeGreaterThan(0);
    // ISO 8601 duration like "PT19S"
    expect(body.items?.[0]?.contentDetails?.duration).toMatch(/^PT/);
  }, 20000);
});

describe("youtubeMeta helpers", () => {
  it("parses ISO 8601 durations", () => {
    expect(parseIsoDuration("PT19S")).toBe(19);
    expect(parseIsoDuration("PT10M30S")).toBe(630);
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT2H")).toBe(7200);
    expect(parseIsoDuration("garbage")).toBe(0);
  });

  it("formats durations", () => {
    expect(formatDuration(19)).toBe("0:19");
    expect(formatDuration(630)).toBe("10:30");
    expect(formatDuration(3723)).toBe("1:02:03");
  });

  it("fetches real metadata for a known video", async () => {
    const meta = await fetchYouTubeMeta("jNQXAC9IVRw");
    expect(meta).not.toBeNull();
    expect(meta!.durationSeconds).toBeGreaterThan(0);
    expect(meta!.title.length).toBeGreaterThan(0);
  }, 20000);
});
