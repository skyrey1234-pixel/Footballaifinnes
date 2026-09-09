import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("./_core/llm", () => ({ invokeLLM: invokeMock }));

import { analyzeTwinFrameBatch, MAX_TWIN_TRACKING_BATCH, TWIN_TRACKING_FALLBACK_MODEL, TWIN_TRACKING_MODEL } from "./tacticalTwinTracking";

const sourceFrame = (frameIndex: number) => ({
  frameIndex,
  timestampMs: frameIndex * 500,
  imageWidth: 640,
  imageHeight: 360,
  dataUrl: `data:image/jpeg;base64,${Buffer.alloc(120, frameIndex + 1).toString("base64")}`,
});

describe("Tactical Twin automatic tracking normalization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes invented identities, clamps geometry, and never keeps an invisible ball location", async () => {
    invokeMock.mockResolvedValue({
      choices: [{ message: { content: `\`\`\`json
${JSON.stringify({
  frames: [{
    frameIndex: 0,
    players: [{
      trackId: "O1!",
      unit: "offense",
      label: "Invented Player Name",
      jerseyNumber: null,
      bbox: { x: -0.5, y: 1.5, width: 4, height: 0.2 },
      imagePoint: { x: 1.2, y: -1, confidence: 140 },
      fieldPoint: { x: 2, y: -2, confidence: -20 },
      occluded: false,
    }],
    ball: {
      visible: false,
      bbox: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 },
      imagePoint: { x: 0.5, y: 0.5, confidence: 99 },
      fieldPoint: { x: 0.5, y: 0.5, confidence: 99 },
      possessedByTrackId: "O1",
    },
    frameConfidence: 160,
  }],
  calibration: { quality: "high", confidence: 130, imagePoints: [{ x: -2, y: 2 }], fieldPoints: [{ x: 2, y: -2 }] },
  limitations: ["Single broadcast angle"],
})}
\`\`\`` } }],
    });

    const result = await analyzeTwinFrameBatch({ frames: [sourceFrame(0)] });
    expect(result.frames[0].players[0]).toMatchObject({
      trackId: "O1",
      label: "offense O1",
      bbox: { x: 0, y: 1, width: 1, height: 0.2 },
      imagePoint: { x: 1, y: 0, confidence: 100 },
      manuallyCorrected: false,
    });
    expect(result.frames[0].ball).toMatchObject({ visible: false, bbox: null, imagePoint: null, fieldPoint: null, manuallyCorrected: false });
    expect(result.frames[0].frameConfidence).toBe(100);
    expect(result.calibration).toMatchObject({ confidence: 100, imagePoints: [{ x: 0, y: 1 }], fieldPoints: [{ x: 1, y: 0 }] });
    expect(invokeMock).toHaveBeenCalledWith(expect.objectContaining({
      model: TWIN_TRACKING_MODEL,
      messages: expect.arrayContaining([expect.objectContaining({ content: expect.arrayContaining([expect.objectContaining({ image_url: expect.objectContaining({ detail: "low" }) })]) })]),
    }));
    expect(invokeMock.mock.calls[0][0]).not.toHaveProperty("response_format");
  });

  it("returns an evidence-empty fallback for a requested frame omitted by the model", async () => {
    invokeMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ frames: [], calibration: { quality: "unavailable", confidence: 0, imagePoints: [], fieldPoints: [] }, limitations: ["Players are occluded"] }) } }],
    });
    const result = await analyzeTwinFrameBatch({ frames: [sourceFrame(7)] });
    expect(result.frames[0]).toMatchObject({ frameIndex: 7, players: [], frameConfidence: 0 });
    expect(result.frames[0].ball).toMatchObject({ visible: false, imagePoint: null, fieldPoint: null });
  });

  it("retries empty Flash content on the stronger multimodal fallback", async () => {
    invokeMock
      .mockResolvedValueOnce({ choices: [{ finish_reason: "length", message: { content: null } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ frames: [], calibration: { quality: "unavailable", confidence: 0, imagePoints: [], fieldPoints: [] }, limitations: ["Wide angle"] }) } }] });
    const result = await analyzeTwinFrameBatch({ frames: [sourceFrame(0)] });
    expect(result.frames).toHaveLength(1);
    expect(invokeMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: TWIN_TRACKING_MODEL, maxTokens: 16_384 }));
    expect(invokeMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: TWIN_TRACKING_FALLBACK_MODEL, maxTokens: 16_384 }));
  });

  it("falls back to the stronger model when the primary compact response is unavailable", async () => {
    invokeMock
      .mockResolvedValueOnce({ error: { message: "TEMPORARY_FAILURE" } })
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ frames: [], calibration: { quality: "low", confidence: 20, imagePoints: [], fieldPoints: [] }, limitations: ["Wide angle"] }) } }] });
    const result = await analyzeTwinFrameBatch({ frames: [sourceFrame(0)] });
    expect(result.frames).toHaveLength(1);
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: TWIN_TRACKING_FALLBACK_MODEL }));
  });

  it("expands compact provider JSON into normalized player and ball evidence", async () => {
    invokeMock.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
        f: [{ i: 4, p: [{ id: "D1", u: "defense", j: "", b: [0.1, 0.2, 0.1, 0.3], q: [0.15, 0.5, 80], g: [0.4, 0.6, 55], o: false }], a: { v: true, b: [0.5, 0.5, 0.02, 0.02], q: [0.51, 0.51, 60], g: [0, 0, 0], h: "D1" }, c: 70 }],
        k: { q: "low", c: 40, ip: [], fp: [] },
        l: ["Wide angle"],
      }) } }] });
    const result = await analyzeTwinFrameBatch({ frames: [sourceFrame(4)] });
    expect(result.frames[0].players[0]).toMatchObject({ trackId: "D1", unit: "defense", jerseyNumber: null });
    expect(result.frames[0].ball).toMatchObject({ visible: true, possessedByTrackId: "D1" });
    expect(result.calibration).toMatchObject({ quality: "low", confidence: 40 });
    const requestPayload = JSON.stringify(invokeMock.mock.calls[0]?.[0] ?? {});
    expect(requestPayload).toContain("integer percentage from 0 to 100");
    expect(requestPayload).toContain("never output 0-to-1 unit-scale confidence");
  });

  it("rescales an entirely unit-range compact confidence envelope without changing zero evidence", async () => {
    invokeMock.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
      f: [{ i: 5, p: [{ id: "O1", u: "offense", j: "", b: [0.2, 0.2, 0.05, 0.1], q: [0.22, 0.3, 0.82], g: [0, 0, 0], o: false }], a: { v: false, b: [0, 0, 0, 0], q: [0, 0, 0], g: [0, 0, 0], h: "" }, c: 0.74 }],
      k: { q: "low", c: 0.51, ip: [], fp: [] },
      l: ["Wide angle"],
    }) } }] });
    const result = await analyzeTwinFrameBatch({ frames: [sourceFrame(5)] });
    expect(result.frames[0].frameConfidence).toBe(74);
    expect(result.frames[0].players[0].imagePoint.confidence).toBe(82);
    expect(result.frames[0].players[0].fieldPoint).toBeNull();
    expect(result.calibration.confidence).toBe(51);
  });

  it("rejects malformed model output and caps each request to the supported batch size", async () => {
    invokeMock
      .mockResolvedValueOnce({ choices: [{ message: { content: "not valid tracking json" } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: "still not valid tracking json" } }] });
    await expect(analyzeTwinFrameBatch({ frames: [sourceFrame(0)] })).rejects.toThrow("invalid JSON");

    invokeMock.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ frames: [], calibration: { quality: "low", confidence: 10, imagePoints: [], fieldPoints: [] }, limitations: [] }) } }],
    });
    const result = await analyzeTwinFrameBatch({ frames: [sourceFrame(0), sourceFrame(1), sourceFrame(2), sourceFrame(3)] });
    expect(result.frames).toHaveLength(MAX_TWIN_TRACKING_BATCH);
  });
});
